import { RENDER_BUDGET } from '../renderBudget.ts';
import type { Atom, Point } from './atomnic.ts';
/** Rebuilt with geometry, not for hover. Each point visits only its occupied cell. */
export function brushHitIndex(list:readonly Atom[]){
  const size=Math.max(1,...list.map(atom=>atom.radius*2)),cells=new Map<string,Atom[]>(),groups=new Map<string,string[]>();
  for(const atom of list){
    const members=groups.get(atom.group)??[];members.push(atom.id);groups.set(atom.group,members);
    for(let x=Math.floor((atom.x-atom.radius-1e-7)/size);x<=Math.floor((atom.x+atom.radius+1e-7)/size);x++)for(let y=Math.floor((atom.y-atom.radius-1e-7)/size);y<=Math.floor((atom.y+atom.radius+1e-7)/size);y++){
      const key=`${x}:${y}`,cell=cells.get(key)??[];cell.push(atom);cells.set(key,cell);
    }
  }
  let lastHits:readonly string[]=[],lastMacro:boolean|undefined,lastResult:ReadonlySet<string>=new Set();
  return (point:Point,macro:boolean):ReadonlySet<string>=>{
    const hits=(cells.get(`${Math.floor(point.x/size)}:${Math.floor(point.y/size)}`)??[]).filter(atom=>Math.hypot(point.x-atom.x,point.y-atom.y)<=atom.radius+1e-7);
    const keys=hits.map(atom=>macro?atom.group:atom.id);if(macro===lastMacro&&keys.length===lastHits.length&&keys.every((key,index)=>key===lastHits[index]))return lastResult;
    const result=new Set<string>();for(const atom of hits)for(const id of macro?groups.get(atom.group)!:[atom.id])result.add(id);
    lastHits=keys;lastMacro=macro;lastResult=result;return result;
  };
}
/** Pointer-only SVG feedback; no composition regeneration or preview publication. */
export function svgBrushFeedback(svg:SVGSVGElement,list:readonly Atom[],radius:number,color:string,hoverEnabled=true){
  const ns='http://www.w3.org/2000/svg',root=document.createElementNS(ns,'g');
  root.setAttribute('data-visual-selector','');root.setAttribute('pointer-events','none');
  const ghost=document.createElementNS(ns,'circle');ghost.setAttribute('r',String(radius));ghost.setAttribute('fill',color);ghost.setAttribute('opacity','.3');ghost.style.visibility='hidden';root.append(ghost);
  const index=new Map(hoverEnabled?list.map(atom=>[atom.id,atom]):[]),shown=new Map<string,SVGCircleElement>(),free:SVGCircleElement[]=[];
  for(let i=0;i<Math.min(RENDER_BUDGET.omnicAnimatedRoles,hoverEnabled?list.length:0);i++){const node=document.createElementNS(ns,'circle');node.setAttribute('fill','none');node.setAttribute('stroke','#ffe45c');node.setAttribute('stroke-width','.75');node.style.visibility='hidden';root.append(node);free.push(node);}
  svg.append(root);let last:Point|undefined,lastIds:ReadonlySet<string>|undefined;
  return {
    ghost(point:Point|undefined){if(point?.x===last?.x&&point?.y===last?.y)return;last=point;ghost.style.visibility=point?'visible':'hidden';if(point){ghost.setAttribute('cx',String(point.x));ghost.setAttribute('cy',String(point.y));}},
    hover(ids:ReadonlySet<string>){
      if(ids===lastIds)return;lastIds=ids;
      for(const [id,node] of shown)if(!ids.has(id)){node.style.visibility='hidden';shown.delete(id);free.push(node);}
      for(const id of ids){if(shown.has(id))continue;if(!free.length)break;const atom=index.get(id),node=free.pop();if(!atom||!node){if(node)free.push(node);continue;}node.setAttribute('cx',String(atom.x));node.setAttribute('cy',String(atom.y));node.setAttribute('r',String(atom.radius+1.5));node.style.visibility='visible';shown.set(id,node);}
    },dispose(){root.remove();},
  };
}
