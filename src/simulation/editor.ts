import {createOccupancy} from '../graph/occupancy.ts';
import './simulation.css';
import {panel} from '../ui/panel.ts';
import {locate,type World,type Origin} from '../core/model.ts';
import {childNode} from '../core/nodeOperations.ts';
import {resolveCircuit,writeCircuit} from './design.ts';
import {GATES,OPS,compile,evaluate,tick,result,reference,type Circuit,type Gate,type Kind,type Signal,type Stimulus} from './circuit.ts';
import {starterCircuit} from './starter.ts';
type Host={read:()=>World;change:(edit:(world:World)=>void)=>void;subscribe:(fn:()=>void)=>()=>void;open:(origin:Origin)=>void;feedback:(message:string)=>void};
const NS='http://www.w3.org/2000/svg',W=112,H=42;
function html<K extends keyof HTMLElementTagNameMap>(tag:K,cls=''){const node=document.createElement(tag);node.className=cls;return node;}
function svg<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>){const node=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));return node;}
export function simulationPanel(origin:Origin,host:Host){
 let stopped=false,stop=()=>{},job=0;
 const view=panel('ALU simulation',()=>{stopped=true;job++;stop();window.removeEventListener('blur',cancelGesture);});view.root.classList.add('alu-panel');
 const controls=html('div','alu-controls'),score=html('output'),actions=html('div','alu-controls'),status=html('output'),work=html('div','alu-work'),canvas=svg('svg',{'aria-label':'Editable ALU circuit',tabindex:0}),inspector=html('div','alu-inspector');
 work.append(canvas,inspector);view.body.append(controls,score,actions,status,work);
 let circuit:Circuit,plan:ReturnType<typeof compile>,values=new Map<string,Signal>(),selected:string|undefined,wire:string|undefined,filter='Bit 0',steps=0,signature='',editable=false;
 let box={x:-70,y:-260,w:1250,h:3150};
 const stimulus:Stimulus={a:5,b:3,op:0},baseline=compile(starterCircuit());
 const button=(parent:HTMLElement,label:string,run:()=>void)=>{const b=html('button');b.type='button';b.textContent=label;b.onclick=()=>{try{run();}catch(error){message(error);}};parent.append(b);return b;};
 const message=(error:unknown)=>{status.textContent=error instanceof Error?error.message:String(error);};
 const raw=()=>locate(host.read(),origin);
 const commit=(edit:(next:Circuit)=>void)=>{try{job++;host.change(world=>{const node=locate(world,origin);if(!node)throw Error('Simulation node was removed.');const next=resolveCircuit(node,world);edit(next);writeCircuit(node,world,next);});}catch(error){message(error);draw();}};
 function showResult(){if(!plan)return;const out=result(circuit,values),expected=reference(stimulus);score.textContent=`R ${out.value??'X'} · C ${out.carry??'X'} Z ${out.zero??'X'} N ${out.negative??'X'} V ${out.overflow??'X'} · ${steps?'tick '+steps:JSON.stringify(out)===JSON.stringify(expected)?'PASS':'Mismatch / unsettled'} | Gates ${plan.components} (${plan.components-baseline.components>=0?'+':''}${plan.components-baseline.components}) · Delay ${plan.delay} units (starter ${baseline.delay}) · Wires ${plan.wires} · Unused ${plan.unused}`;}
 const paints:(()=>void)[]=[];
 const paintSignals=()=>{for(const paint of paints)paint();};
 const state=(id:string)=>values.get(id)??null;
 const ink=(signal:Signal)=>signal===1?'#42ffa2':signal===0?'#657f92':'#ffb454';
 function settle(redraw=false){if(!plan)return;values=evaluate(plan,stimulus);steps=0;showResult();if(redraw)draw();else {paintSignals();describe();}}
 for(const key of ['a','b'] as const){const label=html('label');label.textContent=key.toUpperCase();const input=html('input');input.type='number';input.min='0';input.max='255';input.step='1';input.value=String(stimulus[key]);input.setAttribute('aria-label',`Operand ${key.toUpperCase()}`);input.oninput=()=>{if(!input.value.trim()||!input.checkValidity())return;stimulus[key]=Number(input.value);job++;settle();};label.append(input);controls.append(label);}
 const operation=html('select');operation.setAttribute('aria-label','ALU operation');OPS.forEach((op,i)=>{const option=html('option');option.value=String(i);option.textContent=`${i} ${op}`;operation.append(option);});operation.onchange=()=>{stimulus.op=Number(operation.value);job++;settle();};controls.append(operation);
 button(controls,'Branch',()=>{let branch:Origin|undefined;host.change(world=>{const parent=locate(world,origin);if(!parent)throw Error('Simulation node was removed.');const occupied=createOccupancy(world.nodes.map(n=>[JSON.stringify(n.origin),{x:n.position[0],y:n.position[1],z:n.position[2]}] as const));let at:[number,number,number]=[parent.position[0]+2,parent.position[1]-2,parent.position[2]];while(!occupied.free({x:at[0],y:at[1],z:at[2]}))at=[at[0]+2,at[1],at[2]];const node=childNode(world,origin,true,at);node.label='ALU branch';node.overrides=['label'];node.alu={version:1,deltas:{}};branch=node.origin;});if(branch)host.open(branch);});
 button(controls,'Reset signals',()=>{job++;values=new Map();steps=0;showResult();paintSignals();});
 button(controls,'Step',()=>{job++;values=tick(plan,stimulus,values);steps++;showResult();paintSignals();});button(controls,'Settle',settle);
 const group=html('select');group.setAttribute('aria-label','Circuit group');for(const name of ['All','Control',...Array.from({length:8},(_,i)=>`Bit ${i}`)]){const option=html('option');option.textContent=name;group.append(option);}group.value=filter;group.onchange=()=>{filter=group.value;fit();};controls.append(group);
 button(controls,'Fit',()=>fit());
 const check=button(controls,'Check functions',()=>{
  const epoch=++job,p=plan,c=circuit;let index=0,failed=0,first='';check.disabled=true;
  const run=()=>{if(stopped||job!==epoch){check.disabled=false;return;}const end=Math.min(1792,index+32);for(;index<end;index++){const op=index%7,n=Math.floor(index/7),s={a:n,b:(n*73+19)&255,op},actual=result(c,evaluate(p,s));if(JSON.stringify(actual)!==JSON.stringify(reference(s))){failed++;if(!first)first=`${OPS[op]} A=${s.a} B=${s.b}`;}}status.textContent=`Checks ${index}/1792 · ${failed} failed${first?' · first '+first:''}`;if(index<1792)requestAnimationFrame(run);else check.disabled=false;};run();
 });
 const kind=html('select');kind.setAttribute('aria-label','New gate');for(const name of Object.keys(GATES)){const option=html('option');option.textContent=name;kind.append(option);}kind.value='AND';actions.append(kind);
 const add=button(actions,'Add gate',()=>commit(next=>{const id=`g-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,k=kind.value as Kind;next.gates.push({id,kind:k,inputs:Array(GATES[k].pins).fill(null),x:box.x+box.w/2,y:box.y+box.h/2,group:filter==='All'?'Control':filter,label:k});selected=id;}));
 const remove=button(actions,'Delete selected',()=>{if(!selected)return;const id=selected;commit(next=>{next.gates=next.gates.filter(g=>g.id!==id).map(g=>({...g,inputs:g.inputs.map(source=>source===id?null:source)}));selected=undefined;});});
 const reset=button(actions,'Reset to starter',()=>host.change(world=>{const node=locate(world,origin);if(node?.alu)node.alu={version:1,base:starterCircuit(),deltas:{}};}));
 button(actions,'Cancel wire',()=>{wire=undefined;status.textContent='';draw();});
 const baselineNote=html('span');baselineNote.textContent='Classic ripple carry · 8 bit · ports: output → input · drag background to pan';actions.append(baselineNote);
 function visible(){return circuit.gates.filter(g=>filter==='All'||g.group===filter);}
 function fit(){const nodes=visible();if(!nodes.length)return;const x=Math.min(...nodes.map(g=>g.x))-60,y=Math.min(...nodes.map(g=>g.y))-50;box={x,y,w:Math.max(...nodes.map(g=>g.x+W))-x+60,h:Math.max(...nodes.map(g=>g.y+H))-y+60};viewport();draw();}
 function viewport(){canvas.setAttribute('viewBox',`${box.x} ${box.y} ${box.w} ${box.h}`);}
 function point(e:MouseEvent){const matrix=canvas.getScreenCTM();if(!matrix)throw Error('Circuit view is unavailable.');return new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());}
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=point(e),factor=e.deltaY>0?1.15:1/1.15;if(box.w*factor<150||box.w*factor>20000)return;box={x:p.x+(box.x-p.x)*factor,y:p.y+(box.y-p.y)*factor,w:box.w*factor,h:box.h*factor};viewport();},{passive:false});
 let gesture:{id:number;at:DOMPoint;before:typeof box;gate?:Gate;group?:SVGGElement}|undefined;
 canvas.onpointerdown=e=>{if(e.button!==0||e.target!==canvas)return;e.preventDefault();gesture={id:e.pointerId,at:point(e),before:{...box}};canvas.setPointerCapture(e.pointerId);};
 canvas.onpointermove=e=>{if(!gesture)return;const p=point(e);if(gesture.gate){gesture.group!.setAttribute('transform',`translate(${gesture.gate.x+p.x-gesture.at.x},${gesture.gate.y+p.y-gesture.at.y})`);}else{box.x-=p.x-gesture.at.x;box.y-=p.y-gesture.at.y;viewport();}};
 canvas.onpointerup=e=>{const g=gesture;gesture=undefined;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(!g?.gate)return;const p=point(e),id=g.gate.id;commit(next=>{const node=next.gates.find(gate=>gate.id===id)!;node.x=g.gate!.x+p.x-g.at.x;node.y=g.gate!.y+p.y-g.at.y;});draw();};
 function cancelGesture(){if(gesture&&!gesture.gate)box=gesture.before;gesture=undefined;viewport();draw();}
 canvas.onpointercancel=cancelGesture;window.addEventListener('blur',cancelGesture);
 function draw(){
  if(!plan)return;paints.length=0;canvas.replaceChildren();const shown=visible(),ids=new Set(shown.map(g=>g.id));
  const dependent=new Set<string>(),stack=selected?[selected]:[];while(stack.length){const id=stack.pop()!;if(dependent.has(id))continue;dependent.add(id);for(const source of plan.gates.get(id)?.inputs??[])if(source)stack.push(source);}
  const affected=new Set<string>(selected?[selected]:[]);for(const g of plan.order)if(g.inputs.some(id=>id!==null&&affected.has(id)))affected.add(g.id);
  for(const target of shown)target.inputs.forEach((id,pin)=>{if(!id||!ids.has(id))return;const source=plan.gates.get(id)!;const path=svg('path',{d:`M ${source.x+W} ${source.y+H/2} L ${target.x} ${target.y+(pin+1)*H/(target.inputs.length+1)}`,stroke:ink(state(id)),'stroke-width':dependent.has(target.id)||affected.has(id)?3:1.5,fill:'none'});paints.push(()=>path.setAttribute('stroke',ink(state(id))));path.setAttribute('aria-label',`${source.label} to ${target.label} input ${pin}`);path.onpointerdown=e=>{e.stopPropagation();if(editable)commit(next=>{next.gates.find(g=>g.id===target.id)!.inputs[pin]=null;});};canvas.append(path);});
  for(const g of shown){const node=svg('g',{transform:`translate(${g.x},${g.y})`}),rect=svg('rect',{width:W,height:H,rx:5,fill:selected===g.id?'#233b4e':'#101c29',stroke:selected===g.id?'#ff0':dependent.has(g.id)?'#fff':affected.has(g.id)?'#59baff':ink(state(g.id))});const label=svg('text',{x:8,y:17,fill:'#fff','font-size':11});label.textContent=g.label.slice(0,17);const detail=svg('text',{x:8,y:32,fill:ink(state(g.id)),'font-size':10});detail.textContent=`${g.kind} · ${state(g.id)??'X'}`;node.append(rect,label,detail);paints.push(()=>{rect.setAttribute('stroke',selected===g.id?'#ff0':dependent.has(g.id)?'#fff':affected.has(g.id)?'#59baff':ink(state(g.id)));detail.textContent=`${g.kind} · ${state(g.id)??'X'}`;});
   node.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();selected=g.id;describe();if(editable){gesture={id:e.pointerId,at:point(e),before:{...box},gate:{...g},group:node};canvas.setPointerCapture(e.pointerId);}else{draw();}};
   g.inputs.forEach((id,pin)=>{const port=svg('circle',{cx:0,cy:(pin+1)*H/(g.inputs.length+1),r:6,fill:ink(id?state(id):null),stroke:'#fff'});paints.push(()=>port.setAttribute('fill',ink(id?state(id):null)));port.setAttribute('aria-label',`${g.label} input ${pin}`);port.onpointerdown=e=>{e.stopPropagation();if(!editable)return;selected=g.id;if(wire){const from=wire;wire=undefined;commit(next=>{next.gates.find(n=>n.id===g.id)!.inputs[pin]=from;});}else describe();};node.append(port);});
   const output=svg('circle',{cx:W,cy:H/2,r:6,fill:ink(state(g.id)),stroke:wire===g.id?'#ff0':'#fff'});paints.push(()=>output.setAttribute('fill',ink(state(g.id))));output.setAttribute('aria-label',`${g.label} output`);output.onpointerdown=e=>{e.stopPropagation();if(!editable)return;wire=g.id;status.textContent=`Wire from ${g.label}: choose an input`;draw();};node.append(output);canvas.append(node);
  }
  describe();
 }
 function describe(){inspector.replaceChildren();const g=selected&&plan.gates.get(selected);if(!g)return;const title=html('strong');title.textContent=`${g.label} · ${g.kind} · ${state(g.id)??'X'}`;inspector.append(title);
  if(g.kind==='IN'||g.kind==='OUT'){
   const port=html('select');port.disabled=!editable;port.setAttribute('aria-label',g.kind==='IN'?'Input source':'Output port');
   const labels=g.kind==='IN'?['0','1',...Array.from({length:8},(_,i)=>`A${i}`),...Array.from({length:8},(_,i)=>`B${i}`),'O0','O1','O2']:[...Array.from({length:8},(_,i)=>`R${i}`),'C','Z','N','V'];
   for(const label of [g.label,...labels.filter(label=>label!==g.label)]){const option=html('option');option.textContent=label;port.append(option);}port.value=g.label;port.onchange=()=>commit(next=>{next.gates.find(n=>n.id===g.id)!.label=port.value;});inspector.append(port);
  }else{const name=html('input');name.value=g.label;name.disabled=!editable;name.setAttribute('aria-label','Component label');name.onchange=()=>commit(next=>{next.gates.find(n=>n.id===g.id)!.label=name.value;});inspector.append(name);}
  const type=html('select');type.disabled=!editable;type.setAttribute('aria-label','Component type');for(const k of Object.keys(GATES)){const option=html('option');option.textContent=k;type.append(option);}type.value=g.kind;type.onchange=()=>commit(next=>{const n=next.gates.find(n=>n.id===g.id)!;n.kind=type.value as Kind;n.inputs=Array.from({length:GATES[n.kind].pins},(_,i)=>n.inputs[i]??null);});inspector.append(type);
  g.inputs.forEach((id,pin)=>{const row=html('div');row.textContent=`${pin}: ${id?plan.gates.get(id)?.label:'Unconnected'} = ${id?state(id)??'X':'X'}`;button(row,'Disconnect',()=>commit(next=>{next.gates.find(n=>n.id===g.id)!.inputs[pin]=null;})).disabled=!editable;inspector.append(row);});
 }
 function refresh(){const node=raw();if(!node){view.close();return;}const ancestry:unknown[]=[];let current:typeof node|undefined=node;const seen=new Set<string>();while(current){const id=JSON.stringify(current.origin);if(seen.has(id))break;seen.add(id);ancestry.push(current.alu??null);current=current.variantOf?host.read().nodes.find(n=>JSON.stringify(n.origin)===JSON.stringify(current!.variantOf)):undefined;}
  const next=JSON.stringify(ancestry);view.setTitle(`${node.label||'ALU'} · simulation`);editable=!!node.alu;add.disabled=remove.disabled=reset.disabled=kind.disabled=!editable;
  if(next===signature)return;signature=next;job++;check.disabled=false;
  try{circuit=resolveCircuit(node,host.read());plan=compile(circuit);status.textContent=editable?'Editable branch':'Protected starter · Branch to edit';settle(true);}catch(error){check.disabled=true;canvas.replaceChildren();message(error);}
 }
 stop=host.subscribe(refresh);refresh();if(plan!)fit();else viewport();
 return view;
}
