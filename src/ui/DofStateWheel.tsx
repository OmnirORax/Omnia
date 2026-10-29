import {useEffect,useContext,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {selectionTurns,selectionValue,selectionExpression,selectionLayout,nearestSelectionTurn,maximumSelectionStates,type CyclicSelection,type StateSelectionMode} from '../properties/stateSelection';
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
import './dofStateWheel.css';

const modes:Record<StateSelectionMode,{label:string;icon:string}>={symmetry:{label:'Symmetry',icon:'✣'},halving:{label:'Halving',icon:'◐'},step:{label:'Step',icon:'+'}};
type Settings={kind:'modes'|'parameters'|'count'|'step'|'reference';point:{x:number;y:number}};
/** A generated-state selector. Numeric notation configures its rule, not the
 * selected outcome. Domain metadata supplies units/origin; setters own edits. */
export function DofStateWheel({property,label,symbol='🗘',domain,value,min,max,configure=false,onPreview,onCommit}:{property:string;label:string;symbol?:string;domain:CyclicSelection;value:number;min:number;max:number;configure?:boolean;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const localZone=useId(),contentZone=useContext(NumericToolZone),zone=contentZone??localZone;
 const wheelBounds=useRef<DOMRect|null>(null),hoverTurn=useRef<number|undefined>(undefined);
 const root=useRef<HTMLDivElement>(null),scope=useNumericEditor(),operation=useNumericOperation();
 const working=useWorkingSelection(property,domain.period),mode=modes[working.mode];
 const [settings,setSettings]=useState<Settings|null>(()=>configure?{kind:'modes',point:cursorPosition()}:null),[picking,setPicking]=useState(false);
 const [parameterSample,setParameterSample]=useState<{count?:number;step?:number}>({});
 const [session]=useState(()=>mathematicalValueSession(value)),[sample,setSample]=useState<number|null>(null);
 const pickingRef=useRef(false);pickingRef.current=picking;
 const pickCancel=useRef(operation?.selection?.cancel);pickCancel.current=operation?.selection?.cancel;
 const alive=useRef(true),callbacks=useRef({onPreview,cancel:scope.cancelPreview});callbacks.current={onPreview,cancel:scope.cancelPreview};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;if(pickingRef.current)pickCancel.current?.();if(session.sampling){const before=session.restore();if(callbacks.current.cancel)callbacks.current.cancel();else callbacks.current.onPreview(before);}};},[session]);
 useLayoutEffect(()=>{if(session.receive(value))setSample(null);},[value,session]);
 const restore=()=>{hoverTurn.current=undefined;setSample(null);if(session.sampling){const before=session.restore();if(scope.cancelPreview)scope.cancelPreview();else onPreview(before);}};
 const show=(kind:Settings['kind'])=>{restore();setSettings({kind,point:cursorPosition()});};
 const parked=useCursorParking(zone),reference=operation?.selection?.current;
 const expression=selectionExpression(working.count);
 const countLabel=expression.base?<>{expression.base}<sup>{expression.power}</sup></>:<>{expression.count}</>;
 const controls=<><button type="button" title={label} onClick={()=>show('parameters')}>{symbol}</button><button type="button" title={`${mode.label} · right-click chooses mode`} onClick={()=>show('parameters')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('modes');}}>{mode.icon} {mode.label}</button><button type="button" title="Edit mode state count" onClick={()=>show('count')}>{countLabel}</button><button type="button" title="Reference" onClick={()=>show('reference')}>⟴ {picking?'Pick':operation?.selection?.unavailable?'Unavailable':reference?reference.label:'Self'}</button></>;
 const cursor=useMemo(()=>({key:`state:${zone}`,zone,priority:45,icon:<span>{symbol}</span>,width:20,height:20,parked:parked??undefined,controls}),[zone,symbol,parked,working.mode,working.count,reference?.id,operation?.selection?.unavailable,picking]);
 useToolCursor(cursor);
 useLayoutEffect(()=>{const node=root.current;if(!node)return;setToolCursorZone(node,zone,true);return()=>setToolCursorZone(node,undefined);},[zone]);
 useContextNavigation({owner:root,cancel:picking?()=>operation?.selection?.cancel():sample!==null?restore:undefined});
 const origin=reference?.value??domain.north,referenceTurn=(origin-domain.north)/domain.period;
 const count=parameterSample.count??working.count,step=parameterSample.step??working.step;
 const turns=useMemo(()=>selectionTurns(working.mode,count,step,domain.period),[working.mode,count,step,domain.period]);
 const slots=useMemo(()=>selectionLayout(turns,72),[turns]);
 const preview=(turn:number)=>{if(settings||picking||parked||operation?.selection?.unavailable)return;const n=selectionValue(turn,origin,domain,min,max);if(n===undefined)return;if(session.sampling&&session.expected===n)return;hoverTurn.current=turn;setSample(n);onPreview(session.preview(n));};
 const apply=(turn:number)=>{if(picking||operation?.selection?.unavailable)return;const n=selectionValue(turn,origin,domain,min,max);if(n===undefined)return;setSample(null);onCommit(session.commit(n));};
 const closeSettings=()=>{setParameterSample({});restore();setSettings(null);};
 const chooseMode=(next:StateSelectionMode)=>{restore();working.modeChange(next);if(working.count>maximumSelectionStates(next))working.countChange(maximumSelectionStates(next));setSettings({kind:next==='step'?'step':'modes',point:settings?.point??cursorPosition()});};
 const pickReference=async()=>{restore();setSettings(null);if(!operation?.selection)return;setPicking(true);await operation.selection.pick();if(alive.current)setPicking(false);};
 return <div ref={root} className="dof-state-editor" data-ui-popup-interior onMouseLeave={restore}>
  <div className="dof-state-wheel" role="group" aria-label={`${label} states`}
   onPointerEnter={event=>{wheelBounds.current=event.currentTarget.getBoundingClientRect();}}
   onPointerMove={event=>{if(settings||picking||parked)return;const box=wheelBounds.current;if(!box)return;const dx=event.clientX-box.left-box.width/2,dy=event.clientY-box.top-box.height/2,r=Math.hypot(dx,dy);if(r<box.width/10||r>box.width/2){restore();return;}const turn=nearestSelectionTurn(turns,Math.atan2(dx,-dy)/(2*Math.PI)-referenceTurn);if(turn!==undefined)preview(turn);}}
   onPointerLeave={restore} onClick={event=>{if(event.target instanceof Element&&event.target.closest('button,[data-dial-drag]'))return;if(hoverTurn.current!==undefined)apply(hoverTurn.current);}}>
   <svg viewBox="0 0 180 180" aria-hidden="true"><circle cx="90" cy="90" r="72"/>{turns.map(turn=>{const angle=(turn+referenceTurn)*Math.PI*2;return <line key={turn} x1="90" y1="90" x2={90+Math.sin(angle)*72} y2={90-Math.cos(angle)*72}/>;})}</svg>
   {turns.map((turn,i)=>{const a=(turn+referenceTurn)*Math.PI*2,n=selectionValue(turn,origin,domain,min,max);return <button key={turn} type="button" disabled={n===undefined||picking} className="dof-state-slot" style={{left:`${50+Math.sin(a)*40}%`,top:`${50-Math.cos(a)*40}%`,width:slots[i].diameter,height:slots[i].diameter}} aria-label={`${label} ${n} degrees`} title={`${i} · ${n}°`} data-preview={sample===n} onMouseEnter={()=>preview(turn)} onMouseLeave={restore} onFocus={()=>preview(turn)} onBlur={restore} onClick={()=>apply(turn)}/>;})}
   <output className="dof-state-readout" data-dial-drag role="button" tabIndex={0} title="Drag dial">{symbol} {Math.round((sample??value)*1e5)/1e5}°</output>
  </div>
  <div className="dof-state-mode" aria-label="DOF mode selector">
   <button type="button" title="Left-click configures mode; right-click chooses a mode" onClick={()=>show('parameters')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('modes');}}>{mode.icon} {mode.label}</button>
   <button type="button" aria-label={`${working.count} states; edit with mathematical dial`} title="Edit state count" onClick={()=>show('count')}>{countLabel}</button>
  </div>
  {settings&&<ContextualMasterController radial title={`${label} mode`} stage={settings.kind} position={settings.point} onClose={closeSettings} onDismiss={closeSettings} onConfirm={closeSettings}>
   {settings.kind==='modes'?<RadialMenu onClose={closeSettings} items={(Object.keys(modes) as StateSelectionMode[]).map(kind=>({id:kind,symbol:modes[kind].icon,label:kind==='step'?'Add step rule':modes[kind].label,content:<button type="button" title={modes[kind].label} aria-pressed={working.mode===kind} onClick={()=>chooseMode(kind)}>{modes[kind].icon}<small>{kind==='step'?'+':modes[kind].label}</small></button>}))}/>:
    settings.kind==='parameters'?<RadialMenu onClose={closeSettings} items={[{id:'states',symbol:'●●',label:'States',content:<button type="button" title="Number of offered states" onClick={()=>show('count')}>{countLabel}</button>},...(working.mode==='step'?[{id:'step',symbol:'Δ',label:'Step',content:<button type="button" title="Step angle" onClick={()=>show('step')}>Δ {working.step}°</button>}]:[])]}/>:
    settings.kind==='reference'?<RadialMenu onClose={closeSettings} items={[{id:'self',symbol:'⟴',label:'Self',content:<button type="button" title="Use own north reference" onClick={()=>{restore();operation?.selection?.clear();}}>⟴ Self</button>},...(operation?.selection?[{id:'pick',symbol:'⨮',label:'Match reference',content:<button type="button" title="Click another object with a compatible orientation" onClick={()=>{void pickReference();}}>⨮ Match</button>}]:[])]}/>:
    <MathematicalDial key={settings.kind} label={settings.kind==='count'?'States':'Step angle'} value={settings.kind==='count'?count:step} min={1} max={settings.kind==='count'?maximumSelectionStates(working.mode):domain.period} integer={settings.kind==='count'} onPreview={n=>setParameterSample(settings.kind==='count'?{count:n}:{step:n})} onCancelPreview={()=>setParameterSample({})} onCommit={n=>{setParameterSample({});if(settings.kind==='count')working.countChange(n);else working.stepChange(n);}}/>}
  </ContextualMasterController>}
 </div>;
}
