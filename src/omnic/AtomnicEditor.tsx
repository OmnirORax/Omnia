import { appendTransient, stepTransient } from '../ui/transientTimeline';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Recipe, Component } from './model';
import { validateRecipe } from './model';
import { atoms, atomnicSettings, addAtom, mapAtoms, transformAtoms, rotateAtoms, placementPoint, selectionScope, legalAtoms, type Point } from './atomnic';
import { ATOMNIC_PARAMETERS } from './atomnicSettings';
import { useOmnicParameterBindings } from './propertyAdapter';
import { PropertyEditor } from '../appearance/Controls';
import { rankedPropertyPatterns, matchingProperties, type PropertyCriterion } from '../appearance/propertyPatterns';
import { PROPERTY_REGISTRY } from '../properties/catalog';
import { divisions, directionTurn, snapTurn, turnStep } from '../properties/halving';
import { HalvingPicker } from '../properties/HalvingPicker';
import { ContextualMasterController } from '../ui/ContextualMasterController';
import { UIAction } from '../ui/UIAction';
import { UIField } from '../ui/UIField';
import { UISection } from '../ui/UISection';
import { useFeatureActions } from '../ui/useFeatureActions';
import type { AtomnicInteraction } from './atomnicInteraction';
import { renderSVG } from './svg';
import type { Evaluation } from './evaluate';
import { claimUIPress } from '../ui/pointerOwnership';

type Props={recipe:Recipe;evaluation:Evaluation|null;commit:(recipe:Recipe,preview?:boolean)=>boolean;onBridge:(bridge:AtomnicInteraction|null)=>void};
type Tool='draw'|'select'|'move'|'rotate';
type Gesture={kind:'draw'|'move'|'rotate';base:Recipe;next:Recipe;start:Point;last:Point;ids:Set<string>;angle:number};
const uid=()=>crypto.randomUUID();
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function AtomnicEditor({recipe,evaluation,commit,onBridge}:Props) {
  const recipeRef=useRef(recipe);recipeRef.current=recipe;
  const [selectionTimeline,setSelectionTimeline]=useState(()=>({states:[new Set<string>()],index:0}));
  const selected=selectionTimeline.states[selectionTimeline.index];
  const setSelected=(next:Set<string>)=>setSelectionTimeline(previous=>appendTransient(previous,next));
  const [hovered,setHovered]=useState<string[]>([]);
  const [tool,setTool]=useState<Tool>('draw'),[phase,setPhase]=useState('idle'),[pivot,setPivot]=useState<Point|null>(null);
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null),[configure,setConfigure]=useState(false),[message,setMessage]=useState('');
  const [axisRange,setAxisRange]=useState({low:0,high:.25});
  const [criteria,setCriteria]=useState<PropertyCriterion[]>([]),[pointed,setPointed]=useState<string|null>(null);
  const gesture=useRef<Gesture|null>(null),stepOnly=useRef(false),cursor=useRef<HTMLDivElement>(null);
  const pointer=useRef({x:0,y:0}),lastHover=useRef(0);
  const [ghost,setGhost]=useState<Point>();
  const settings=useMemo(()=>atomnicSettings(recipe),[recipe.atomnic]);
  const list=useMemo(()=>atoms(recipe),[recipe.components]);
  const selectedRef=useRef(selected);selectedRef.current=selected;
  const size=Number(settings.viewSize),bounds=useMemo(()=>({x:-size/2,y:-size/2,width:size,height:size}),[size]);
  const error=(failure:unknown)=>setMessage(failure instanceof Error?failure.message:String(failure));
  const scoped=(ids:ReadonlySet<string>)=>selectionScope(atoms(recipeRef.current),ids,settings.scope==='macro');
  const hit=(point:Point)=>{let result:typeof list[number]|undefined;let best=Infinity;for(const atom of atoms(recipeRef.current)){const d=distance(point,atom);if(d<=atom.radius+2&&d<best){result=atom;best=d;}}return result;};
  const input=(key:string,value:string|number|boolean,preview=false)=>{
    try {
      if(key==='step'&&settings.mode==='constrained')throw Error('Touching-lattice movement is coupled to the imprint diameter. Use Free for independent steps.');
      let next:Recipe={...recipeRef.current,atomnic:{...atomnicSettings(recipeRef.current),[key]:value}};
      const ids=scoped(selectedRef.current);
      if(key==='size'&&settings.mode==='constrained') {
        const ratio=Number(value)/Number(settings.size),all=new Set(atoms(next).map(a=>a.id));
        next=mapAtoms(next,c=>({...c,params:{...c.params,size:Number(value)}}));
        next=transformAtoms(next,all,a=>({x:a.x*ratio,y:a.y*ratio}));
        next={...next,atomnic:{...next.atomnic,step:Number(value)*2}};
      } else if(['size','fill','color','opacity','thickness'].includes(key)&&ids.size&&settings.paint==='selection')
        next=mapAtoms(next,c=>ids.has(c.id)?{...c,params:{...c.params,[key]:value}}:c);
      if(!legalAtoms(next))throw Error('The construction does not fit the touching-lattice profile. Use Free or adjust the geometry first.');
      if(commit(validateRecipe(next),preview))setMessage('');
    }catch(failure){error(failure);}
  };
  const first=list.find(a=>selected.has(a.id));
  const displayed=useMemo(()=>{const values={...settings};if(first&&settings.paint==='selection')for(const key of ['size','fill','color','opacity','thickness'])values[key]=first.component.params[key]??values[key];return values;},[settings,first]);
  useOmnicParameterBindings(displayed,next=>{for(const key of Object.keys(next))if(next[key]!==displayed[key])input(key,next[key]);},ATOMNIC_PARAMETERS);
  const beginRotation=(step=false)=>{if(!selectedRef.current.size){setMessage('Select atoms before rotating.');return;}stepOnly.current=step;setTool('rotate');setMenu(null);setConfigure(false);setPhase('pivot');setMessage('Pick the pivot: exact click or detected target.');};
  const cancel=()=>{const active=gesture.current;gesture.current=null;if(active)commit(active.base,true);setPhase('idle');setMenu(null);setHovered([]);setMessage('');};
  const mark=()=>{try{const targets=[...scoped(selectedRef.current)].map(id=>`${id}:shape`);if(!targets.length)return;
    commit({...recipeRef.current,operations:[...recipeRef.current.operations,{id:uid(),operator:'highlight',targets,enabled:true,
      params:{which:'all',fraction:Number(settings.fraction),start:Number(settings.markTurn)*360,color:String(settings.color),opacity:Number(settings.opacity)}}]});
  }catch(failure){error(failure);}};
  const remove=()=>{const ids=scoped(selectedRef.current);const walk=(items:Component[]):Component[]=>items.filter(c=>!ids.has(c.id)).map(c=>c.children?{...c,children:walk(c.children)}:c);commit({...recipeRef.current,components:walk(recipeRef.current.components)});setSelected(new Set());};
  const group=()=>{try{const ids=scoped(selectedRef.current), chosen=atoms(recipeRef.current).filter(a=>ids.has(a.id));if(!chosen.length)return;
    const walk=(items:Component[]):Component[]=>items.filter(c=>!ids.has(c.id)).map(c=>c.children?{...c,children:walk(c.children)}:c);
    commit(validateRecipe({...recipeRef.current,components:[...walk(recipeRef.current.components),{id:uid(),generator:'group',params:{},children:chosen.map(a=>({...a.component,params:{...a.component.params,x:a.x,y:a.y}}))}]}));
  }catch(failure){error(failure);}};
  const compatible=recipe.components.every(function supported(c:Component):boolean{return ['dot','group'].includes(c.generator)&&(c.children??[]).every(supported);})&&recipe.operations.every(op=>!op.enabled||op.operator==='highlight');
  const commands=useFeatureActions('atomnicComposer',{
    'atomnic.draw':{enabled:compatible,run:()=>{cancel();setTool('draw');}},'atomnic.select':{enabled:compatible,run:()=>{cancel();setTool('select');}},
    'atomnic.move':{enabled:compatible&&selected.size>0,run:()=>{cancel();setTool('move');}},
    'atomnic.rotate':{enabled:compatible&&selected.size>0,run:event=>{if(menu&&event instanceof KeyboardEvent){setConfigure(true);setTool('rotate');setPhase('configure');}else beginRotation();}},
    'atomnic.step':{enabled:compatible&&selected.size>0,run:()=>beginRotation(true)},
    'atomnic.highlight':{enabled:compatible&&selected.size>0,run:mark},
    'atomnic.fill':{enabled:compatible&&selected.size>0,run:()=>{const ids=scoped(selectedRef.current);commit(mapAtoms(recipeRef.current,c=>ids.has(c.id)?{...c,params:{...c.params,fill:Boolean(settings.fill),color:String(settings.color),opacity:Number(settings.opacity)}}:c));}},
    'atomnic.remove':{enabled:compatible&&selected.size>0,run:remove},'atomnic.group':{enabled:compatible&&selected.size>0,run:group},
    'atomnic.all':{enabled:compatible,run:()=>{setSelected(new Set(list.map(a=>a.id)));setTool('select');}},
    'atomnic.selectionUndo':{enabled:selectionTimeline.index>0,run:()=>setSelectionTimeline(previous=>stepTransient(previous,-1))},
    'atomnic.selectionRedo':{enabled:selectionTimeline.index<selectionTimeline.states.length-1,run:()=>setSelectionTimeline(previous=>stepTransient(previous,1))},
    'atomnic.configure':{enabled:compatible,run:()=>{setConfigure(true);setMenu({...pointer.current});}},
    'atomnic.confirm':{enabled:phase==='configure',run:()=>beginRotation()},
    'atomnic.cancel':{enabled:phase!=='idle'||selected.size>0||!!menu,run:()=>{if(phase==='idle'&&!menu)setSelected(new Set());else cancel();}},
  });
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
  const handlers=useRef({down:(_p:Point,_e:PointerEvent)=>{},move:(_p:Point,_e:PointerEvent)=>{},up:(_p:Point,_e:PointerEvent)=>{},cancel});
  handlers.current={
    down:(point,event)=>{
      if(!compatible)return;
      pointer.current={x:event.clientX,y:event.clientY};const target=hit(point);if(target)setPointed(target.id);
      if(event.button===2){if(target&&!selected.has(target.id))setSelected(scoped(new Set([target.id])));setMenu({...pointer.current});setConfigure(true);return;}
      if(event.button!==0)return;
      setMenu(null);
      if(phase==='pivot') {
        let next=point;
        if(settings.pivotMode==='target') {
          if(!target){setMessage('Point at a unit or group to detect its reference point.');return;}
          const members=list.filter(a=>scoped(new Set([target.id])).has(a.id));
          const left=Math.min(...members.map(a=>a.x-a.radius)),right=Math.max(...members.map(a=>a.x+a.radius));
          const top=Math.min(...members.map(a=>a.y-a.radius)),bottom=Math.max(...members.map(a=>a.y+a.radius));
          const axis=Number(settings.axis)/divisions(Number(settings.order))*Math.PI*2;
          const dx=Math.sin(axis),dy=-Math.cos(axis),extent=Math.min(Math.abs(dx)>.00001?(right-left)/2/Math.abs(dx):Infinity,Math.abs(dy)>.00001?(bottom-top)/2/Math.abs(dy):Infinity);
          next={x:(left+right)/2+dx*extent*(Number(settings.position)*2-1),y:(top+bottom)/2+dy*extent*(Number(settings.position)*2-1)};
        }
        setPivot(next);setPhase('armed');setMessage('Pivot set. Press and drag to rotate.');
        if(stepOnly.current){try{commit(rotateAtoms(recipeRef.current,scoped(selectedRef.current),next,turnStep(Number(settings.order),Number(settings.steps))));setPhase('idle');setMessage('');}catch(failure){error(failure);} }
        return;
      }
      if(target&&(event.shiftKey||tool!=='draw')) {
        let ids=new Set(selectedRef.current);const picked=scoped(new Set([target.id]));
        if(event.shiftKey)for(const id of picked){if(ids.has(id))ids.delete(id);else ids.add(id);}
        else if(!ids.has(target.id))ids=picked;
        setSelected(ids);
        if(event.shiftKey||tool==='select')return;
        const kind=tool==='rotate'?'rotate':'move';if(kind==='rotate'&&!pivot){beginRotation();return;}
        gesture.current={kind,base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids:scoped(ids),angle:pivot?directionTurn(point.x-pivot.x,point.y-pivot.y):0};return;
      }
      if(tool==='rotate'&&pivot&&selected.size){gesture.current={kind:'rotate',base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids:scoped(selectedRef.current),angle:directionTurn(point.x-pivot.x,point.y-pivot.y)};return;}
      if(tool==='draw') {
        if(target)setSelected(scoped(new Set([target.id])));
        const base=recipeRef.current;try{const next=addAtom(base,point,uid());gesture.current={kind:'draw',base,next,start:point,last:point,ids:new Set(),angle:0};commit(next,true);}catch(failure){error(failure);}return;
      }
      if(!event.shiftKey)setSelected(new Set());
    },
    move:(point,event)=>{
      pointer.current={x:event.clientX,y:event.clientY};if(cursor.current)cursor.current.style.transform=`translate(${event.clientX+12}px,${event.clientY+12}px)`;
      const active=gesture.current;if(!active){if(tool==='draw'&&performance.now()-lastHover.current>83){lastHover.current=performance.now();setGhost(placementPoint(point,settings));}return;}
      try {
        let next=active.next;
        if(active.kind==='draw') {
          const count=Math.min(64,Math.max(1,Math.ceil(distance(point,active.last)/Math.max(.25,Number(settings.mode==='constrained'?Number(settings.size)*2:settings.step)/2))));
          for(let i=1;i<=count;i++)next=addAtom(next,{x:active.last.x+(point.x-active.last.x)*i/count,y:active.last.y+(point.y-active.last.y)*i/count},uid());
        } else if(active.kind==='move') {
          const delta=placementPoint({x:point.x-active.start.x,y:point.y-active.start.y},settings);
          next=transformAtoms(active.base,active.ids,a=>({x:a.x+delta.x,y:a.y+delta.y}));
        } else if(pivot) {
          let turn=directionTurn(point.x-pivot.x,point.y-pivot.y)-active.angle;
          if(turn>.5)turn-=1;if(turn<-.5)turn+=1;
          next=rotateAtoms(active.base,active.ids,pivot,snapTurn(turn,Number(settings.order)));
        }
        if(commit(next,true)){active.next=next;active.last=point;setMessage('');}
      }catch(failure){error(failure);}
    },
    up:()=>{const active=gesture.current;gesture.current=null;if(active){commit(active.next);if(active.kind==='rotate')setPhase('idle');}},cancel,
  };
  const api=useMemo(()=>({down:(p:Point,e:PointerEvent)=>handlers.current.down(p,e),move:(p:Point,e:PointerEvent)=>handlers.current.move(p,e),up:(p:Point,e:PointerEvent)=>handlers.current.up(p,e),cancel:()=>handlers.current.cancel()}),[]);
  const bridge=useMemo<AtomnicInteraction>(()=>({...api,bounds,gridPitch:settings.mode==='constrained'?Number(settings.size)*2:undefined,ghost:tool==='draw'&&ghost?{...ghost,radius:Number(settings.size),color:String(settings.color)}:undefined,selected:[...selected],hovered,pivot,phase:phase==='idle'?tool:phase}),[api,bounds,selected,hovered,pivot,phase,tool,ghost,settings.mode,settings.size,settings.color]);
  useEffect(()=>{onBridge(compatible?bridge:null);},[bridge,onBridge,compatible]);useEffect(()=>()=>{onBridge(null);},[onBridge]);
  const beforeUnmount=useRef(cancel);beforeUnmount.current=cancel;
  useEffect(()=>{const stop=()=>{if(gesture.current)beforeUnmount.current();};window.addEventListener('blur',stop);return()=>{window.removeEventListener('blur',stop);};},[]);
  const target=list.find(a=>a.id===pointed)??first;
  const patternObjects=useMemo(()=>list.map(atom=>{const node=evaluation?.nodes.find(n=>n.componentId===atom.id&&n.kind!=='group');return {...atom,values:{...atom.values,...(node?.highlight?{'omnic.regionFraction':node.highlight.fraction,'omnic.regionAngle':node.highlight.start}: {})}};}),[list,evaluation]);
  const patternTarget=patternObjects.find(a=>a.id===target?.id);
  const patterns=useMemo(()=>patternTarget?rankedPropertyPatterns(patternObjects,patternTarget):[],[patternObjects,patternTarget]);
  const field=(key:string)=>{const p=ATOMNIC_PARAMETERS.find(p=>p.key===key)!;return <UIField key={key} id={`atomnic:${key}`} label={p.label} category="Atomnic"><label>{p.label}<PropertyEditor property={p.property} label={p.label} disabled={key==='step'&&settings.mode==='constrained'} value={key==='step'&&settings.mode==='constrained'?Number(settings.size)*2:displayed[key]} limits={p.kind==='number'?{min:p.min!,max:p.max!}:undefined} choices={p.options?.map(o=>o.id)} onPreview={v=>input(key,v,true)} onCommit={v=>input(key,v)} /></label></UIField>;};
  const configureKeys=['mode','paint','scope','size','step','thickness','fill','color','opacity','order','steps','pivotMode','axis','position','fraction','markTurn','viewSize'];
  const svg=evaluation?renderSVG(evaluation,bridge):'';
  const local=(event:React.PointerEvent<HTMLDivElement>)=>{const box=event.currentTarget.getBoundingClientRect();const edge=Math.min(box.width,box.height);return {x:((event.clientX-box.left-(box.width-edge)/2)/edge-.5)*size,y:((event.clientY-box.top-(box.height-edge)/2)/edge-.5)*size};};
  return <UISection id="atomnic-editor" title="Atomnic">
    {!compatible&&<small role="alert">This recipe uses generated arrays, references or geometry operators. Switch to Generator controls to edit it; Atomnic gestures edit authored dots and groups.</small>}
    <div className="omnic-row">{(['draw','select','move','rotate','all','highlight','configure'] as const).map(action=><UIAction key={action} id={`atomnic:toolbar:${action}`} category="Atomnic" label={action==='rotate'?'🗘 Rotate':action} onClick={()=>commands.invoke(`atomnic.${action}`)} />)}<small>{list.length} units · {selected.size} selected · {String(settings.mode)} · {divisions(Number(settings.order))} directions</small></div>
    <div className="omnic-preview atomnic-surface" data-atomnic-surface onContextMenu={e=>e.preventDefault()} dangerouslySetInnerHTML={{__html:svg}}
      onPointerDown={event=>{event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);event.currentTarget.setPointerCapture(event.pointerId);api.down(local(event),event.nativeEvent);}}
      onPointerMove={event=>api.move(local(event),event.nativeEvent)} onPointerUp={event=>{api.up(local(event),event.nativeEvent);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>api.cancel()} onLostPointerCapture={()=>{if(gesture.current)api.cancel();}} />
    {message&&<small role="status">{message}</small>}
    <small>Draw: click/sweep. Select V · Move G · Rotate R. Shift-click adds targets. Right-click for DOFs/patterns. Also editable directly in the world.</small>
    <ContextualMasterController title="Atomnic" position={menu} onClose={()=>{setMenu(null);setHovered([]);}}>
      <div className="omnic-row">{(['draw','select','move','rotate','highlight','fill','group','remove','selectionUndo','selectionRedo'] as const).map(action=><UIAction key={action} id={`atomnic:context:${action}`} category="Atomnic" label={action} onClick={()=>commands.invoke(`atomnic.${action}`)} />)}<UIAction id="atomnic:step" category="Atomnic" label={`🗘 ${settings.steps}/${divisions(Number(settings.order))}`} onClick={()=>commands.invoke('atomnic.step')} /></div>
      <div className="omnic-row"><UIAction id="atomnic:settings" category="Atomnic" label="Configure DOFs" onClick={()=>setConfigure(v=>!v)} />{field('scope')}</div>
      {configure&&<><div className="atomnic-fields">{configureKeys.filter(key=>key!=='scope').map(field)}</div>
        <UIField id="atomnic:axis-halving" label="Axis interval" category="Atomnic"><label>Axis interval <select defaultValue="0,.25" onChange={event=>{const [low,high]=event.target.value.split(',').map(Number);setAxisRange({low,high});}}><option value="0,.25">Top → Right</option><option value=".25,.5">Right → Bottom</option><option value=".5,.75">Bottom → Left</option><option value="0,1">Full turn</option></select></label></UIField>
        <HalvingPicker low={axisRange.low} high={axisRange.high} label="Axis halving" onPick={value=>{let order=0;while(order<6&&Math.abs(value*divisions(order)-Math.round(value*divisions(order)))>1e-6)order++;commit({...recipeRef.current,atomnic:{...settings,order,axis:Math.round(value*divisions(order))}});}} />
        <HalvingPicker low={0} high={1} label="Pivot position halving" onPick={value=>input('position',value)} />
        <HalvingPicker low={0} high={1} label="Highlight fraction halving" onPick={value=>input('fraction',value)} />
        <UIAction id="atomnic:confirm" category="Atomnic" label="Confirm → pick pivot" onClick={()=>beginRotation()} /></>}
      {target&&<UISection id="atomnic-patterns" title="Property patterns" defaultExpanded={false}>
        {patterns.map(pattern=><div className="omnic-row" key={pattern.rule.property} onMouseEnter={()=>setHovered(pattern.ids)} onMouseLeave={()=>setHovered([])}>
          <button type="button" onClick={()=>{setSelected(new Set(pattern.ids));setTool('select');}}>{PROPERTY_REGISTRY.property(pattern.rule.property)?.label??pattern.rule.property} · {['omnic.angle','omnic.regionAngle'].includes(pattern.rule.property)?`${Number(pattern.rule.value)/360*divisions(Number(settings.order))}/${divisions(Number(settings.order))} turn`:String(pattern.rule.value)} · {pattern.ids.length}</button>
          <button type="button" aria-label={`Include ${pattern.rule.property}`} onClick={()=>chooseCriterion(pattern.rule,false)}>+</button>
          <button type="button" aria-label={`Exclude ${pattern.rule.property}`} onClick={()=>chooseCriterion(pattern.rule,true)}>−</button>
        </div>)}
        <UIAction id="atomnic:clear-criteria" category="Atomnic" label={`Clear criteria · ${criteria.length}`} onClick={()=>setCriteria([])} />
      </UISection>}
    </ContextualMasterController>
    {tool==='rotate'&&createPortal(<div ref={cursor} className={`atomnic-cursor ${phase==='pivot'?'atomnic-pivot':''}`} style={{pointerEvents:'none',position:'fixed',left:0,top:0,zIndex:2147483000,transform:`translate(${pointer.current.x+12}px,${pointer.current.y+12}px)`}}><span style={{display:'inline-block',transform:`rotate(${turnStep(Number(settings.order),Number(settings.steps))}turn)`}}>🗘</span>{phase==='pivot'&&<i>●</i>}</div>,document.body)}
  </UISection>;
  function chooseCriterion(rule:PropertyCriterion,exclude:boolean){const next=[...criteria.filter(r=>r.property!==rule.property),{...rule,exclude,...(rule.property==='omnic.angle'?{period:360,tolerance:360/divisions(Number(settings.order))/2}:{})}];setCriteria(next);setSelected(new Set(matchingProperties(patternObjects,next)));setTool('select');}
  // The interval belongs to the picker, not a duplicate property value store.
}
