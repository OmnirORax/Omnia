import type {OmnicSurface} from './surface.ts';
import {degreeEditor} from './degreeEditor.ts';
import {createPlaybackClock} from './playbackClock.ts';
import {componentAttachments,detachComponentAttachment} from './componentAttachments.ts';
import {filledRegionShape,regionAttachmentCandidates,prepareRegionFill} from './fillRegion.ts';
import {targetNodes,targetBounds} from './contextGeometry.ts';
import {operationTool} from './tools.ts';
import {recipeSpecification} from './specification.ts';
import {defaultGeometrySelection,prepareGeometrySelection,combineGeometrySelection} from './selection.ts';
import {PATTERN_MODES,PATTERN_SYMBOLS,type Point} from '../appearance/selectionGeometry.ts';
import {snapTurn,turnDelta,divisions} from '../properties/halving.ts';
import {paintSamples} from './paintStroke.ts';
import {insertConstruction,applyOperationTool,isOperationTool} from './tools.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';
import {panel} from '../ui/panel.ts';
import {field} from '../ui/fields.ts';
import {liveForm} from '../ui/liveForm.ts';
import {property,type Value} from '../properties/pool.ts';
import {addStructure,locate,type Origin,type World} from '../core/model.ts';
import {childNode} from '../core/nodeOperations.ts';
import {validateRecipe,type Recipe,type Application} from './model.ts';
import {GENERATORS,OPERATORS,defaultParams,type Parameter} from './registry.ts';
import {createRecipe,PRESETS} from './presets.ts';
import {evaluateRecipe} from './evaluate.ts';
import {renderSVG,evaluationBounds,pickStructuralNode,structuralIdsInRect} from './svg.ts';
import {definitionRecipe,definitionResolver,saveDefinition,addReference} from './atlas.ts';
import {componentIndex,deleteComponents,rootTargets} from './componentTargets.ts';
import {authoredNodeOwners} from './contextGeometry.ts';
import {selectedEditOwners} from './msSelection.ts';
import {targetEditorDegrees,selectedEditorDegrees,targetDegreeValue,translateTargets} from './targetDegrees.ts';
import {addAtom,eraseAtomsAlong,rotateAtoms,ungroupAtoms,atomnicSettings,atomnicEditable,atoms} from './atomnic.ts';
import {ATOMNIC_PARAMETERS,atomnicViewBounds} from './atomnicSettings.ts';
import {readPathRule,appendPathDirection,type PathRule} from './pathRule.ts';
export type ComposerHost={surface?:(surface:OmnicSurface)=>()=>void;redraw?:()=>void;read:()=>World;change:(edit:(world:World)=>void,group?:string)=>void;select:(origin:Origin)=>void;feedback:(message:string)=>void;subscribe:(listener:()=>void)=>()=>void};
const newRecipe=():Recipe=>({version:2,revision:0,atomnic:{active:true},components:[{id:'unit',generator:'dot',params:{size:10,color:'#ffffff',thickness:.25}}],operations:[],frames:[]});
export function composerPanel(host:ComposerHost,initial?:Origin){
 let referencePick:((id:string)=>void)|undefined,scopeSelection:string[]=[],origin=initial,recipe=structuredClone(initial?(locate(host.read(),initial)?.omnicDraft??definitionRecipe(locate(host.read(),initial)!,host.read())??newRecipe()):newRecipe());
 let releaseSurface:(()=>void)|undefined,external=false;const externalPoints=new WeakMap<Event,Point>();
 let moveFrame=0,pendingMove:PointerEvent|undefined,cachedRecipe:Recipe|undefined,cachedWorld:World|undefined,cachedClock=-1,cachedEvaluation:ReturnType<typeof evaluateRecipe>|undefined;
 let alive=true,selected=new Set<string>(),past:Recipe[]=[],future:Recipe[]=[],lastGroup='',writeGroup='',tool:'select'|'draw'|'erase'|'rotate'|'geometry'|'fill'='select',clock=0,raf=0,lastFrame=0,playing=false,menu:HTMLElement|undefined;
 let geometry=defaultGeometrySelection(),combination:'replace'|'include'|'exclude'|'intersect'|'toggle'='replace',geometrySession:ReturnType<typeof prepareGeometrySelection>|undefined,geometryBase=new Set<string>(),path:Point[]=[],polygon:Point[]=[];
 let bounds=(atomnicViewBounds(recipe.atomnic)??evaluationBounds(evaluate())),pointer:{id:number;start:{x:number;y:number};last:{x:number;y:number};base:Recipe;owners:string[];moved:boolean;pivot?:Point;lastAngle:number;turn:number}|undefined;
 const view=panel('Omnic',()=>{alive=false;releaseSurface?.();if(moveFrame)cancelAnimationFrame(moveFrame);if(raf)cancelAnimationFrame(raf);unsubscribe();});view.root.classList.add('omnic-composer');
 const toolbar=document.createElement('nav'),layout=document.createElement('div'),tree=document.createElement('div'),canvas=document.createElement('div'),error=document.createElement('output'),name=document.createElement('input');
 name.value=initial?locate(host.read(),initial)?.label??'':'';name.placeholder='Name';name.setAttribute('aria-label','Structure name');let lastLabel=name.value;layout.className='omnic-layout';tree.className='omnic-tree';canvas.className='omnic-canvas';canvas.tabIndex=0;layout.append(tree,canvas);view.body.append(toolbar,layout,error);
 const attempt=(run:()=>void)=>{try{error.textContent='';run();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}};
 function button(label:string,run:()=>void,parent:HTMLElement=toolbar){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>attempt(run);parent.append(b);return b;}
 function draft(){host.change(world=>{world.version=3;origin??=addStructure(world,[0,0,0]).origin;const node=locate(world,origin);if(!node)throw Error('Draft owner was removed.');node.omnicDraft=recipe;},`composer:${JSON.stringify(origin)}`);}
 function commit(next:Recipe,group=writeGroup){
  next=validateRecipe({...next,version:2});if(JSON.stringify(recipe)===JSON.stringify(next))return;
  if(!group||group!==lastGroup){past=[...past,recipe].slice(-50);future=[];}lastGroup=group;recipe=next;draft();render();
 }
 function save(variant=false){host.change(world=>{
  if(variant){if(origin&&recipeSpecification(recipe)===recipeSpecification(definitionRecipe(locate(world,origin)!,world)!))throw Error('Change the definition before saving a variant.');if(!origin||!definitionRecipe(locate(world,origin)!,world))throw Error('Save the base definition first.');origin=childNode(world,origin,true).origin;}
  origin=saveDefinition(world,origin,recipe,name.value);const node=locate(world,origin)!;recipe=structuredClone(definitionRecipe(node,world)!);name.value=node.label;lastLabel=node.label;
 });host.select(origin!);render();}
 function evaluate(){const world=host.read();if(cachedEvaluation&&cachedRecipe===recipe&&cachedWorld===world&&cachedClock===clock)return cachedEvaluation;cachedRecipe=recipe;cachedWorld=world;cachedClock=clock;return cachedEvaluation=evaluateRecipe(recipe,definitionResolver(world),clock);}
 function owners(){const operations=[...selected].filter(id=>recipe.operations.some(op=>op.id===id)),evaluation=evaluate(),map=authoredNodeOwners(recipe,evaluation),roles=new Set(targetNodes(evaluation,[...selected]).map(node=>node.id));return [...new Set([...selectedEditOwners(evaluation.nodes,map,roles),...[...selected].filter(id=>componentIndex(recipe).has(id)),...operations])];}
 function showMenu(event?:MouseEvent,shapesOnly=false){
  menu?.remove();menu=document.createElement('div');menu.className='omnic-menu';view.body.append(menu);
  if(event){const rect=view.root.getBoundingClientRect();menu.style.left=`${Math.max(4,Math.min(rect.width-240,event.clientX-rect.left))}px`;menu.style.top=`${Math.max(30,Math.min(rect.height-240,event.clientY-rect.top))}px`;}
  const search=document.createElement('input');search.type='search';search.placeholder='Search';menu.append(search);const body=document.createElement('div');menu.append(body);
  const entries:Array<{label:string;run:()=>void;searchOnly?:boolean;shape?:boolean}>=[];
  const form=(parameters:readonly Parameter[],read:()=>Record<string,Value>,write:(values:Record<string,Value>)=>void)=>{
   body.replaceChildren();const root=document.createElement('form');body.append(root);const fields=parameters.filter(p=>!p.internal).map(p=>{const entry=field(property({key:`omnic.${p.property}`,label:p.label,kind:p.kind,min:p.min,max:p.max,step:p.step,options:p.options,unit:p.unit}),read()[p.key]??p.initial);root.append(entry.row);if(p.editor==='path-rule')button('Path',()=>pathEditor(String(read()[p.key]??p.initial),value=>write({...read(),[p.key]:value})),entry.row);return{p,entry};});
   liveForm(root,group=>attempt(()=>{const next={...read()};for(const {p,entry} of fields)next[p.key]=entry.value();writeGroup=group;write(next);writeGroup='';}));
  };
  const degrees=selectedEditorDegrees(recipe,owners());
  const degreeEntries=degrees.map(degree=>({label:degree.label,visual:degree.group?.some(group=>group.id==='visual'),run:()=>degreeEditor(body,degree,{read:()=>recipe,write:commit,resolve:()=>definitionResolver(host.read()),bounds:()=>bounds,path:pathEditor,error:message=>{error.textContent=message;},pick:accept=>{referencePick=accept;canvas.focus();}})}));
  for(const entry of degreeEntries.filter(entry=>!entry.visual))entries.push(entry);
  const appearance=degreeEntries.filter(entry=>entry.visual);if(appearance.length)entries.push({label:'👁',run:()=>{body.replaceChildren();for(const entry of appearance)button(entry.label,entry.run,body);}});
  for(const entry of appearance)entries.push({...entry,label:`👁 ${entry.label}`,searchOnly:true});

  for(const definition of GENERATORS.filter(d=>!d.derived&&d.id!=='reference'))entries.push({label:`＋ ${definition.label}`,shape:true,run:()=>{const id=crypto.randomUUID();commit({...recipe,components:[...recipe.components,{id,generator:definition.id,params:defaultParams(definition)}]});selected=new Set([id]);menu?.remove();render();}});
  for(const definition of OPERATORS)entries.push({label:definition.label,run:()=>{const op:Application={id:crypto.randomUUID(),operator:definition.id,params:defaultParams(definition),targets:[...selected],enabled:true};commit({...recipe,operations:[...recipe.operations,op]});selected=new Set([op.id]);showMenu(event);}});
  entries.push({label:'Atomnic',run:()=>form(ATOMNIC_PARAMETERS,()=>atomnicSettings(recipe),atomnic=>commit({...recipe,atomnic}))});
  entries.push({label:'Reference',shape:true,run:()=>references(body)});
  entries.push({label:'Selection',run:()=>selectionSettings(body)});
  entries.push({label:'Frame',run:()=>frameEditor(body)});
  entries.push({label:'Fill region',run:()=>{tool='fill';menu?.remove();canvas.focus();}});
  for(const attachment of componentAttachments(recipe,evaluate(),owners()))entries.push({label:`Detach ${attachment.label}`,run:()=>{const next=detachComponentAttachment(recipe,attachment.id,definitionResolver(host.read()));commit(next.recipe);selected=new Set([next.id]);menu?.remove();render();}});
  for(const operation of recipe.operations.filter(op=>selected.has(op.id))){entries.push({label:'Set scope to selection',run:()=>commit({...recipe,operations:recipe.operations.map(op=>op.id===operation.id?{...op,targets:scopeSelection}:op)})});entries.push({label:'Save as tool',run:()=>{let saved:Origin|undefined;host.change(world=>{saved=saveDefinition(world,undefined,operationTool(operation),operation.operator);});host.select(saved!);}});}
  entries.push({label:'Insert construction',run:()=>constructions(body)});
  entries.push({label:'Group',run:()=>{const ids=new Set(rootTargets(recipe,owners())),components=recipe.components.filter(c=>ids.has(c.id));if(!components.length)throw Error('Select complete authored components first.');const group={id:crypto.randomUUID(),generator:'group',params:{x:0,y:0},children:components};commit({...recipe,components:[...recipe.components.filter(c=>!ids.has(c.id)),group]});selected=new Set([group.id]);menu?.remove();render();}});
  entries.push({label:'Delete',run:()=>{removeSelected();menu?.remove();}});
  entries.push({label:'Ungroup',run:()=>commit(ungroupAtoms(recipe,selected))});
  for(const preset of PRESETS)entries.push({label:`Preset · ${preset.label}`,run:()=>{commit(createRecipe(preset.id));selected.clear();bounds=(atomnicViewBounds(recipe.atomnic)??{x:-100,y:-100,width:200,height:200});menu?.remove();render();}});
  const filter=()=>{body.replaceChildren();const q=search.value.toLocaleLowerCase();for(const entry of entries.filter(entry=>(!shapesOnly||entry.shape)&&(!entry.searchOnly||q)&&entry.label.toLocaleLowerCase().includes(q)))button(entry.label,entry.run,body);};search.oninput=filter;search.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();body.querySelector<HTMLButtonElement>('button')?.click();}};filter();search.focus();
 }
 function selectionSettings(body:HTMLElement){
  body.replaceChildren();const form=document.createElement('form');body.append(form);
  const entries=[field({key:'mode',label:'Shape',kind:'select',options:PATTERN_MODES.map(id=>({id,label:`${PATTERN_SYMBOLS[id]} ${id}`}))},geometry.mode),field({key:'region',label:'Region',kind:'select',options:['inside','outside','both'].map(id=>({id,label:id}))},geometry.region),field({key:'contour',label:'Contour',kind:'toggle'},geometry.contour),field({key:'bounded',label:'Bounded',kind:'toggle'},geometry.bounded),field({key:'rotation',label:'Rotation',kind:'number'},geometry.rotation),field({key:'combine',label:'Combine',kind:'select',options:['replace','include','exclude','intersect','toggle'].map(id=>({id,label:id}))},combination)];for(const entry of entries)form.append(entry.row);
  form.oninput=()=>{geometry={...geometry,mode:entries[0].value() as typeof geometry.mode,region:entries[1].value() as typeof geometry.region,contour:Boolean(entries[2].value()),bounded:Boolean(entries[3].value()),rotation:Number(entries[4].value())};combination=entries[5].value() as typeof combination;};
  button('Use selection as scope',()=>{geometry.scope=[...selected];},body);button('Clear scope',()=>{geometry.scope=undefined;},body);button('Clear filters',()=>{geometry.criteria=[];},body);
  const snapshot=prepareGeometrySelection(evaluate(),geometry),first=[...selected][0];for(const pattern of snapshot.patterns(evaluate().nodes.find(n=>n.kind!=='group'&&(n.id===first||n.componentId===first))?.id??first)){button(`${pattern.rule.property} = ${pattern.rule.value}`,()=>{geometry.criteria=[...geometry.criteria.filter(rule=>rule.property!==pattern.rule.property),pattern.rule];},body);}
  button('Select',()=>{tool='geometry';menu?.remove();canvas.focus();},body);
 }
 function frameEditor(body:HTMLElement){body.replaceChildren();for(const frame of recipe.frames){const row=document.createElement('div');row.textContent=`${frame.property} · ${frame.state}`;button('×',()=>{commit({...recipe,frames:recipe.frames.filter(f=>f.id!==frame.id)});frameEditor(body);},row);body.append(row);}
  for(const degree of targetEditorDegrees(recipe,owners()))for(const axis of degree.axes??[degree])for(const state of ['inactive','unspecified','specified'] as const)button(`${axis.label} · ${state}`,()=>{commit({...recipe,frames:[...recipe.frames,{id:crypto.randomUUID(),property:axis.properties[0],state,scope:[...selected],...(state==='specified'?{value:targetDegreeValue(recipe,axis)}:{})}]});frameEditor(body);},body);
 }
 function constructions(body:HTMLElement){body.replaceChildren();for(const node of host.read().nodes){const source=definitionRecipe(node,host.read());if(!node.invariant||!source)continue;button(node.label||'⚬',()=>{const next=isOperationTool(source)?{recipe:applyOperationTool(recipe,source,[...selected],()=>crypto.randomUUID()),ids:[],roots:[]}:insertConstruction(recipe,source,{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},()=>crypto.randomUUID());commit(next.recipe);selected=new Set(next.roots);menu?.remove();render();},body);}}
 function regionFill(base:Recipe,start:Point,end:Point){
  const snapshot=evaluateRecipe(base,definitionResolver(host.read()),clock);if(snapshot.motion)throw Error('Pause motion before filling a region.');
  const ids=[...selected],nodes=targetNodes(snapshot,ids);if(!nodes.length)throw Error('Select the contributing structure first.');
  const points=[{x:Math.min(start.x,end.x),y:Math.min(start.y,end.y)},{x:Math.max(start.x,end.x),y:Math.min(start.y,end.y)},{x:Math.max(start.x,end.x),y:Math.max(start.y,end.y)},{x:Math.min(start.x,end.x),y:Math.max(start.y,end.y)}],shape=filledRegionShape(nodes,points),owners=authoredNodeOwners(base,snapshot),candidates=regionAttachmentCandidates(snapshot,owners,[...new Set(nodes.flatMap(node=>owners.get(node.id)??[]))],shape),mode=atomnicSettings(base).fillMode;
  const apply=(owner?:string)=>{if(recipe!==base)throw Error('The construction changed. Pick the region again.');const result=prepareRegionFill(snapshot,nodes,points,owner),id=crypto.randomUUID(),text=JSON.stringify(result.shape);commit(owner?{...base,operations:[...base.operations,{id,operator:'fill',enabled:true,targets:[owner],params:{fill:true,attachment:true,shape:text}}]}:{...base,components:[...base.components,{id,generator:'region',params:{shape:text,x:result.x!,y:result.y!}}]});selected=new Set([owner??id]);render();};
  if(mode==='object'){apply();return;}if(candidates.length===1){apply(candidates[0]);return;}if(!candidates.length)throw Error('No contributing attachment. Choose Separate object or another region.');
  const chooser=panel('Attach');for(const candidate of candidates)button(candidate,()=>{apply(candidate);chooser.close();},chooser.body);
 }
 function removeSelected(){const ids=new Set(owners());if(!ids.size&&selected.size)throw Error('Select complete authored components to remove them.');const next=deleteComponents(recipe,ids);next.operations=next.operations.filter(op=>!ids.has(op.id));commit(next);selected.clear();render();}
 function reorder(id:string,step:number){const next=structuredClone(recipe),index=componentIndex(next),entry=index.get(id)!;const list=entry.parent?index.get(entry.parent)!.component.children!:next.components,at=list.findIndex(c=>c.id===id),to=Math.max(0,Math.min(list.length-1,at+step));list.splice(to,0,list.splice(at,1)[0]);commit(next);}
 function references(body:HTMLElement){
  body.replaceChildren();const mode=document.createElement('select'),pinned=document.createElement('input');pinned.type='checkbox';for(const [value,label]of [['structure','⚬'],['position','●'],['follow','↫']]){const option=document.createElement('option');option.value=value;option.textContent=label;mode.append(option);}const label=document.createElement('label');label.textContent='Pinned';label.append(pinned);body.append(mode,label);
  for(const node of host.read().nodes.filter(node=>node.invariant&&definitionRecipe(node,host.read())))button(node.label||'⚬',()=>{let next:Recipe;host.change(world=>{next=addReference(recipe,locate(world,node.origin)!,world,mode.value as 'structure'|'position'|'follow',pinned.checked);});commit(next!);menu?.remove();},body);
 }
 function pathEditor(value:string,write:(value:string)=>void){
  const editor=panel('Path'),rows=document.createElement('div');editor.body.append(rows);let rule=readPathRule(value);
  const redraw=()=>{rows.replaceChildren();rule.s.forEach(([angle,count],index)=>{const row=document.createElement('div'),a=field({key:'angle',label:'Angle',kind:'number'},angle),n=field({key:'count',label:'Count',kind:'number',min:1,max:10000},count),form=document.createElement('form');form.append(a.row,n.row);row.append(form);button('×',()=>{rule={...rule,s:rule.s.filter((_,i)=>i!==index)};write(JSON.stringify(rule));redraw();},row);liveForm(form,()=>attempt(()=>{rule.s[index]=[Number(a.value()),Number(n.value())];rule=readPathRule(JSON.stringify(rule));write(JSON.stringify(rule));}));rows.append(row);});};
  button('+',()=>{rule=appendPathDirection(rule,0);write(JSON.stringify(rule));redraw();},editor.body);
  const flags:[keyof PathRule,string][]=[['l','Loop'],['c','Close'],['a','All'],['d','Dynamic']];for(const [key,label]of flags){const entry=field({key,label,kind:'toggle'},Boolean(rule[key]));editor.body.append(entry.row);entry.input.onchange=()=>attempt(()=>{rule=readPathRule(JSON.stringify({...rule,[key]:entry.value()}));write(JSON.stringify(rule));});}redraw();
 }
 function render(){
  if(!alive)return;const active=Boolean(atomnicSettings(recipe).active);modeButton.textContent=`Atomnic ${active?'on':'off'}`;modeButton.setAttribute('aria-pressed',String(active));for(const button of brushButtons)button.hidden=!active;if(!active&&['draw','erase','rotate'].includes(tool))tool='select';const evaluation=evaluate();error.textContent=evaluation.diagnostics.map(item=>item.code==='unresolved-object'?'Unresolved reference':item.message).join(' · ');
  const selectedRoles=targetNodes(evaluation,[...selected]).filter(node=>node.kind!=='group').map(node=>node.id);
  canvas.innerHTML=renderSVG({...evaluation,selection:selectedRoles},{bounds,pivot:pointer?.pivot,selected:selectedRoles,gridPitch:atomnicSettings(recipe).active?Number(atomnicSettings(recipe).size)*2:undefined});
  if((pointer||polygon.length)&&(tool==='fill'||tool==='geometry')){const svg=canvas.querySelector('svg')!,shape=document.createElementNS('http://www.w3.org/2000/svg','polyline'),a=pointer?.start??polygon[0],b=pointer?.last??polygon.at(-1)!,points=tool==='geometry'&&['polygon','freehand'].includes(geometry.mode)?path:[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y},a];shape.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));shape.setAttribute('fill','none');shape.setAttribute('stroke','#00d8ff');shape.setAttribute('stroke-width','1');shape.setAttribute('vector-effect','non-scaling-stroke');shape.setAttribute('pointer-events','none');svg.append(shape);}
  host.redraw?.();
  tree.replaceChildren();const index=componentIndex(recipe);
  for(const [id,{component}]of index){const row=document.createElement('div');button(component.generator,()=>{selected=new Set([id]);render();},row);let depth=0,parent=index.get(id)?.parent;while(parent){depth++;parent=index.get(parent)?.parent;}row.style.paddingLeft=`${depth*8}px`;row.dataset.selected=String(selected.has(id));row.oncontextmenu=event=>{event.preventDefault();selected=new Set([id]);showMenu(event);const body=menu!.lastElementChild as HTMLElement;button('↑',()=>reorder(id,-1),body);button('↓',()=>reorder(id,1),body);};tree.append(row);}
  for(const op of recipe.operations){const row=document.createElement('div');button(`${op.enabled?'✓ ':''}${op.operator}`,()=>{selected=new Set(op.targets);render();},row);button('◐',()=>commit({...recipe,operations:recipe.operations.map(item=>item.id===op.id?{...item,enabled:!item.enabled}:item)}),row);button('×',()=>commit({...recipe,operations:recipe.operations.filter(item=>item.id!==op.id)}),row);row.oncontextmenu=event=>{event.preventDefault();scopeSelection=[...selected].filter(id=>id!==op.id);selected=new Set([op.id]);showMenu(event);};tree.append(row);}
 }
 function point(event:PointerEvent|MouseEvent){const external=externalPoints.get(event);if(external)return external;const svg=canvas.querySelector('svg')!,rect=svg.getBoundingClientRect(),ratio=Math.min(rect.width/bounds.width,rect.height/bounds.height),x=(rect.width-bounds.width*ratio)/2,y=(rect.height-bounds.height*ratio)/2;return{x:bounds.x+(event.clientX-rect.left-x)/ratio,y:bounds.y+(event.clientY-rect.top-y)/ratio};}
 let pan:{id:number;x:number;y:number;bounds:typeof bounds}|undefined;
 canvas.onpointerdown=event=>{if(referencePick&&event.button===0){const hit=pickStructuralNode(evaluate().nodes,point(event));if(hit){const accept=referencePick;referencePick=undefined;attempt(()=>accept(authoredNodeOwners(recipe,evaluate()).get(hit.id)??hit.componentId));}event.preventDefault();return;}if(event.button===1){event.preventDefault();pan={id:event.pointerId,x:event.clientX,y:event.clientY,bounds:{...bounds}};if(!external)canvas.setPointerCapture(event.pointerId);return;}if(event.button!==0)return;canvas.focus();menu?.remove();const p=point(event),evaluation=evaluate(),hit=pickStructuralNode(evaluation.nodes,p);
  if(tool==='geometry'){if(geometry.mode!=='polygon'||!polygon.length){geometryBase=new Set(selected);geometrySession=prepareGeometrySelection(evaluation,geometry);}if(geometry.mode==='polygon'){polygon.push(p);path=[...polygon];}else path=[p];}
  if(tool==='select'&&hit){const id=event.ctrlKey||event.metaKey?hit.componentId:hit.id;if(!event.shiftKey&&!selected.has(id))selected.clear();if(event.shiftKey&&selected.has(id))selected.delete(id);else selected.add(id);}
  if(['draw','erase','rotate'].includes(tool)&&!atomnicEditable(recipe,evaluation)){error.textContent='Edit transformed geometry through its DOFs.';return;}
  const s=atomnicSettings(recipe),box=targetBounds(evaluation,owners());let pivot=p;
  if(tool==='rotate'&&s.pivotMode==='target'&&box){const angle=Number(s.axis)/divisions(Number(s.order))*Math.PI*2,ux=Math.sin(angle),uy=-Math.cos(angle),radius=Math.min(Math.abs(ux)>.00001?box.width/2/Math.abs(ux):Infinity,Math.abs(uy)>.00001?box.height/2/Math.abs(uy):Infinity),distance=(Number(s.position)*2-1)*radius;pivot={x:box.x+box.width/2+ux*distance,y:box.y+box.height/2+uy*distance};}
  const atomIds=new Set(atoms(recipe).map(atom=>atom.id));
  pointer={id:event.pointerId,start:p,last:p,base:recipe,owners:tool==='rotate'?owners().filter(id=>atomIds.has(id)):tool==='select'?rootTargets(recipe,owners()):[],moved:false,pivot:tool==='rotate'?pivot:undefined,lastAngle:Math.atan2(p.y-pivot.y,p.x-pivot.x)/(Math.PI*2),turn:0};if(!external)canvas.setPointerCapture(event.pointerId);render();
 };
 function move(event:PointerEvent){if(pan){const rect=canvas.getBoundingClientRect(),ratio=Math.max(pan.bounds.width/rect.width,pan.bounds.height/rect.height);bounds={...pan.bounds,x:pan.bounds.x-(event.clientX-pan.x)*ratio,y:pan.bounds.y-(event.clientY-pan.y)*ratio};render();return;}if(!pointer||event.pointerId!==pointer.id)return;const p=point(event);if(Math.hypot(p.x-pointer.start.x,p.y-pointer.start.y)>1)pointer.moved=true;
  attempt(()=>{if(tool==='fill'){pointer!.last=p;}else if(tool==='geometry'){if(geometry.mode==='polygon')path=[...polygon,p];else path.push(p);selected=combineGeometrySelection(geometryBase,geometrySession!.pick(pointer!.start,p,path),event.shiftKey?'include':combination);}else if(tool==='draw'){for(const sample of paintSamples(pointer!.last,p,Math.max(.25,Number(atomnicSettings(recipe).size)/2)))recipe=addAtom(recipe,sample,crypto.randomUUID());}else if(tool==='erase')recipe=eraseAtomsAlong(recipe,pointer!.last,p,atomnicSettings(recipe).scope==='macro');else if(tool==='rotate'){if(!pointer!.owners.length)throw Error('Select authored units for direct rotation.');const pivot=pointer!.pivot!,angle=Math.atan2(p.y-pivot.y,p.x-pivot.x)/(Math.PI*2);pointer!.turn+=turnDelta(pointer!.lastAngle,angle);pointer!.lastAngle=angle;recipe=rotateAtoms(pointer!.base,new Set(pointer!.owners),pivot,snapTurn(pointer!.turn,Number(atomnicSettings(recipe).order),Number(atomnicSettings(recipe).steps)));}else if(pointer!.owners.length){if(!atomnicEditable(recipe,evaluate()))throw Error('Edit transformed geometry through its DOFs.');recipe=translateTargets(pointer!.base,new Set(pointer!.owners),{x:p.x-pointer!.start.x,y:p.y-pointer!.start.y});}else{const ids=structuralIdsInRect(evaluate().nodes,pointer!.start,p);if(!event.shiftKey)selected.clear();for(const id of ids)selected.add(id);}pointer!.last=p;render();});
 };
 const flushMove=()=>{if(moveFrame)cancelAnimationFrame(moveFrame);moveFrame=0;const event=pendingMove;pendingMove=undefined;if(event)move(event);};
 canvas.onpointermove=event=>{pendingMove=event;if(!moveFrame)moveFrame=requestAnimationFrame(flushMove);};
 canvas.onpointerup=event=>{flushMove();if(pan){pan=undefined;return;}if(!pointer)return;const gesture=pointer;pointer=undefined;attempt(()=>{if(tool==='fill'){regionFill(gesture.base,gesture.start,point(event));return;}if(tool==='geometry'){if(geometry.mode==='polygon'){render();return;}const p=point(event);selected=combineGeometrySelection(geometryBase,geometrySession!.pick(gesture.start,p,path),event.shiftKey?'include':combination);geometrySession=undefined;render();return;}if(!gesture.moved&&tool==='select'&&!pickStructuralNode(evaluate().nodes,point(event))&&!event.shiftKey){selected.clear();render();}if(!gesture.moved&&tool==='draw')recipe=addAtom(recipe,point(event),crypto.randomUUID());if(!gesture.moved&&tool==='erase')recipe=eraseAtomsAlong(recipe,point(event),point(event),atomnicSettings(recipe).scope==='macro');const next=recipe;recipe=gesture.base;commit(next);});};
 canvas.onpointercancel=()=>{if(moveFrame)cancelAnimationFrame(moveFrame);moveFrame=0;pendingMove=undefined;pan=undefined;if(pointer){recipe=pointer.base;pointer=undefined;render();}};
 function finishPolygon(){if(polygon.length<3||!geometrySession)return;selected=combineGeometrySelection(geometryBase,geometrySession.pick(polygon[0],polygon.at(-1)!,polygon),combination);polygon=[];path=[];geometrySession=undefined;render();}
 canvas.ondblclick=()=>{if(tool==='geometry'&&geometry.mode==='polygon')finishPolygon();};
 canvas.oncontextmenu=event=>{event.preventDefault();event.stopPropagation();const hit=pickStructuralNode(evaluate().nodes,point(event));if(hit&&!selected.has(hit.id)&&!selected.has(hit.componentId))selected=new Set([hit.componentId]);showMenu(event);render();};
 canvas.onwheel=event=>{event.preventDefault();const factor=Math.exp(Math.sign(event.deltaY)*.12),cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;bounds={x:cx-bounds.width*factor/2,y:cy-bounds.height*factor/2,width:bounds.width*factor,height:bounds.height*factor};render();};
 view.root.addEventListener('keydown',event=>{if(event.key!=='Escape')return;if(polygon.length){polygon=[];path=[];selected=new Set(geometryBase);geometrySession=undefined;render();}else if(referencePick){referencePick=undefined;}else if(pointer||pan){canvas.onpointercancel?.(new PointerEvent('pointercancel'));}else if(menu?.isConnected){menu.remove();}else return;event.preventDefault();event.stopImmediatePropagation();},true);
 view.root.addEventListener('keydown',event=>{if(event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement||event.target instanceof HTMLSelectElement)return;
  if(event.key==='Enter'&&polygon.length){event.preventDefault();attempt(finishPolygon);return;}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopPropagation();(event.shiftKey?redo:undo)();return;}
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();attempt(removeSelected);}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='a'){event.preventDefault();selected=new Set(evaluate().nodes.filter(node=>node.kind!=='group').map(node=>node.id));render();}
 });
 toolbar.append(name);const modeButton=button('Atomnic',()=>{if(pointer||pan)canvas.onpointercancel?.call(canvas,new PointerEvent('pointercancel'));commit({...recipe,atomnic:{...recipe.atomnic,active:!atomnicSettings(recipe).active}});});modeButton.setAttribute('aria-label','Toggle Atomnic');const brushButtons:HTMLButtonElement[]=[];button('Selection',()=>{showMenu();selectionSettings(menu!.lastElementChild as HTMLElement);});button('Save',()=>save());button('Variant',()=>save(true));button('＋ Shape',()=>showMenu(undefined,true));
 for(const [label,value]of [['◌','select'],['✎','draw'],['⌫','erase'],['↻','rotate']] as const){const control=button(label,()=>{tool=value;});if(value!=='select')brushButtons.push(control);}
 function undo(){if(!past.length)return;future.push(recipe);recipe=past.pop()!;lastGroup='';draft();render();}function redo(){if(!future.length)return;past.push(recipe);recipe=future.pop()!;lastGroup='';draft();render();}button('↶',undo);button('↷',redo);
 button('Fit',()=>{bounds=evaluationBounds(evaluate());render();});button('▶',()=>{playing=!playing;const advance=createPlaybackClock(clock,RENDER_BUDGET.omnicFps),tick=(now:number)=>{raf=0;if(!alive||!playing)return;if(!document.hidden&&now-lastFrame>=1000/RENDER_BUDGET.omnicFps){lastFrame=now;clock=advance(now);render();}raf=requestAnimationFrame(tick);};if(playing&&!raf)raf=requestAnimationFrame(tick);});
 button('↓',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(recipe)],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download='omnic.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 button('↑',()=>{const input=document.createElement('input');input.type='file';input.accept='.json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;if(file.size>1000000){host.feedback('Omnic file exceeds 1 MB.');return;}try{const source=await file.text();if(alive)commit(validateRecipe(JSON.parse(source)));}catch(e){host.feedback(String(e));}};input.click();});
 const unsubscribe=host.subscribe(()=>{if(!origin)return;const node=locate(host.read(),origin);if(!node){view.close();return;}if(name.value===lastLabel)name.value=node.label;lastLabel=node.label;const source=node.omnicDraft??definitionRecipe(node,host.read());if(source&&JSON.stringify(source)!==JSON.stringify(recipe)){recipe=structuredClone(source);past=[];future=[];menu?.remove();}render();});const invoke=(point:Point,event:PointerEvent|MouseEvent,handler:((event:never)=>unknown)|null)=>{externalPoints.set(event,point);external=true;try{handler?.call(canvas,event as never);}finally{external=false;}};
 const surface:OmnicSurface={get origin(){return origin;},get bounds(){return atomnicViewBounds(recipe.atomnic)??evaluationBounds(evaluate());},get preview(){const evaluation=evaluate();return {recipe,evaluation:{...evaluation,selection:targetNodes(evaluation,[...selected]).filter(node=>node.kind!=='group').map(node=>node.id)}};},down:(point,event)=>invoke(point,event,canvas.onpointerdown),move:(point,event)=>invoke(point,event,canvas.onpointermove),up:(point,event)=>invoke(point,event,canvas.onpointerup),context:(point,event)=>invoke(point,event,canvas.oncontextmenu),cancel:()=>canvas.onpointercancel?.call(canvas,new PointerEvent('pointercancel'))};
 const activate=()=>{releaseSurface?.();releaseSurface=host.surface?.(surface);};view.root.addEventListener('pointerdown',activate);
 if(!origin||!locate(host.read(),origin)?.omnicDraft&&!definitionRecipe(locate(host.read(),origin)!,host.read())){draft();host.select(origin!);}activate();render();return {...view,get origin(){return origin;}};
}
