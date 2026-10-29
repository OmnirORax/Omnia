import { DegreeSetter } from './DegreeSetter';
import { contextTargets } from '../ui/contextTargets';
import { appendTransient, stepTransient } from '../ui/transientTimeline';
import { useCallback, useId, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type Ref, type RefObject } from 'react';
import type { Recipe, Component } from './model';
import { validateRecipe } from './model';
import { atoms, atomnicSettings, atomnicEditable, addAtom, mapAtoms, transformAtoms, rotateAtoms, placementPoint, selectionScope, legalAtoms, removeAtoms, eraseAtomsAlong, atomIdsAlong, ungroupAtoms, type Point } from './atomnic';
import { ATOMNIC_PARAMETERS, ATOMNIC_OPERATION_INPUTS, type AtomnicConfigAction } from './atomnicSettings';
import { useOmnicParameterBindings } from './propertyAdapter';
import { PropertyEditor } from '../appearance/Controls';
import { rankedPropertyPatterns, matchingProperties, type PropertyCriterion } from '../appearance/propertyPatterns';
import { PROPERTY_REGISTRY } from '../properties/catalog';
import { divisions, directionTurn, snapTurn, turnStep, turnDelta } from '../properties/halving';
import { HalvingPicker } from '../properties/HalvingPicker';
import { ContextualMasterController } from '../ui/ContextualMasterController';
import { UIAction } from '../ui/UIAction';
import { ProgressiveConfiguration } from '../ui/ProgressiveConfiguration';
import { UIField } from '../ui/UIField';
import { UISection } from '../ui/UISection';
import { useFeatureActions } from '../ui/useFeatureActions';
import type { AtomnicInteraction } from './atomnicInteraction';
import { structuralIdsInRect, renderSVG } from './svg';
import type { Evaluation } from './evaluate';
import { claimUIPress } from '../ui/pointerOwnership';
import { FEATURE_ACTIONS } from '../featureActions';
import { FunctionControl } from '../ui/UIWorkspace';
import { RadialMenu, type RadialNavigation } from '../ui/RadialMenu';
import { radialTree, type RadialEntry } from '../ui/radialMenuModel';
import { cursorPosition } from '../ui/cursorPosition';
import { targetDegrees, targetDegreeValue, writeTargetDegree, translateTargets, targetParameter } from './targetDegrees';
import type { EditableDegree } from '../properties/editableDegrees';
import type { Parameter } from './registry';
import { useToolCursorZone } from '../ui/toolCursorZone';
import { nameSymbol } from '../ui/nameSymbols';

type Props={recipe:Recipe;evaluation:Evaluation|null;commit:(recipe:Recipe,preview?:boolean)=>boolean;onBridge:(bridge:AtomnicInteraction|null)=>void;onSelect?:(ids:readonly string[])=>void;activateTarget?:()=>void;bindParameters?:boolean;documentEntries?:RadialEntry<ReactNode>[];modeControl?:ReactNode;radar?:boolean;extraPanel?:ReactNode;closePanel?:()=>void;dismissPanel?:()=>void;onEmptyContext?:(point:Point)=>void;confirmPanel?:()=>void;panelRadial?:boolean;panelStage?:string;presentationBounds?:{x:number;y:number;width:number;height:number};normalSelection?:string[];onPickGeometry?:(point:Point,role?:string)=>readonly string[]|void;surfaceRef?:Ref<HTMLDivElement>;markupRef?:RefObject<string>};
type Panel={kind:'functions'|'target'}|{kind:'degree';degree:EditableDegree;configure:boolean}|{kind:'operation';action:AtomnicConfigAction;index:number;fromTarget?:boolean}|{kind:'pivotModes'}|{kind:'reference';index:number}|{kind:'axis';stage:'start'|'end'|'halving';start?:number;end?:number}|{kind:'position'}|{kind:'patterns'};
type Tool='draw'|'erase'|'select'|'move'|'rotate';
type Gesture={kind:'select'|'draw'|'erase'|'move'|'translate'|'rotate';base:Recipe;next:Recipe;start:Point;last:Point;ids:Set<string>;angle:number;turn?:number;appliedTurn?:number;appliedDelta?:Point;bounds?:{x:number;y:number;width:number;height:number}};
const uid=()=>crypto.randomUUID();
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
export function AtomnicEditor({recipe,evaluation,commit,onBridge,onSelect,activateTarget,bindParameters=true,documentEntries=[],modeControl,radar=false,extraPanel,closePanel,dismissPanel,onEmptyContext,confirmPanel,panelRadial=false,panelStage,presentationBounds,normalSelection=[],onPickGeometry,surfaceRef,markupRef}:Props) {
  const localSurface=useRef<HTMLDivElement>(null),cursorZone=useId();
  useToolCursorZone(localSurface,cursorZone,radar);
  const attachSurface=useCallback((node:HTMLDivElement|null)=>{localSurface.current=node;if(typeof surfaceRef==='function')surfaceRef(node);else if(surfaceRef)surfaceRef.current=node;},[surfaceRef]);
  const wheelDelta=useRef(0),wheelTimer=useRef<ReturnType<typeof setTimeout>|null>(null),wheelEnd=useRef<ReturnType<typeof setTimeout>|null>(null);
  const recipeRef=useRef(recipe);recipeRef.current=recipe;
  const [selectionTimeline,setSelectionTimeline]=useState(()=>({states:[new Set<string>()],index:0}));
  const selected=selectionTimeline.states[selectionTimeline.index];
  const setSelected=(next:Set<string>)=>{onSelect?.([...next]);setSelectionTimeline(previous=>appendTransient(previous,next));};
  const [hovered,setHovered]=useState<string[]>([]),[selectionBox,setSelectionBox]=useState<{x:number;y:number;width:number;height:number}|null>(null);
  const [tool,setTool]=useState<Tool>('draw'),[phase,setPhase]=useState('idle'),[pivot,setPivot]=useState<Point|null>(null);
  const [cursorOperation,setCursorOperation]=useState<'move'|null>(null);
  const pointerTool=cursorOperation??tool;
  const [menu,setMenu]=useState<{x:number;y:number}|null>(null),[panel,setPanel]=useState<Panel>({kind:'functions'}),[message,setMessage]=useState('');
  const [criteria,setCriteria]=useState<PropertyCriterion[]>([]),[pointed,setPointed]=useState<string|null>(null);
  const [degrees,setDegrees]=useState<EditableDegree[]>([]);
  const gesture=useRef<Gesture|null>(null),stepOnly=useRef(false);
  const pointer=useRef({x:0,y:0}),lastHover=useRef(0);
  const radialNavigation=useRef<RadialNavigation>(null);
  const [radialContext,setRadialContext]=useState(false);
  useLayoutEffect(()=>{if(extraPanel)setMenu(cursorPosition());},[!!extraPanel]);
  const [ghost,setGhost]=useState<Point>();
  const settings=useMemo(()=>atomnicSettings(recipe),[recipe.atomnic]);
  const list=useMemo(()=>atoms(recipe),[recipe.components]);
  const selectedRef=useRef(selected);selectedRef.current=selected;
  const size=Number(settings.viewSize),localBounds=useMemo(()=>({x:-size/2,y:-size/2,width:size,height:size}),[size]);
  const bounds=gesture.current?.bounds??presentationBounds??localBounds,isAtomnic=!radar||!!recipe.atomnic?.active;
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
      } else if(['size','fill','color','opacity','thickness'].includes(key)&&ids.size&&settings.paint==='selection'&&!(panel.kind==='operation'&&panel.action==='atomnic.highlight'))
        next=mapAtoms(next,c=>ids.has(c.id)?{...c,params:{...c.params,[key]:value}}:c);
      if(!legalAtoms(next))throw Error('The construction does not fit the touching-lattice profile. Use Free or adjust the geometry first.');
      if(commit(validateRecipe(next),preview))setMessage('');
    }catch(failure){error(failure);}
  };
  const first=list.find(a=>selected.has(a.id));
  const editingMark=panel.kind==='operation'&&panel.action==='atomnic.highlight';
  const displayed=useMemo(()=>{const values={...settings};if(first&&settings.paint==='selection'&&!editingMark)for(const key of ['size','fill','color','opacity','thickness'])values[key]=first.component.params[key]??values[key];return values;},[settings,first,editingMark]);
  const degree=panel.kind==='degree'?panel.degree:undefined;
  const degreeParameters=useMemo(()=>degree?[targetParameter(degree)]:[],[degree]);
  const degreeValues=useMemo(()=>degree?{[degree.targets[0].input.key]:targetDegreeValue(recipe,degree)}:displayed,[degree,recipe,displayed]);
  useOmnicParameterBindings(degreeValues,next=>{if(degree){changeDegree(degree,next[degree.targets[0].input.key]);return;}for(const key of Object.keys(next))if(next[key]!==displayed[key])input(key,next[key]);},degree?degreeParameters:bindParameters&&isAtomnic&&!extraPanel&&!normalSelection.length?ATOMNIC_PARAMETERS:[]);
  const beginRotation=(step=false)=>{if(!selectedRef.current.size){setMessage('Select atoms before rotating.');return;}stepOnly.current=step;setTool('rotate');setMenu(null);setPanel({kind:'functions'});setPhase('pivot');setMessage('Pick the pivot: exact click or detected target.');};
  const cancel=()=>{setCursorOperation(null);setSelectionBox(null);const active=gesture.current;gesture.current=null;if(active)commit(active.base,true);setPhase('idle');setMenu(null);setHovered([]);setMessage('');};
  const mark=()=>{try{const targets=[...scoped(selectedRef.current)].map(id=>`${id}:shape`);if(!targets.length)return;
    commit({...recipeRef.current,operations:[...recipeRef.current.operations,{id:uid(),operator:'highlight',targets,enabled:true,
      params:{which:'all',fraction:Number(settings.fraction),start:Number(settings.markTurn)*360,color:String(settings.color),opacity:Number(settings.opacity)}}]});
  }catch(failure){error(failure);}};
  const remove=()=>{commit(removeAtoms(recipeRef.current,scoped(selectedRef.current)));setSelected(new Set());};
  const group=()=>{try{const ids=scoped(selectedRef.current), chosen=atoms(recipeRef.current).filter(a=>ids.has(a.id));if(!chosen.length)return;
    const walk=(items:Component[]):Component[]=>items.filter(c=>!ids.has(c.id)).map(c=>c.children?{...c,children:walk(c.children)}:c);
    commit(validateRecipe({...recipeRef.current,components:[...walk(recipeRef.current.components),{id:uid(),generator:'group',params:{},children:chosen.map(a=>({...a.component,params:{...a.component.params,x:a.x,y:a.y}}))}]}));
  }catch(failure){error(failure);}};
  // Atomnic is a tool profile in the same recipe. Other generators remain
  // rendered; only authored dots are direct Atomnic gesture targets.
  const compatible=isAtomnic&&atomnicEditable(recipe);
  const commands=useFeatureActions('atomnicComposer',{
    'atomnic.erase':{enabled:compatible,cursor:compatible&&pointerTool==='erase'?{zone:cursorZone}:false,run:()=>{cancel();setTool('erase');}},
    'atomnic.constraints':{enabled:true,run:()=>input('mode',settings.mode==='free'?'constrained':'free')},
    'atomnic.draw':{enabled:compatible,cursor:compatible&&pointerTool==='draw'?{zone:cursorZone}:false,run:()=>{cancel();setTool('draw');}},'atomnic.select':{enabled:compatible,cursor:compatible&&pointerTool==='select'?{zone:cursorZone}:false,run:()=>{cancel();setTool('select');}},
    'atomnic.move':{enabled:compatible&&selected.size>0,cursor:(compatible||gesture.current?.kind==='translate')&&pointerTool==='move'?{zone:cursorZone}:false,run:()=>{cancel();setTool('move');}},
    'atomnic.rotate':{enabled:compatible&&selected.size>0,cursor:compatible&&pointerTool==='rotate'?{zone:cursorZone,rotationTurns:turnStep(Number(settings.order),Number(settings.steps)),badge:phase==='pivot'?'●':undefined,pulse:phase==='pivot'}:false,run:event=>{if(menu&&event instanceof KeyboardEvent){configureOperation('atomnic.rotate');}else beginRotation();}},
    'atomnic.step':{enabled:compatible&&selected.size>0,run:()=>beginRotation(true)},
    'atomnic.highlight':{enabled:compatible&&selected.size>0,run:mark},
    'atomnic.fill':{enabled:compatible&&selected.size>0,run:()=>{const ids=scoped(selectedRef.current);commit(mapAtoms(recipeRef.current,c=>ids.has(c.id)?{...c,params:{...c.params,fill:Boolean(settings.fill),color:String(settings.color),opacity:Number(settings.opacity)}}:c));}},
    'atomnic.remove':{enabled:compatible&&selected.size>0,run:()=>{if(contextTargets.owns())contextTargets.invoke('deleteSelected');else remove();}},'atomnic.group':{enabled:compatible&&selected.size>0,run:group},
    'atomnic.ungroup':{enabled:compatible&&list.some(a=>selected.has(a.id)&&a.group!=='@root'),run:()=>{try{commit(ungroupAtoms(recipeRef.current,selectedRef.current));}catch(failure){error(failure);}}},
    'atomnic.all':{enabled:compatible,run:()=>{if(contextTargets.owns()){contextTargets.invoke('selectAll');return;}setSelected(new Set(list.map(a=>a.id)));setTool('select');}},
    'atomnic.selectionUndo':{enabled:selectionTimeline.index>0,run:()=>{const next=stepTransient(selectionTimeline,-1);setSelectionTimeline(next);onSelect?.([...next.states[next.index]]);}},
    'atomnic.selectionRedo':{enabled:selectionTimeline.index<selectionTimeline.states.length-1,run:()=>{const next=stepTransient(selectionTimeline,1);setSelectionTimeline(next);onSelect?.([...next.states[next.index]]);}},
    'atomnic.configure':{enabled:true,run:()=>{if(radar)configureOperation('atomnic.configure');else{setPanel({kind:'functions'});setMenu({...pointer.current});}}},
    'atomnic.patterns':{enabled:compatible&&selected.size>0,run:()=>{setPanel({kind:'patterns'});setMenu(cursorPosition());}},
    'atomnic.confirm':{enabled:!!extraPanel&&!!confirmPanel||!!menu&&(panel.kind==='operation'||panel.kind==='reference'),run:()=>{if(extraPanel)confirmPanel?.();else nextConfiguration();}},
    'atomnic.cancel':{enabled:phase!=='idle'||!!gesture.current,run:()=>{if(extraPanel){closePanel?.();return;}if((radar&&radialContext&&!menu||menu&&panel.kind==='functions')&&radialNavigation.current?.back())return;if(menu&&panel.kind!=='functions')backConfiguration();else if(phase==='idle'&&!menu)setSelected(new Set());else cancel();}},
  });
  useEffect(()=>{const key=(event:KeyboardEvent)=>{if(commands.handle(event)){event.preventDefault();event.stopImmediatePropagation();}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[]);
  const handlers=useRef({select:(_ids:readonly string[])=>{},down:(_p:Point,_e:PointerEvent)=>{},move:(_p:Point,_e:PointerEvent)=>{},up:(_p:Point,_e:PointerEvent)=>{},cancel});
  handlers.current={
    select:ids=>{if(!ids.length){setMenu(null);setPanel({kind:'functions'});setPhase('idle');setCursorOperation(null);setHovered([]);gesture.current=null;}const atomIds=new Set(atoms(recipeRef.current).map(a=>a.id));setSelectionTimeline(previous=>appendTransient(previous,new Set(ids.filter(id=>atomIds.has(id)))));},

    down:(point,event)=>{
      activateTarget?.();
      if(wheelTimer.current){clearTimeout(wheelTimer.current);wheelTimer.current=null;wheelDelta.current=0;}
      if(wheelEnd.current){clearTimeout(wheelEnd.current);wheelEnd.current=null;commit(recipeRef.current);}
      setGhost(undefined);pointer.current={x:event.clientX,y:event.clientY};const target=hit(point);if(target)setPointed(target.id);
      const role=event.target instanceof Element?event.target.closest('[data-omnic-role]')?.getAttribute('data-omnic-role')??undefined:undefined;
      if(event.button===2){
        if(openMovingPosition(event.clientX,event.clientY))return;
        closePanel?.();setMenu({...pointer.current});
        if(phase==='pivot'){setPanel({kind:'pivotModes'});return;}
        let ids:string[]=[];
        if(isAtomnic&&target){const chosen=selected.has(target.id)?scoped(selected):scoped(new Set([target.id]));selectedRef.current=chosen;setSelected(chosen);ids=[...chosen];}
        else {const picked=onPickGeometry?.(point,role);if(Array.isArray(picked))ids=picked;}
        if(ids.length){
          const atomTargets=ids.every(id=>list.some(atom=>atom.id===id));
          const adapters=compatible&&atomTargets?FEATURE_ACTIONS.flatMap(action=>'adjusts' in action?[{id:action.id,label:action.label,symbol:action.radial.symbol,adjusts:action.adjusts}]:[]):[];
          setDegrees(targetDegrees(recipeRef.current,ids,adapters,isAtomnic&&atomTargets&&settings.mode==='constrained'?['omnic.extent']:[]));setPanel({kind:'target'});
        }else {setPanel({kind:'functions'});if(onEmptyContext)onEmptyContext(point);else if(radar)radialNavigation.current?.open();}
        return;
      }
      if(event.button===0&&(event.ctrlKey||event.metaKey)){
        dismissPanel?.();setMenu(null);const ids=new Set([...normalSelection,...selectedRef.current]);
        for(const id of structuralIdsInRect(evaluation?.nodes??[],point,point))ids.add(id);setSelectionBox({x:point.x,y:point.y,width:0,height:0});
        gesture.current={kind:'select',base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids,angle:0};
        selectedRef.current=ids;setSelected(ids);return;
      }
      if(event.button===0&&!target){
        const ids=onPickGeometry?.(point,role);
        if(Array.isArray(ids)&&ids.length){setSelectionTimeline(previous=>appendTransient(previous,new Set<string>()));setMenu(null);setCursorOperation('move');gesture.current={kind:'translate',base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids:new Set(ids),angle:0,bounds};return;}
        if(!isAtomnic)return;
      }
      if(!compatible)return;
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
      if(tool==='erase'){const base=recipeRef.current,next=eraseAtomsAlong(base,point,point,settings.scope==='macro');gesture.current={kind:'erase',base,next,start:point,last:point,ids:new Set(),angle:0};if(next!==base)commit(next,true);return;}
      if(target) {
        let ids=new Set(selectedRef.current);const picked=scoped(new Set([target.id]));
        if(event.shiftKey)for(const id of picked){if(ids.has(id))ids.delete(id);else ids.add(id);}
        else if(!ids.has(target.id))ids=picked;
        selectedRef.current=ids;setSelected(ids);
        if(event.shiftKey)return;
        const kind=tool==='rotate'?'rotate':'move';if(kind==='rotate'&&!pivot){beginRotation();return;}
        if(kind==='move')setCursorOperation('move');
        gesture.current={kind,base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids:scoped(ids),bounds,angle:pivot?directionTurn(point.x-pivot.x,point.y-pivot.y):0};return;
      }
      if(tool==='rotate'&&pivot&&selected.size){gesture.current={kind:'rotate',base:recipeRef.current,next:recipeRef.current,start:point,last:point,ids:scoped(selectedRef.current),angle:directionTurn(point.x-pivot.x,point.y-pivot.y)};return;}
      if(tool==='draw') {
        const base=recipeRef.current;try{const next=addAtom(base,point,uid());gesture.current={kind:'draw',base,next,start:point,last:point,ids:new Set(),angle:0};commit(next,true);}catch(failure){error(failure);}return;
      }
      if(!event.shiftKey)setSelected(new Set());
    },
    move:(point,event)=>{
      pointer.current={x:event.clientX,y:event.clientY};
      const active=gesture.current;
      if(active?.kind==='select'){
        const left=Math.min(active.start.x,point.x),top=Math.min(active.start.y,point.y),width=Math.abs(point.x-active.start.x),height=Math.abs(point.y-active.start.y);setSelectionBox({x:left,y:top,width,height});
        const hits=structuralIdsInRect(evaluation?.nodes??[],active.start,point);let changed=false;
        for(const id of hits)if(!active.ids.has(id)){active.ids.add(id);changed=true;}
        active.last=point;if(changed){selectedRef.current=new Set(active.ids);setSelected(new Set(active.ids));}return;
      }
      if(!isAtomnic&&active?.kind!=='translate')return;if(!active){if(tool==='draw'&&performance.now()-lastHover.current>83){lastHover.current=performance.now();setGhost(placementPoint(point,settings));}else if(tool==='erase'&&performance.now()-lastHover.current>83){lastHover.current=performance.now();setHovered([...scoped(atomIdsAlong(list,point,point))]);}return;}
      try {
        let next=active.next,appliedDelta:Point|undefined;
        if(active.kind==='erase'){next=eraseAtomsAlong(active.next,active.last,point,settings.scope==='macro');}
        else if(active.kind==='draw') {
          const count=Math.min(64,Math.max(1,Math.ceil(distance(point,active.last)/Math.max(.25,Number(settings.mode==='constrained'?Number(settings.size)*2:settings.step)/2))));
          for(let i=1;i<=count;i++)next=addAtom(next,{x:active.last.x+(point.x-active.last.x)*i/count,y:active.last.y+(point.y-active.last.y)*i/count},uid());
        } else if(active.kind==='translate') {
          const delta=placementPoint({x:point.x-active.start.x,y:point.y-active.start.y},{...settings,mode:'free'});
          if(delta.x===(active.appliedDelta?.x??0)&&delta.y===(active.appliedDelta?.y??0))return;appliedDelta=delta;
          const b=active.bounds!;
          const base={...active.base,atomnic:{...active.base.atomnic,viewSize:Math.max(b.width,b.height),viewX:b.x+b.width/2,viewY:b.y+b.height/2}};
          next=translateTargets(base,active.ids,delta);
        } else if(active.kind==='move') {
          const delta=placementPoint({x:point.x-active.start.x,y:point.y-active.start.y},settings);
          if(delta.x===(active.appliedDelta?.x??0)&&delta.y===(active.appliedDelta?.y??0))return;appliedDelta=delta;
          next=transformAtoms(active.base,active.ids,a=>({x:a.x+delta.x,y:a.y+delta.y}));
        } else if(pivot) {
          const direction=directionTurn(point.x-pivot.x,point.y-pivot.y);
          active.turn=(active.turn??0)+turnDelta(active.angle,direction);active.angle=direction;
          const turn=snapTurn(active.turn,Number(settings.order),Number(settings.steps));
          if(turn===(active.appliedTurn??0))return;
          next=rotateAtoms(active.base,active.ids,pivot,turn);
        }
        if(next===active.next){active.last=point;return;}
        if(commit(next,true)){active.next=next;active.last=point;if(appliedDelta)active.appliedDelta=appliedDelta;if(active.kind==='rotate')active.appliedTurn=snapTurn(active.turn??0,Number(settings.order),Number(settings.steps));setMessage('');}
      }catch(failure){error(failure);}
    },
    up:(_point,event)=>{if(event.buttons&1)return;setCursorOperation(null);const active=gesture.current;gesture.current=null;if(active?.kind==='select')setSelectionBox(null);if(active){if(active.next!==active.base)commit(active.next);if(active.kind==='erase'){const remaining=new Set(atoms(active.next).map(a=>a.id));const nextSelected=new Set([...selectedRef.current].filter(id=>remaining.has(id)));if(nextSelected.size!==selectedRef.current.size)setSelected(nextSelected);}if(active.kind==='rotate')setPhase('idle');}},cancel,
  };
  const api=useMemo(()=>({select:(ids:readonly string[])=>handlers.current.select(ids),context:(event:MouseEvent)=>openMovingPosition(event.clientX,event.clientY),down:(p:Point,e:PointerEvent)=>handlers.current.down(p,e),move:(p:Point,e:PointerEvent)=>handlers.current.move(p,e),up:(p:Point,e:PointerEvent)=>handlers.current.up(p,e),cancel:()=>handlers.current.cancel()}),[]);
  const bridge=useMemo<AtomnicInteraction>(()=>({...api,bounds,cursorZone,gridPitch:isAtomnic&&settings.mode==='constrained'?Number(settings.size)*2:undefined,selectionBox:gesture.current?.kind==='select'?selectionBox:null,ghost:isAtomnic&&tool==='draw'&&ghost?{...ghost,radius:Number(settings.size),color:String(settings.color)}:undefined,selected:isAtomnic&&selected.size?[...selected]:normalSelection,hovered:isAtomnic?hovered:[],pivot:isAtomnic?pivot:null,phase:isAtomnic?(phase==='idle'?tool:phase):'select'}),[api,bounds,cursorZone,selected,selectionBox,hovered,pivot,phase,tool,ghost,settings.mode,settings.size,settings.color,isAtomnic,normalSelection]);
  useEffect(()=>{onBridge(radar||compatible?bridge:null);},[bridge,onBridge,compatible,radar]);useEffect(()=>()=>{onBridge(null);},[onBridge]);
  const beforeUnmount=useRef(cancel);beforeUnmount.current=cancel;
  useEffect(()=>{const stop=()=>{if(gesture.current)beforeUnmount.current();};window.addEventListener('blur',stop);return()=>{window.removeEventListener('blur',stop);};},[]);
  const target=list.find(a=>a.id===pointed)??first;
  const patternObjects=useMemo(()=>list.map(atom=>{const node=evaluation?.nodes.find(n=>n.componentId===atom.id&&n.kind!=='group');return {...atom,values:{...atom.values,...(node?.highlight?{'omnic.regionFraction':node.highlight.fraction,'omnic.regionAngle':node.highlight.start}: {})}};}),[list,evaluation]);
  const patternTarget=patternObjects.find(a=>a.id===target?.id);
  const patterns=useMemo(()=>patternTarget?rankedPropertyPatterns(patternObjects,patternTarget):[],[patternObjects,patternTarget]);
  const field=(key:string)=>{const p=ATOMNIC_PARAMETERS.find(p=>p.key===key)!;return <UIField key={key} id={`atomnic:${key}`} label={p.label} category="Atomnic"><label>{p.label}<PropertyEditor property={p.property} label={p.label} disabled={key==='step'&&settings.mode==='constrained'} value={key==='step'&&settings.mode==='constrained'?Number(settings.size)*2:displayed[key]} limits={p.kind==='number'?{min:p.min!,max:p.max!}:undefined} choices={p.options?.map(o=>o.id)} onPreview={v=>input(key,v,true)} onCommit={v=>input(key,v)} /></label></UIField>;};
  const zoom=useRef((_delta:number)=>{});
  zoom.current=delta=>{
    if(gesture.current)return;
    const extent=Math.max(bounds.width,bounds.height),next=Math.max(40,Math.min(1000,extent*Math.exp(Math.max(-2,Math.min(2,delta*.0015)))));
    if(next===extent)return;
    commit({...recipeRef.current,atomnic:{...recipeRef.current.atomnic,viewSize:next,viewX:bounds.x+bounds.width/2,viewY:bounds.y+bounds.height/2}},true);
    if(wheelEnd.current)clearTimeout(wheelEnd.current);
    wheelEnd.current=setTimeout(()=>{wheelEnd.current=null;commit(recipeRef.current);},180);
  };
  useEffect(()=>{
    const node=localSurface.current;if(!node)return;
    const wheel=(event:WheelEvent)=>{if(event.ctrlKey)return;event.preventDefault();event.stopPropagation();wheelDelta.current+=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?node.clientHeight:1);
      if(!wheelTimer.current)wheelTimer.current=setTimeout(()=>{wheelTimer.current=null;const delta=wheelDelta.current;wheelDelta.current=0;zoom.current(delta);},83);
    };
    node.addEventListener('wheel',wheel,{passive:false});
    return()=>{node.removeEventListener('wheel',wheel);if(wheelTimer.current)clearTimeout(wheelTimer.current);if(wheelEnd.current)clearTimeout(wheelEnd.current);};
  },[]);
  const svg=evaluation?renderSVG(evaluation,bridge):'';
  if(markupRef)markupRef.current=svg;
  const local=(event:React.PointerEvent<HTMLDivElement>)=>{const box=event.currentTarget.getBoundingClientRect();const edge=Math.min(box.width,box.height),scale=Math.max(bounds.width,bounds.height);return {x:bounds.x+bounds.width/2+((event.clientX-box.left-(box.width-edge)/2)/edge-.5)*scale,y:bounds.y+bounds.height/2+((event.clientY-box.top-(box.height-edge)/2)/edge-.5)*scale};};
  const radialActions=FEATURE_ACTIONS.filter(action=>action.owner==='atomnicComposer'&&'radial' in action&&!('adjusts' in action)&&(isAtomnic||['atomnic.configure','atomnic.constraints'].includes(action.id)));
  const radialControl=(action:typeof radialActions[number])=>{
    const displayedAction=action.id==='atomnic.erase'&&tool==='erase'?FEATURE_ACTIONS.find(action=>action.id==='atomnic.draw')!:action;
    const id=displayedAction.id as Parameters<typeof commands.invoke>[0],hasInputs=id in ATOMNIC_OPERATION_INPUTS;
    const symbol=id==='atomnic.constraints'?(settings.mode==='free'?'⌁':'⊣'):'radial' in displayedAction?displayedAction.radial.symbol:'◇';
    return <><UIAction id={`atomnic:context:${id.slice(8)}`} category="Atomnic" label={operationLabel(id)} symbol={symbol} tool={'toolIcon' in displayedAction?id:undefined} registerOnly
      disabled={!commands.available(id)} onClick={()=>{commands.invoke(id);if(!['atomnic.configure','atomnic.patterns','atomnic.constraints'].includes(id))setMenu(null);}}
      onConfigure={hasInputs?()=>configureOperation(id as AtomnicConfigAction):undefined}/>
      <FunctionControl id={`atomnic:context:${id.slice(8)}`} mirror symbol={symbol} tooltip={`${operationLabel(id)}${hasInputs?' · Left-click uses retained settings; right-click configures':''}`} /></>;
  };
  const radialEntries:RadialEntry<ReactNode>[]=radialActions.filter(action=>action.id!=='atomnic.draw'&&!('radial' in action&&'inset' in action.radial)).map(action=>({id:action.id,label:operationLabel(action.id),symbol:'radial' in action?action.radial.symbol:'◇',group:'radial' in action?action.radial.group:[],content:radialControl(action)}));
  const surface=<div ref={attachSurface} className="omnic-preview atomnic-surface" data-atomnic-surface data-ui-gesture-owner="content" data-context-menu-owner onContextMenu={e=>{e.preventDefault();e.stopPropagation();api.context(e.nativeEvent);}} dangerouslySetInnerHTML={{__html:svg}}
      onPointerDown={event=>{event.preventDefault();event.stopPropagation();claimUIPress(event.pointerId,event.pointerType,event.buttons);event.currentTarget.setPointerCapture(event.pointerId);api.down(local(event),event.nativeEvent);}}
      onPointerMove={event=>api.move(local(event),event.nativeEvent)} onPointerUp={event=>{api.up(local(event),event.nativeEvent);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}} onPointerCancel={()=>api.cancel()} onLostPointerCapture={()=>{if(gesture.current)api.cancel();}} />;
  const quickActions=radialActions.filter(action=>'radial' in action&&'inset' in action.radial);
  const rim=<RadialMenu heldOpen={!!extraPanel} quickItems={radar?[...quickActions.filter(action=>action.id!=='atomnic.erase').map(action=>radialControl(action)),...(modeControl?[modeControl]:[])]:undefined} quickEnd={radar?quickActions.filter(action=>action.id==='atomnic.erase').map(action=>radialControl(action)):undefined} items={radialTree([...radialEntries,...documentEntries])} navigationRef={radialNavigation} onNavigationChange={setRadialContext} onClose={()=>setMenu(null)}
    inset={<><span className="radial-menu-inset radial-menu-primary">{radialActions.filter(action=>'radial' in action&&'inset' in action.radial).map(action=><span className="radial-menu-quick-control" key={action.id}>{radialControl(action)}</span>)}</span>{modeControl&&<span className="radial-menu-inset">{modeControl}</span>}</>}>{radar?surface:undefined}</RadialMenu>;
  const content=<>
    {radar?rim:<>
    {!compatible&&isAtomnic&&<small role="alert">An enabled geometry operator changes the displayed construction. Turn Atomnic off to edit it. Other generators can coexist; Atomnic gestures target authored dots.</small>}
    <div className="omnic-row"><button type="button" className="atomnic-tool-toggle" data-ui-id="atomnic:tools-visibility" aria-label={menu?'Hide tools':'Show tools'} title={menu?'Hide tools':'Show tools'} aria-expanded={!!menu}
      onClick={event=>{if(menu)setMenu(null);else{setPanel({kind:'functions'});setMenu({x:event.clientX,y:event.clientY});}}}>⠿</button>
      <small className="atomnic-status" title={`${tool} · ${list.length} units · ${selected.size} selected · Right-click for radial tools; right-click a tool to configure.`}>● {list.length} · ◉ {selected.size}</small></div>
    {surface}</>}
    {message&&<small className={radar?'omnic-radar-feedback':undefined} role="status">{message}</small>}
    <ContextualMasterController stage={extraPanel?panelStage:panel.kind==='operation'||panel.kind==='reference'?`${panel.kind}:${panel.index}`:panel.kind==='degree'?`${panel.kind}:${panel.degree.id}:${panel.configure}`:panel.kind==='axis'?`${panel.kind}:${panel.stage}`:panel.kind} onDismiss={()=>{dismissPanel?.();setMenu(null);setHovered([]);if(phase==='configure')setPhase('idle');}} title={extraPanel?'Omnic':panel.kind==='target'?'Target freedoms':panel.kind==='degree'?panel.degree.label:panel.kind==='functions'?'Atomnic':panel.kind==='operation'?operationLabel(panel.action):panel.kind==='patterns'?'Property patterns':'Rotation pivot'} radial={extraPanel?panelRadial:panel.kind==='functions'||panel.kind==='target'} position={extraPanel?(menu??cursorPosition()):radar&&panel.kind==='functions'?null:menu} onClose={()=>{if(extraPanel){closePanel?.();return;}if(panel.kind==='functions'&&radialNavigation.current?.back())return;setMenu(null);setHovered([]);if(phase==='configure')setPhase('idle');}}>
      {extraPanel??<>
      {panel.kind==='target'&&<RadialMenu items={radialTree(degrees.map(degree=>({group:degree.group,id:degree.id,label:degree.label,symbol:degree.symbol??nameSymbol(degree.id,degree.label),setter:targetParameter(degree).kind==='color'?undefined:<DegreeSetter recipe={recipe} degree={degree} onPreview={value=>changeDegree(degree,value,true)} onCommit={value=>changeDegree(degree,value)} onOpen={()=>{if(degree.action)configureOperation(degree.action as AtomnicConfigAction,true);else setPanel({kind:'degree',degree,configure:false});}}/>,content:<><UIAction registerOnly id={`omnic:target-dof:${degree.id}`} label={degree.label} category="Omnic" tool={degree.action} onClick={()=>{
        if(degree.action){commands.invoke(degree.action as Parameters<typeof commands.invoke>[0]);}else{setMenu(cursorPosition());setPanel({kind:'degree',degree,configure:false});}
      }} onConfigure={()=>{if(degree.action)configureOperation(degree.action as AtomnicConfigAction,true);else{setMenu(cursorPosition());setPanel({kind:'degree',degree,configure:true});}}}/><FunctionControl id={`omnic:target-dof:${degree.id}`} mirror symbol={degree.symbol??nameSymbol(degree.id,degree.label)} symbolOpacity={degree.symbolOpacity} symbolFill={degree.symbolFill} tooltip={`${degree.label} · ${degree.action?operationLabel(degree.action):String(targetDegreeValue(recipe,degree))} · Left-click adjusts; right-click configures`}/></>})))} onClose={()=>setMenu(null)}/>}
      {panel.kind==='degree'&&<div className="progressive-configuration">
        <PropertyEditor key={`${panel.degree.id}:${panel.configure}`} property={panel.degree.properties[0]} label={panel.degree.label} configuration={panel.configure?'step':undefined}
          value={targetDegreeValue(recipe,panel.degree)} limits={(panel.degree.targets[0].input as Parameter).kind==='number'?{min:targetParameter(panel.degree).min!,max:targetParameter(panel.degree).max!}:undefined}
          onPreview={value=>changeDegree(panel.degree,value,true)} onCommit={value=>changeDegree(panel.degree,value)}/>
        <button type="button" onClick={()=>setPanel({kind:'target'})} title="Back to target freedoms" aria-label="Back to target freedoms">↩</button>
      </div>}
      {!radar&&panel.kind==='functions'&&rim}
      {panel.kind==='operation'&&<ProgressiveConfiguration label={operationLabel(panel.action)} index={panel.index} count={operationKeys(panel.action).length} onBack={backConfiguration} onNext={nextConfiguration}>
        {field(operationKeys(panel.action)[panel.index])}
      </ProgressiveConfiguration>}
      {panel.kind==='pivotModes'&&<div className="atomnic-functions">
        <UIAction id="atomnic:pivot-exact" category="Atomnic" label={`Exact click${settings.pivotMode==='exact'?' ✓':''}`} onClick={()=>{input('pivotMode','exact');setMenu(null);}} />
        <UIAction id="atomnic:pivot-target" category="Atomnic" label={`Detected target${settings.pivotMode==='target'?' ✓':''}`} onClick={()=>{input('pivotMode','target');setMenu(null);}} onConfigure={()=>{input('pivotMode','target');setPanel({kind:'reference',index:0});}} />
        <button type="button" onClick={()=>setPanel({kind:'functions'})}>Back</button>
      </div>}
      {panel.kind==='reference'&&<ProgressiveConfiguration label="Detected target" index={panel.index} count={2} onBack={backConfiguration} onNext={nextConfiguration}>
        {panel.index===0?<UIAction id="atomnic:reference-axis" category="Atomnic" label={`Axis · ${settings.axis}/${divisions(Number(settings.order))}`} onClick={nextConfiguration} onConfigure={()=>setPanel({kind:'axis',stage:'start'})} />:
          <UIAction id="atomnic:reference-position" category="Atomnic" label={`Position · ${settings.position}`} onClick={nextConfiguration} onConfigure={()=>setPanel({kind:'position'})} />}
      </ProgressiveConfiguration>}
      {panel.kind==='axis'&&<div className="progressive-configuration">
        {panel.stage!=='halving'?<><small>{panel.stage==='start'?'First':'Second'} interval boundary · clockwise</small>
          <svg className="atomnic-axis-picker" viewBox="-65 -65 130 130" role="group" aria-label="Axis interval boundary">
            <circle r="48" fill="none" stroke="currentColor" opacity=".4" />
            {Array.from({length:Math.min(48,divisions(Number(settings.order)))},(_,i)=>{
              const count=Math.min(48,divisions(Number(settings.order))),turn=i/count,x=Math.sin(turn*Math.PI*2)*48,y=-Math.cos(turn*Math.PI*2)*48;
              return <g key={i} role="button" tabIndex={0} aria-label={`Boundary ${i}/${count}`} onClick={()=>pickBoundary(turn)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();event.stopPropagation();pickBoundary(turn);}}}><circle cx={x} cy={y} r="5" fill="currentColor"/><title>{i}/{count}</title></g>;
            })}
          </svg>
          <div className="progressive-navigation">{(['Top','Right','Bottom','Left'] as const).map((label,index)=><button type="button" key={label} onClick={()=>pickBoundary(index/4)}>{label}</button>)}</div>
        </>:<HalvingPicker key={`${panel.start}:${panel.end}`} low={panel.start!} high={panel.end!} label="Axis halving" endpointLabels={['first boundary','second boundary']} onPick={pickAxis} />}
        <button type="button" onClick={backConfiguration}>Back</button>
      </div>}
      {panel.kind==='position'&&<div className="progressive-configuration"><small>Position along axis</small><HalvingPicker low={0} high={1} label="Pivot position halving" endpointLabels={['axis start','axis end']} onPick={value=>{input('position',value);setMenu(null);setPhase('pivot');}}/><button type="button" onClick={backConfiguration}>Back</button></div>}
      {panel.kind==='patterns'&&<div className="atomnic-patterns">
        {patterns.map(pattern=><div className="omnic-row" key={pattern.rule.property} onMouseEnter={()=>setHovered(pattern.ids)} onMouseLeave={()=>setHovered([])}>
          <button type="button" onClick={()=>{setSelected(new Set(pattern.ids));setTool('select');}}>{PROPERTY_REGISTRY.property(pattern.rule.property)?.label??pattern.rule.property} · {['omnic.angle','omnic.regionAngle'].includes(pattern.rule.property)?`${Number(pattern.rule.value)/360*divisions(Number(settings.order))}/${divisions(Number(settings.order))} turn`:String(pattern.rule.value)} · {pattern.ids.length}</button>
          <button type="button" aria-label={`Include ${pattern.rule.property}`} onClick={()=>chooseCriterion(pattern.rule,false)}>+</button>
          <button type="button" aria-label={`Exclude ${pattern.rule.property}`} onClick={()=>chooseCriterion(pattern.rule,true)}>−</button>
        </div>)}
        <UIAction id="atomnic:clear-criteria" category="Atomnic" label={`Clear criteria · ${criteria.length}`} onClick={()=>setCriteria([])} />
        <button type="button" onClick={()=>{setPanel({kind:'functions'});setHovered([]);}}>Back</button>
      </div>}
      </>}
    </ContextualMasterController>
  </>;
  return radar?content:<UISection id="atomnic-editor" title="Atomnic">{content}</UISection>;
  function openMovingPosition(x:number,y:number){
    const active=gesture.current;if(!active||active.kind!=='move'&&active.kind!=='translate')return false;
    gesture.current=null;setCursorOperation(null);if(active.next!==active.base)commit(active.next);
    closePanel?.();setMenu({x,y});setPanel({kind:'operation',action:'atomnic.move',index:0});setPhase('configure');return true;
  }
  function operationKeys(action:AtomnicConfigAction):readonly string[]{return ATOMNIC_OPERATION_INPUTS[action].filter(key=>key!=='step'||settings.mode==='free');}
  function configureOperation(action:AtomnicConfigAction,fromTarget=false){setMenu(cursorPosition());setPanel({kind:'operation',action,index:0,fromTarget});setPhase('configure');if(action==='atomnic.rotate'||action==='atomnic.step')setTool('rotate');}
  function nextConfiguration(){
    if(panel.kind==='operation'){
      if(panel.index+1<operationKeys(panel.action).length){setPanel({...panel,index:panel.index+1});return;}
      if(panel.action==='atomnic.configure'){setMenu(null);setPhase('idle');return;}
      if(panel.action==='atomnic.rotate'||panel.action==='atomnic.step'){beginRotation(panel.action==='atomnic.step');return;}
      commands.invoke(panel.action);setMenu(null);setPhase('idle');
    }else if(panel.kind==='reference'){
      if(panel.index===0)setPanel({kind:'reference',index:1});else {setMenu(null);setPhase('pivot');}
    }
  }
  function backConfiguration(){
    if(panel.kind==='degree'){setPanel({kind:'target'});return;}
    if(panel.kind==='target'){setMenu(null);return;}
    if(panel.kind==='operation'&&panel.index>0)setPanel({...panel,index:panel.index-1});
    else if(panel.kind==='operation'&&panel.fromTarget){setPanel({kind:'target'});setPhase('idle');}
    else if(panel.kind==='reference')setPanel(panel.index?{kind:'reference',index:0}:{kind:'pivotModes'});
    else if(panel.kind==='axis')setPanel(panel.stage==='halving'?{...panel,stage:'end'}:panel.stage==='end'?{kind:'axis',stage:'start'}:{kind:'reference',index:0});
    else if(panel.kind==='position')setPanel({kind:'reference',index:1});
    else {setPanel({kind:'functions'});if(phase==='configure')setPhase('idle');}
  }
  function changeDegree(degree:EditableDegree,value:string|number|boolean,preview=false){try{commit(writeTargetDegree(recipeRef.current,degree,value),preview);setMessage('');}catch(failure){error(failure);}}
  function pickBoundary(turn:number){if(panel.kind!=='axis')return;if(panel.stage==='start')setPanel({kind:'axis',stage:'end',start:turn});else setPanel({...panel,stage:'halving',end:turn>panel.start!?turn:turn+1});}
  function pickAxis(value:number){
    let order=Number(settings.order);while(order<6&&Math.abs(value*divisions(order)-Math.round(value*divisions(order)))>1e-6)order++;
    if(Math.abs(value*divisions(order)-Math.round(value*divisions(order)))>1e-6){setMessage('That axis exceeds the supported halving order (6). Choose a lower depth.');return;}
    if(commit({...recipeRef.current,atomnic:{...atomnicSettings(recipeRef.current),order,axis:Math.round(value*divisions(order))%divisions(order)}}))setPanel({kind:'position'});
  }
  function operationLabel(action:string){
    const count=divisions(Number(settings.order));
    const labels:Record<string,string>={
      'atomnic.erase':`Erase · ${settings.scope}`,
      'atomnic.constraints':`${settings.mode==='free'?'Free':'Realistic · touching lattice'} · click to switch`,
      'atomnic.draw':`Draw · r ${settings.size} · step ${settings.mode==='constrained'?Number(settings.size)*2:settings.step}`,
      'atomnic.select':`Select · ${settings.scope}`,'atomnic.move':`Move · ${settings.scope}`,
      'atomnic.rotate':`🗘 Rotate · ${settings.steps}/${count}`,'atomnic.step':`🗘 Step · ${settings.steps}/${count}`,
      'atomnic.highlight':`Highlight · ${settings.fraction}`,'atomnic.fill':`Fill · ${settings.fill?'on':'off'}`,
      'atomnic.group':'Group','atomnic.ungroup':'Ungroup','atomnic.remove':'Remove','atomnic.all':'Select all',
      'atomnic.selectionUndo':'Undo selection','atomnic.selectionRedo':'Redo selection',
      'atomnic.patterns':`Property patterns · ${criteria.length}`,'atomnic.configure':`View · ${settings.viewSize}`,
    };return labels[action]??action;
  }
  function chooseCriterion(rule:PropertyCriterion,exclude:boolean){const next=[...criteria.filter(r=>r.property!==rule.property),{...rule,exclude,...(rule.property==='omnic.angle'?{period:360,tolerance:360/divisions(Number(settings.order))/2}:{})}];setCriteria(next);setSelected(new Set(matchingProperties(patternObjects,next)));setTool('select');}
}
