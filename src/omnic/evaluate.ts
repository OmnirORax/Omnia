import { LIMITS, validateRecipe, type Recipe, type Component, type Frame, type Params } from "./model.ts";
import { defaultParams, definition } from "./registry.ts";
export type StructuralNode = { id:string; componentId:string; parent?:string; kind:"group"|"dot"|"ring"|"line"; x:number;y:number;x2?:number;y2?:number;radius:number;fill:boolean;thickness:number;color:string;opacity:number };
export type Diagnostic = { code:string; message:string; target?:string; operation?:string };
export type InterpretationResult = { operation:string; kind:"count"; value:number; scope:string[] };
export type Evaluation = { results:InterpretationResult[]; nodes:StructuralNode[]; selection:string[]; diagnostics:Diagnostic[]; properties:{count:number;selectedCount:number;componentCount:number}; frames:Frame[]; motion:boolean };
type Generation={component:Component;root:StructuralNode;params:Params};
const num=(p:Params,key:string,base=0)=>typeof p[key]==="number"?p[key] as number:base;
const rad=(degrees:number)=>degrees*Math.PI/180;
export function evaluateRecipe(input:Recipe,resolve?:(entityId:string)=>Recipe|undefined,time=0):Evaluation {
  const recipe=validateRecipe(input);
  if(!Number.isFinite(time))throw Error("Invalid evaluation time.");
  const nodes:StructuralNode[]=[],diagnostics:Diagnostic[]=[],frames:Frame[]=[],results:InterpretationResult[]=[];
  const generations=new Map<string,Generation>(),byId=new Map<string,StructuralNode>();
  let work=0,motion=false;
  const spend=(n=1)=>{work+=n;if(work>LIMITS.work)throw Error("Omnic evaluation work budget exceeded.");};
  const ensureExtent=()=>{
    for(const node of nodes){
      spend();
      if(![node.x,node.y,node.x2??0,node.y2??0,node.radius,node.thickness].every(v=>Number.isFinite(v)&&Math.abs(v)<=LIMITS.extent)||node.radius<0||node.thickness<0)throw Error("Omnic geometric extent exceeded.");
    }
  };
  const push=(node:StructuralNode)=>{if(nodes.length>=LIMITS.nodes)throw Error(`Omnic output exceeds ${LIMITS.nodes} structural nodes.`);if(byId.has(node.id))throw Error(`Generated role collision: ${node.id}`);nodes.push(node);byId.set(node.id,node);spend();return node;};
  const base=(id:string,componentId:string,parent:string|undefined,p:Params,x:number,y:number):StructuralNode=>({id,componentId,parent,kind:"group",x,y,radius:0,fill:p.fill!==false,thickness:num(p,"thickness",2),color:String(p.color??"#60ddec"),opacity:num(p,"opacity",1)});
  const generate=(generation:Generation)=>{
    const {root,component,params:p}=generation;
    const point=(suffix:string,x:number,y:number,kind:StructuralNode["kind"],radius=0)=>push({...base(root.id+suffix,root.componentId,root.id,p,x,y),kind,radius});
    if(component.generator==="dot"||component.generator==="ring")point(":shape",root.x,root.y,component.generator,num(p,component.generator==="ring"?"radius":"size",6));
    if(component.generator==="line"){
      const a=rad(num(p,"angle")),half=num(p,"length",80)/2,dx=Math.cos(a)*half,dy=Math.sin(a)*half;
      const line=point(":shape",root.x-dx,root.y-dy,"line");line.x2=root.x+dx;line.y2=root.y+dy;
    }
    if(component.generator==="chain"||component.generator==="radial"){
      const count=num(p,"count",6),angle=rad(num(p,"angle"));
      for(let i=0;i<count;i++){
        const a=angle+(component.generator==="radial"?i*Math.PI*2/count:0);
        const distance=component.generator==="radial"?num(p,"radius",40):(i-(count-1)/2)*num(p,"spacing",18);
        point(`:unit:${i}`,root.x+Math.cos(a)*distance,root.y+Math.sin(a)*distance,"dot",num(p,"size",6));
      }
    }
  };
  const belongs=(node:StructuralNode,target:string):boolean=>{
    spend();let current:StructuralNode|undefined=node;
    for(let i=0;current&&i<LIMITS.depth*4;i++){if(current.id===target)return true;current=current.parent?byId.get(current.parent):undefined;}return false;
  };
  const targetNodes=(targets:string[],scope:string[],operation:string)=>{
    for(const target of targets)if(!byId.has(target))diagnostics.push({code:"unresolved-target",message:`Role ${target} is unresolved; choose an explicit replacement.`,target,operation});
    const valid=targets.filter(t=>byId.has(t));
    return nodes.filter(node=>scope.some(root=>belongs(node,root))&&valid.some(target=>belongs(node,target)));
  };
  const run=(r:Recipe,prefix:string,parent:string|undefined,offset:{x:number;y:number},stack:Set<string>,depth:number):string[]=>{
    if(depth>LIMITS.depth)throw Error("Omnic composition depth exceeded.");
    const roots:string[]=[];
    const component=(c:Component,owner:string|undefined,origin:{x:number;y:number},level=depth)=>{
      if(level>LIMITS.depth)throw Error("Omnic combined component/reference depth exceeded.");
      const p={...defaultParams(definition(c.generator,true)!),...c.params},id=prefix+c.id;
      const root=push(base(id,id,owner,p,origin.x+num(p,"x"),origin.y+num(p,"y")));
      const generation={component:c,root,params:p};generations.set(id,generation);
      generate(generation);
      c.children?.forEach(child=>component(child,id,root,level+1));
      if(c.generator==="reference"){
        const ref=c.reference!;
        if(stack.has(ref))throw Error(`Circular Omnic reference: ${ref}`);
        const linked=resolve?.(ref);if(!linked){diagnostics.push({code:"unresolved-object",message:`Missing Omnic object ${ref}.`,target:ref});return id;}
        const next=new Set(stack);next.add(ref);run(validateRecipe(linked),`${id}:ref:${ref}/`,id,root,next,level+1);
      }
      return id;
    };
    r.components.forEach(c=>roots.push(component(c,parent,offset)));
    let selected:string[]=[];
    for(const frame of r.frames){
      const scope=frame.scope.map(id=>prefix+id);frames.push({...frame,id:prefix+frame.id,scope});
      for(const target of scope)if(!byId.has(target))diagnostics.push({code:"unresolved-frame-scope",message:`Frame scope ${target} is unresolved.`,target});
    }
    for(const op of r.operations){
      spend();if(!op.enabled)continue;
      const targets=op.targets.length?op.targets.map(id=>prefix+id):selected.length?selected:roots;
      const spec=definition(op.operator)!,p={...defaultParams(spec),...op.params};
      const affected=()=>targetNodes(targets,roots,prefix+op.id);
      const setCount=(count:number)=>{
        if(!Number.isInteger(count)||count<1||count>64)throw Error("Unsupported count range.");
        const arrays=affected().filter(node=>{const kind=generations.get(node.id)?.component.generator;return kind==="chain"||kind==="radial";});
        if(!arrays.length)diagnostics.push({code:"inapplicable",message:"Count requires a chain or radial generator.",operation:prefix+op.id});
        for(const root of arrays){
          const generation=generations.get(root.id)!;generation.params.count=count;
          for(let i=nodes.length-1;i>=0;i--)if(nodes[i].parent===root.id){
            if(!generations.has(nodes[i].componentId))diagnostics.push({code:"unresolved-link",message:"A connection was removed by regeneration; move it after the count operation or reconnect explicitly.",operation:prefix+op.id,target:nodes[i].id});
            byId.delete(nodes[i].id);nodes.splice(i,1);
          }
          generate(generation);
        }
      };
      const connect=()=>{
        const units=affected().filter(node=>node.kind!=="group");
        if(units.length<2){diagnostics.push({code:"inapplicable",message:"Connection needs at least two primitive roles.",operation:prefix+op.id});return;}
        for(let i=1;i<units.length;i++){
          const a=units[i-1],b=units[i];
          const line=push({...base(`${prefix}${op.id}:link:${i-1}`,prefix+op.id,roots[0]??parent,p,a.x,a.y),kind:"line"});line.x2=b.x;line.y2=b.y;
          // Links belong to this evaluation scope without asserting an external
          // Omnium knowledge relationship or a change of object identity.
        }
      };
      const transform=(kind:"fill"|"size"|"rotate"|"oscillate",override?:Params)=>{
      const p={...defaultParams(definition(kind)!),...op.params,...override};
      for(const node of affected()){
        spend();
        if(kind==="fill"){
          node.fill=Boolean(p.fill);node.color=String(p.color);node.opacity=num(p,"opacity",1);
          const generation=generations.get(node.id);if(generation)Object.assign(generation.params,{fill:node.fill,color:node.color,opacity:node.opacity});
        }
        if(kind==="size"){
          const factor=num(p,"factor",1);
          node.x=offset.x+(node.x-offset.x)*factor;node.y=offset.y+(node.y-offset.y)*factor;
          if(node.x2!==undefined)node.x2=offset.x+(node.x2-offset.x)*factor;
          if(node.y2!==undefined)node.y2=offset.y+(node.y2-offset.y)*factor;
          node.radius*=factor;node.thickness*=factor;
          const generation=generations.get(node.id);if(generation)for(const key of ["radius","spacing","size","length","thickness"])if(typeof generation.params[key]==="number")generation.params[key]=num(generation.params,key)*factor;
        }
        if(kind==="rotate"){
          const angle=rad(num(p,"angle")),cx=offset.x+num(p,"pivotX"),cy=offset.y+num(p,"pivotY"),cos=Math.cos(angle),sin=Math.sin(angle);
          const rotate=(x:number,y:number)=>({x:cx+(x-cx)*cos-(y-cy)*sin,y:cy+(x-cx)*sin+(y-cy)*cos});
          const point=rotate(node.x,node.y);node.x=point.x;node.y=point.y;
          if(node.x2!==undefined&&node.y2!==undefined){const end=rotate(node.x2,node.y2);node.x2=end.x;node.y2=end.y;}
          const generation=generations.get(node.id);if(generation)generation.params.angle=num(generation.params,"angle")+num(p,"angle");
        }
        if(kind==="oscillate"){
          motion=true;
          const displacement=num(p,"amplitude",10)*Math.sin(time*Math.PI*2*num(p,"frequency",1)+rad(num(p,"phase")));
          if(p.axis==="x"){node.x+=displacement;if(node.x2!==undefined)node.x2+=displacement;}else{node.y+=displacement;if(node.y2!==undefined)node.y2+=displacement;}
        }
      }
      };
      if(!spec.apply)throw Error(`Operator has no evaluator: ${op.operator}`);
      spec.apply({params:p,setCount,connect,transform,
        select:()=>{selected=affected().map(n=>n.id);},
        extract:()=>{results.push({operation:prefix+op.id,kind:"count",value:affected().filter(n=>n.kind!=="group"&&generations.has(n.componentId)).length,scope:[...targets]});},
      });
      ensureExtent();
    }
    return selected;
  };
  const selection=run(recipe,"",undefined,{x:0,y:0},new Set(),1);
  for(const frame of frames)for(const target of frame.scope)if(!byId.has(target)&&!diagnostics.some(d=>d.code==="unresolved-frame-scope"&&d.target===target))diagnostics.push({code:"unresolved-frame-scope",message:`Frame scope ${target} is unresolved.`,target});
  ensureExtent();
  const primitives=nodes.filter(n=>n.kind!=="group"&&generations.has(n.componentId));
  return {results,nodes,selection,diagnostics,properties:{count:primitives.length,selectedCount:primitives.filter(n=>selection.includes(n.id)).length,componentCount:generations.size},frames,motion};
}
