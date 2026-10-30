import {useEffect,useContext,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {selectionExpression,selectionLayout,createStateActivation,maximumSelectionStates,type StateSelectionMode} from '../properties/stateSelection';
import {createStateField,nearestFieldCandidate,type StateFieldDomain} from '../properties/stateField';
import {mathematicalValueSession} from '../properties/mathematicalDial';
import {useWorkingSelection} from './RangeControl';
import {useNumericEditor,useNumericOperation,NumericToolZone} from './NumericEditorScope';
import {useToolCursor,useCursorParking} from './toolCursor';
import {setToolCursorZone} from './toolCursorZone';
import {cursorPosition} from './cursorPosition';
import {ContextualMasterController} from './ContextualMasterController';
import {MathematicalDial} from './MathematicalDial';
import {RadialMenu} from './RadialMenu';
import {useContextNavigation} from './ContextStage';
import './dofStateField.css';

const modes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Partitions',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
type Settings={kind:'modes'|'parameters'|'count'|'step'|'reference'|'limits'|'min'|'max'|'value';point:{x:number;y:number}};
/** Projection-independent interaction. Domains/rules/constraints prepare a field;
 * pointer picking never discovers scene objects or implements property arithmetic. */
export function DofStateField({property,label,symbol='⠒❉',domain,value,disabled=false,configure=false,onPreview,onCommit}:{property:string;label:string;symbol?:string;domain:StateFieldDomain;value:number;disabled?:boolean;configure?:boolean;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const localZone=useId(),contentZone=useContext(NumericToolZone),zone=contentZone??localZone;
 const activation=useRef(createStateActivation()),bounds=useRef<DOMRect|null>(null),hoverValue=useRef<number|undefined>(undefined);
 const root=useRef<HTMLDivElement>(null),scope=useNumericEditor(),operation=useNumericOperation();
 const span=domain.max-domain.min;
 const working=useWorkingSelection(property,span,domain.integer?'step':'symmetry',domain.integer?Math.max(1,domain.resolution):domain.cyclic?domain.cyclic.period/8:domain.resolution);
 const mode=working.mode==='symmetry'&&domain.cyclic?{label:'Symmetry',icon:'✣'}:modes[working.mode];
 const [settings,setSettings]=useState<Settings|null>(()=>configure?{kind:'modes',point:cursorPosition()}:null),[picking,setPicking]=useState(false);
 const [parameterSample,setParameterSample]=useState<{count?:number;step?:number;min?:number;max?:number}>({});
 const anchor=useRef(domain.cyclic?.north??value),[session]=useState(()=>mathematicalValueSession(value)),[sample,setSample]=useState<number|null>(null);
 const pickingRef=useRef(false);pickingRef.current=picking;
 const pickCancel=useRef(operation?.selection?.cancel);pickCancel.current=operation?.selection?.cancel;
 const alive=useRef(true),callbacks=useRef({onPreview,cancel:scope.cancelPreview});callbacks.current={onPreview,cancel:scope.cancelPreview};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(pickingRef.current)pickCancel.current?.();if(session.sampling){const before=session.restore();if(callbacks.current.cancel)callbacks.current.cancel();else callbacks.current.onPreview(before);}};},[session]);
 useLayoutEffect(()=>{if(session.receive(value)){activation.current.cancel();anchor.current=domain.cyclic?.north??value;setSample(null);}},[value,session]);
 const restore=()=>{hoverValue.current=undefined;setSample(null);if(session.sampling){const before=session.restore();if(scope.cancelPreview)scope.cancelPreview();else onPreview(before);}};
 const show=(kind:Settings['kind'])=>{activation.current.cancel();restore();setParameterSample({});setSettings({kind,point:cursorPosition()});};
 const cursorKey=`state:${localZone}`,parked=useCursorParking(cursorKey),reference=operation?.selection?.current;
 const expression=selectionExpression(working.count),countLabel=expression.base?<>{expression.base}<sup>{expression.power}</sup></>:<>{expression.count}</>;
 const controls=<><button type="button" title={label} onClick={()=>show('parameters')}>{symbol}</button><button type="button" title={`${mode.label} · right-click chooses mode`} onClick={()=>show('parameters')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('modes');}}>{mode.icon} {mode.label}</button><button type="button" title="Edit divisions" onClick={()=>show('count')}>{countLabel}</button><button type="button" title="Reference" onClick={()=>show('reference')}>⟴ {picking?'Pick':operation?.selection?.unavailable?'Unavailable':reference?reference.label:'Self'}</button></>;
 const cursor=useMemo(()=>({key:cursorKey,zone,priority:45,icon:<span>{symbol}</span>,width:20,height:20,parked:parked??undefined,controls}),[cursorKey,zone,symbol,parked,working.mode,working.count,!!domain.cyclic,reference?.id,operation?.selection?.unavailable,picking]);
 useToolCursor(disabled?null:cursor);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 useContextNavigation({owner:root,cancel:picking?()=>operation?.selection?.cancel():sample!==null?restore:undefined});
 const count=parameterSample.count??working.count,step=parameterSample.step??working.step;
 const low=parameterSample.min??working.min,high=parameterSample.max??working.max;
 const referenceValue=reference?.value??anchor.current,allowed=operation?.allowed;
 const field=useMemo(()=>createStateField(domain,{mode:working.mode,count,step,reference:referenceValue,referenceId:reference?.id,min:low,max:high},allowed),
  [domain.min,domain.max,domain.integer,domain.resolution,domain.projection,domain.cyclic?.period,domain.cyclic?.north,working.mode,count,step,referenceValue,reference?.id,low,high,allowed]);
 const slots=useMemo(()=>selectionLayout(field.candidates.map(candidate=>(Math.atan2(candidate.point.x,-candidate.point.y)/(2*Math.PI)+1)%1),72),[field]);
 const preview=(n:number)=>{if(disabled||settings||picking||parked||operation?.selection?.unavailable)return;if(session.sampling&&session.expected===n)return;hoverValue.current=n;setSample(n);onPreview(session.preview(n));};
 const apply=(n:number)=>{if(disabled||picking||operation?.selection?.unavailable||!field.candidates.some(candidate=>candidate.value===n))return;setSample(null);onCommit(session.commit(n));};
 const closeSettings=()=>{setParameterSample({});restore();setSettings(null);};
 const chooseMode=(next:StateSelectionMode)=>{restore();working.modeChange(next);if(working.count>maximumSelectionStates(next))working.countChange(maximumSelectionStates(next));setSettings({kind:next==='step'?'step':'modes',point:settings?.point??cursorPosition()});};
 const pickReference=async()=>{restore();setSettings(null);if(!operation?.selection)return;setPicking(true);await operation.selection.pick();if(alive.current)setPicking(false);};
 const text=(n:number)=>`${Number(n.toPrecision(7))}${domain.cyclic?'°':''}`;
 const numeric=settings?.kind==='value'?{label, value:sample??value,min:field.min,max:field.max,integer:domain.integer,key:'value' as const,commit:(n:number)=>{setSample(null);onCommit(session.commit(n));}}:settings?.kind==='count'?{label:'Divisions',value:count,min:1,max:maximumSelectionStates(working.mode),integer:true,key:'count' as const,commit:working.countChange}:
  settings?.kind==='min'?{label:'Minimum',value:Math.max(domain.min,Math.min(domain.max,field.min)),min:domain.min,max:domain.max,integer:domain.integer,key:'min' as const,commit:working.minChange}:
  settings?.kind==='max'?{label:'Maximum',value:Math.max(domain.min,Math.min(domain.max,field.max)),min:domain.min,max:domain.max,integer:domain.integer,key:'max' as const,commit:working.maxChange}:
  {label:'Step',value:step,min:domain.cyclic?Math.min(domain.resolution,domain.cyclic.period):-Math.max(1,span),max:domain.cyclic?.period??Math.max(1,span),integer:domain.integer,key:'step' as const,commit:working.stepChange};
 return <div ref={root} className="dof-state-editor" aria-disabled={disabled} data-projection={field.projection} data-ui-popup-interior onMouseLeave={restore}>
  <div className="dof-state-field" role="group" aria-label={`${label} available states`}
   onPointerDownCapture={event=>{if(event.button===0&&!settings&&!picking&&!parked)activation.current.press(hoverValue.current);}}
   onPointerCancel={()=>activation.current.cancel()}
   onPointerEnter={event=>{bounds.current=event.currentTarget.getBoundingClientRect();}}
   onPointerMove={event=>{if(settings||picking||parked)return;const box=bounds.current;if(!box)return;const point={x:2*(event.clientX-box.left)/box.width-1,y:2*(event.clientY-box.top)/box.height-1};if(field.projection==='radial'&&Math.hypot(point.x,point.y)<.2){restore();return;}const candidate=nearestFieldCandidate(field,point);if(candidate)preview(candidate.value);}}
   onPointerLeave={()=>{activation.current.cancel();restore();}} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button,[data-dial-drag]')){activation.current.cancel();return;}const n=activation.current.take(hoverValue.current);if(n!==undefined)apply(n);}}>
   <svg viewBox="0 0 180 180" aria-hidden="true">{field.projection==='radial'?<circle cx="90" cy="90" r="72"/>:<line x1={field.projection==='axis-x'?18:90} y1={field.projection==='axis-y'?18:90} x2={field.projection==='axis-x'?162:90} y2={field.projection==='axis-y'?162:90}/>}
    {domain.cyclic&&field.candidates.map(candidate=><line key={candidate.id} x1="90" y1="90" x2={90+candidate.point.x*90} y2={90+candidate.point.y*90}/>)}</svg>
   {field.candidates.map((candidate,i)=><button key={candidate.id} type="button" disabled={disabled||picking||operation?.selection?.unavailable} className="dof-state-slot" style={{left:`${50+candidate.point.x*50}%`,top:`${50+candidate.point.y*50}%`,width:field.projection==='radial'?slots[i].diameter:12,height:field.projection==='radial'?slots[i].diameter:12}} aria-label={`${label} ${text(candidate.value)}`} title={text(candidate.value)} data-preview={sample===candidate.value} onMouseEnter={()=>preview(candidate.value)} onFocus={()=>preview(candidate.value)} onBlur={restore} onClick={()=>apply(candidate.value)}/>)}
   <output className="dof-state-readout" data-dial-drag role="button" tabIndex={0} title="Drag field">{symbol} {field.candidates.length?text(sample??value):'∅'}</output>
  </div>
  <div className="dof-state-mode" aria-label="DOF mode selector">
   <button type="button" title="Left-click configures; right-click chooses mode" onClick={()=>show('parameters')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('modes');}}>{mode.icon} {mode.label}</button>
   <button type="button" aria-label="Edit divisions with mathematical dial" title="Edit divisions" onClick={()=>show('count')}>{countLabel}</button>
  </div>
  {settings&&<ContextualMasterController radial title={`${label} mode`} stage={settings.kind} position={settings.point} onClose={closeSettings} onDismiss={closeSettings} onConfirm={closeSettings}>
   {settings.kind==='modes'?<RadialMenu onClose={closeSettings} items={(Object.keys(modes) as StateSelectionMode[]).map(kind=>({id:kind,symbol:modes[kind].icon,label:kind==='step'?'Add step rule':kind==='symmetry'&&domain.cyclic?'Symmetry':modes[kind].label,content:<button type="button" title={kind==='symmetry'&&domain.cyclic?'Symmetry':modes[kind].label} aria-pressed={working.mode===kind} onClick={()=>chooseMode(kind)}>{modes[kind].icon}<small>{kind==='step'?'+':kind==='symmetry'&&domain.cyclic?'Symmetry':modes[kind].label}</small></button>}))}/>:
    settings.kind==='parameters'?<RadialMenu onClose={closeSettings} items={[{id:'states',symbol:'●●',label:'Divisions',content:<button type="button" title="Generated divisions" onClick={()=>show('count')}>{countLabel}</button>},...(working.mode==='step'?[{id:'step',symbol:'Δ',label:'Step',content:<button type="button" title="Step" onClick={()=>show('step')}>Δ {text(step)}</button>}]:[]),{id:'value',symbol:'=',label:'Exact value',content:<button type="button" title="Exact value" onClick={()=>show('value')}>=</button>},{id:'limits',symbol:'↔',label:'Limits',content:<button type="button" title="Constrain available values" onClick={()=>show('limits')}>↔ Limits</button>}]}/>:
    settings.kind==='limits'?<RadialMenu onClose={closeSettings} items={[{id:'min',symbol:'⊢',label:'Minimum',content:<button type="button" title="Minimum" onClick={()=>show('min')}>⊢ {text(field.min)}</button>},{id:'max',symbol:'⊣',label:'Maximum',content:<button type="button" title="Maximum" onClick={()=>show('max')}>⊣ {text(field.max)}</button>},{id:'reset',symbol:'↺',label:'Reset limits',content:<button type="button" title="Reset working limits" onClick={()=>{setParameterSample({});working.clearLimits();}}>↺</button>}]}/>:
    settings.kind==='reference'?<RadialMenu onClose={closeSettings} items={[{id:'self',symbol:'⟴',label:'Self',content:<button type="button" title="Use self reference" onClick={()=>{restore();operation?.selection?.clear();}}>⟴ Self</button>},...(operation?.selection?[{id:'pick',symbol:'⨮',label:'Match reference',content:<button type="button" title="Pick a compatible object property" onClick={()=>{void pickReference();}}>⨮ Match</button>}]:[])]}/>:
    <MathematicalDial key={settings.kind} label={numeric.label} value={numeric.value} min={numeric.min} max={numeric.max} integer={numeric.integer} onPreview={n=>{if(numeric.key==='value'){setSample(n);onPreview(session.preview(n));}else setParameterSample({[numeric.key]:n});}} onCancelPreview={()=>{if(numeric.key==='value')restore();else setParameterSample({});}} onCommit={n=>{setParameterSample({});numeric.commit(n);}}/>}
  </ContextualMasterController>}
 </div>;
}
