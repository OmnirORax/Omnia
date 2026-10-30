import {createReferenceField} from '../properties/referenceUse';
import {rangeLabel} from './rangeMath';
import {DofAxisWheel} from './DofAxisWheel';
import {DofRuleExpression,dofModePresentation,dofModes as modes,type DofSettingsKind,type DofInformationState} from './DofInformation';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {maximumSelectionStates,type StateSelectionMode} from '../properties/stateSelection';
import {createStateField,fieldLimits,type StateFieldDomain} from '../properties/stateField';
import {mathematicalValueSession} from '../properties/mathematicalDial';
import {RangeControl,useWorkingSelection} from './RangeControl';
import {useNumericEditor,useNumericOperation} from './NumericEditorScope';
import {cursorPosition} from './cursorPosition';
import {ContextualMasterController} from './ContextualMasterController';
import {MathematicalDial} from './MathematicalDial';
import {RadialMenu} from './RadialMenu';
import {useContextNavigation} from './ContextStage';
import './dofStateField.css';

type Settings={kind:Exclude<DofSettingsKind,'reference'>;point:{x:number;y:number}};
/** Projection-independent interaction. Domains/rules/constraints prepare a field;
 * pointer picking never discovers scene objects or implements property arithmetic. */
export function DofStateField({property,label,symbol='⠒❉',domain,value,disabled=false,configure=false,onPreview,onCommit,onDismiss}:{property:string;label:string;symbol?:string;domain:StateFieldDomain;value:number;disabled?:boolean;configure?:boolean|DofSettingsKind;onDismiss?:()=>void;onPreview:(value:number)=>void;onCommit:(value:number)=>void}){
 const root=useRef<HTMLDivElement>(null),scope=useNumericEditor(),operation=useNumericOperation();
 const targetsKey=operation?.targets?.join('|')??'';
 useLayoutEffect(()=>scope.activateDegree?.(operation?.targets??[],property),[scope.activateDegree,targetsKey,property]);
 const span=domain.max-domain.min;
 const working=useWorkingSelection(property,span,domain.integer?'step':'symmetry',domain.integer?Math.max(1,domain.resolution):domain.cyclic?domain.cyclic.period/8:domain.resolution);
 const referenceUse=operation?.selection?.relation?.settings.use;
 const mode=dofModePresentation(working.mode,!!domain.cyclic,referenceUse);
 const settingKind=(kind:DofSettingsKind):DofSettingsKind=>referenceUse&&referenceUse!=='bounds'?(kind==='modes'||kind==='parameters'?'relation':kind==='step'?'numerator':kind):kind;
 const [settings,setSettings]=useState<Settings|null>(()=>configure&&configure!=='reference'?{kind:settingKind(typeof configure==='string'?configure:'options') as Exclude<DofSettingsKind,'reference'>,point:cursorPosition()}:null),[picking,setPicking]=useState(configure==='reference');
 const [parameterSample,setParameterSample]=useState<{count?:number;step?:number;min?:number;max?:number}>({});
 const anchor=useRef(domain.cyclic?.north??value),[session]=useState(()=>mathematicalValueSession(value)),[sample,setSample]=useState<number|null>(null);
 const pickGeneration=useRef(0);
 const pickingRef=useRef(false);pickingRef.current=picking;
 const pickCancel=useRef(operation?.selection?.cancel);pickCancel.current=operation?.selection?.cancel;
 const alive=useRef(true),callbacks=useRef({onPreview,cancel:scope.cancelPreview});callbacks.current={onPreview,cancel:scope.cancelPreview};
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pickGeneration.current++;if(pickingRef.current)pickCancel.current?.();if(session.sampling){const before=session.restore();if(callbacks.current.cancel)callbacks.current.cancel();else callbacks.current.onPreview(before);}};},[session]);
 useLayoutEffect(()=>{if(session.receive(value)){anchor.current=domain.cyclic?.north??value;setSample(null);}},[value,session]);
 const restore=()=>{setSample(null);if(session.sampling){const before=session.restore();if(scope.cancelPreview)scope.cancelPreview();else onPreview(before);}};
 const show=(requested:DofSettingsKind)=>{let kind=settingKind(requested);if(kind==='reference'){void pickReference();return;}if(kind==='step'&&referenceUse&&referenceUse!=='bounds')kind='numerator';restore();setParameterSample({});setSettings({kind,point:cursorPosition()});};
 const reference=operation?.selection?.current,relation=operation?.selection?.relation;
 const relationLabel=relation?`${relation.settings.use} · ${relation.measures.find(m=>m.id===relation.settings.measure)?.label??"unavailable measurement"}`:"";
 const countLabel=<DofRuleExpression count={working.count}/>;
 const infoActions=useRef({show,degrees:()=>{closeSettings();scope.showDegrees?.(operation?.targets??[]);}});infoActions.current={show,degrees:()=>{closeSettings();scope.showDegrees?.(operation?.targets??[]);}};
 const information=useMemo<DofInformationState>(()=>({label,symbol,mode:mode.label,modeIcon:mode.icon,variable:referenceUse==='match'||referenceUse==='step'||working.mode==='step'?'step':'count',expression:referenceUse==='match'?`= ${rangeLabel(reference?.match??value)}`:working.mode==='step'?`Δ ${rangeLabel(reference?.step??working.step)}`:countLabel,referenceUse:relation?.settings.use,reference:`${reference?.label??relation?.sourceLabel??'Self'}${relationLabel?` · ${relationLabel}`:''}`,configure:kind=>infoActions.current.show(kind),degrees:()=>infoActions.current.degrees()}),[label,symbol,mode.label,mode.icon,working.count,working.step,reference?.step,reference?.label,relation?.sourceLabel,relationLabel,referenceUse,reference?.match,value]);
 useLayoutEffect(()=>scope.registerInformation?.(information,2),[scope.registerInformation,information]);
 const toggle=useRef(()=>{});toggle.current=()=>{restore();setParameterSample({});setSettings(before=>before?null:{kind:'options',point:cursorPosition()});};
 useLayoutEffect(()=>scope.registerOptions?.(()=>toggle.current()),[scope.registerOptions]);
 useContextNavigation({owner:root,cancel:picking?()=>operation?.selection?.cancel():sample!==null?restore:undefined,confirm:domain.cyclic&&!settings&&!picking?()=>{if(sample!==null)apply(sample);}:undefined});
 const count=parameterSample.count??working.count,step=parameterSample.step??reference?.step??working.step;
 const {min:low,max:high}=fieldLimits(domain,reference,{min:parameterSample.min??working.min,max:parameterSample.max??working.max});
 const referenceValue=reference?.value??anchor.current,allowed=operation?.allowed;
 const field=useMemo(()=>createReferenceField(domain,{mode:working.mode,count,step,reference:referenceValue,min:low,max:high},reference,allowed),
  [domain.min,domain.max,domain.integer,domain.resolution,domain.projection,domain.cyclic?.period,domain.cyclic?.north,working.mode,count,step,referenceValue,reference?.id,low,high,allowed,domain.thresholds,reference]);
 const limitField=useMemo(()=>createStateField(domain,{mode:working.mode,count,step,reference:referenceValue,referenceId:reference?.id,...fieldLimits(domain,reference),thresholds:reference?.thresholds}),[domain,working.mode,count,step,referenceValue,reference]);
 const limitValues=useMemo(()=>limitField.candidates.map(c=>c.value),[limitField]);
 const generatedValues=useMemo(()=>field.candidates.map(candidate=>candidate.value),[field]);
 const preview=(n:number)=>{if(disabled||settings||picking||operation?.selection?.unavailable)return;if(session.sampling&&session.expected===n)return;setSample(n);onPreview(session.preview(n));};
 const apply=(n:number)=>{if(disabled||picking||operation?.selection?.unavailable||!field.candidates.some(candidate=>candidate.value===n))return;setSample(null);relation?.change({});onCommit(session.commit(n));};
 const closeSettings=()=>{setParameterSample({});restore();setSettings(null);};
 const chooseMode=(next:StateSelectionMode)=>{restore();working.modeChange(next);if(working.count>maximumSelectionStates(next))working.countChange(maximumSelectionStates(next));setSettings({kind:next==='step'?'step':'modes',point:settings?.point??cursorPosition()});};
 const pickReference=async()=>{restore();setSettings(null);if(!operation?.selection){setPicking(false);return;}const generation=++pickGeneration.current;setPicking(true);const next=await operation.selection.pick();if(alive.current&&pickGeneration.current===generation){if(next&&next.id!==reference?.id)working.clearLimits();setPicking(false);}};
 const openReference=useRef(pickReference);openReference.current=pickReference;
 useLayoutEffect(()=>{if(configure==='reference')void openReference.current();},[configure]);
 const text=(n:number)=>`${Number(n.toPrecision(7))}${domain.cyclic?'°':''}`;
 const numeric=settings?.kind==='numerator'||settings?.kind==='denominator'?{label:settings.kind==='numerator'?'Measurement multiplier':'Measurement divisor',value:relation?.settings[settings.kind]??1,min:1,max:512,integer:true,key:'step' as const,commit:(n:number)=>relation?.change({[settings.kind]:n})}:settings?.kind==='count'?{label:'Divisions',value:count,min:1,max:maximumSelectionStates(working.mode),integer:true,key:'count' as const,commit:working.countChange}:
  settings?.kind==='min'?{label:'Minimum',value:Math.max(domain.min,Math.min(domain.max,field.min)),min:domain.min,max:domain.max,integer:domain.integer,key:'min' as const,commit:working.minChange}:
  settings?.kind==='max'?{label:'Maximum',value:Math.max(domain.min,Math.min(domain.max,field.max)),min:domain.min,max:domain.max,integer:domain.integer,key:'max' as const,commit:working.maxChange}:
  {label:'Step',value:step,min:domain.cyclic?Math.min(domain.resolution,domain.cyclic.period):-Math.max(1,span),max:domain.cyclic?.period??Math.max(1,span),integer:domain.integer,key:'step' as const,commit:working.stepChange};
 return <div ref={root} className="dof-state-editor" aria-disabled={disabled} data-ui-popup-interior>
  {!settings&&!picking&&(domain.cyclic?<DofAxisWheel field={field} value={sample??value} label={label} symbol={symbol} disabled={disabled||!!operation?.selection?.unavailable} onPreview={preview} onCommit={apply} onCancel={restore} onConfigure={()=>show('options')}/>:<div className="dof-value-slider">
   <span className="dof-state-grip" data-dial-drag role="button" tabIndex={0} title="Move controls">{symbol}</span>
   <RangeControl aria-label={label} value={sample??value} min={field.min} max={field.max} step={domain.resolution} hardMin={domain.min} hardMax={domain.max}
    values={generatedValues} disabled={disabled||!!settings||picking||operation?.selection?.unavailable} onValueChange={preview} onValueCommit={apply} onValueCancel={restore}
    onMinimumChange={working.minChange} onMaximumChange={working.maxChange}
    onConfigure={(which,duringGesture)=>{if(duringGesture){show('options');return true;}if(which==='value')return false;show(which==='jump'?'parameters':which);return true;}}/>
   {!generatedValues.length&&<output title="No available values; edit the limits or rule">∅</output>}
  </div>)}
  {settings&&<ContextualMasterController radial dismissOutside title={`${label} mode`} stage={settings.kind} position={settings.point} onClose={closeSettings} onDismiss={()=>{closeSettings();onDismiss?.();}} onConfirm={closeSettings}>
   {settings.kind==='options'?<RadialMenu onClose={closeSettings} items={[
    {id:'dof',symbol:symbol,label:label,content:<button type="button" title="Choose DOF" onClick={()=>{closeSettings();scope.showDegrees?.(operation?.targets??[]);}}>{symbol}</button>},
    {id:'mode',symbol:mode.icon,label:mode.label,content:<button type="button" title="Configure mode · right-click chooses rule" onClick={()=>show('parameters')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('modes');}}>{mode.icon}</button>},
    {id:'expression',symbol:'⠒❉',label:'Rule variables',content:<button type="button" title="Edit rule expression" onClick={()=>show(working.mode==='step'?'step':'count')}>{working.mode==='step'?`Δ ${step}`:countLabel}</button>},
    {id:'reference',symbol:'⟴',label:'Relativity',content:<button type="button" title="Reference · right-click configures use" onClick={()=>show('reference')} onContextMenu={event=>{event.preventDefault();event.stopPropagation();show('relation');}}>⟴</button>},
    ...(relation?[{id:'reference-use',symbol:'⨮',label:'Reference use',content:<button type="button" title={`Reference use: ${relationLabel}`} onClick={()=>show('relation')}>⨮</button>}]:[])
   ]}/> :settings.kind==='relation'?<RadialMenu onClose={closeSettings} items={relation?[
    {id:'source',symbol:'⟴',label:'Reference',content:<button type="button" title="Select reference source" onClick={()=>show('reference')}>⟴</button>},
    {id:'measurement',symbol:'↔',label:'Measurement',content:<button type="button" title={`Measurement: ${relation.measures.find(m=>m.id===relation.settings.measure)?.label??'unavailable'}`} onClick={()=>show('measurements')}>↔</button>},
    ...(['bounds','step','match'] as const).map(use=>({id:use,symbol:use==='bounds'?'⊢⊣':use==='step'?'Δ':'⨮',label:use,content:<button type="button" aria-label={`Use reference as ${use}`} title={`Use reference as ${use}`} aria-pressed={relation.settings.use===use} onClick={()=>{restore();relation.change({use});if(use==='step')working.modeChange('step');working.clearLimits();}}>{use==='bounds'?'⊢⊣':use==='step'?'Δ':'⨮'}</button>})),
    ...(referenceUse==='step'?[{id:'states',symbol:'●●',label:'Offered steps',content:<button type="button" title="Number of offered steps" onClick={()=>show('count')}>{countLabel}</button>}]:[]),
    {id:'numerator',symbol:'×',label:'Multiplier',content:<button type="button" title={`Measurement multiplier: ${relation.settings.numerator}`} onClick={()=>show('numerator')}>×</button>},
    {id:'denominator',symbol:'÷',label:'Divisor',content:<button type="button" title={`Measurement divisor: ${relation.settings.denominator}`} onClick={()=>show('denominator')}>÷</button>}
   ]:[]}/>:settings.kind==='measurements'?<RadialMenu onClose={closeSettings} items={(relation?.measures??[]).map(measure=>({id:measure.id,symbol:measure.symbol,label:measure.label,content:<button type="button" title={`${measure.label}: ${rangeLabel(measure.value)} · ${measure.unit}`} aria-label={measure.label} aria-pressed={relation?.settings.measure===measure.id} onClick={()=>{restore();relation?.change({measure:measure.id});working.clearLimits();setSettings({kind:'relation',point:settings.point});}}>{measure.symbol}</button>}))}/>:settings.kind==='modes'?<RadialMenu onClose={closeSettings} items={(Object.keys(modes) as StateSelectionMode[]).map(kind=>({id:kind,symbol:modes[kind].icon,label:kind==='step'?'Add step rule':kind==='symmetry'&&domain.cyclic?'Symmetry':modes[kind].label,content:<button type="button" title={kind==='symmetry'&&domain.cyclic?'Symmetry':modes[kind].label} aria-pressed={working.mode===kind} onClick={()=>chooseMode(kind)}>{modes[kind].icon}</button>}))}/>:
    settings.kind==='parameters'?<RadialMenu onClose={closeSettings} items={[{id:'states',symbol:'●●',label:'Divisions',content:<button type="button" title="Generated divisions" onClick={()=>show(working.mode==='step'?'step':'count')}>{working.mode==='step'?`Δ ${step}`:countLabel}</button>},...(working.mode==='step'?[{id:'step',symbol:'Δ',label:'Step',content:<button type="button" title="Step" onClick={()=>show('step')}>Δ {text(step)}</button>}]:[]),...[{id:'minimum',symbol:'⊢',label:'Minimum',content:<button type="button" title="Minimum" onClick={()=>show('min')}>⊢</button>},{id:'maximum',symbol:'⊣',label:'Maximum',content:<button type="button" title="Maximum" onClick={()=>show('max')}>⊣</button>}]]}/>:

    (settings.kind==='min'||settings.kind==='max')?<div className="dof-rule-number"><RangeControl aria-label={numeric.label} value={parameterSample[numeric.key]??numeric.value} min={limitField.min} max={limitField.max} step={domain.resolution} values={limitValues} onValueChange={n=>setParameterSample({[numeric.key]:n})} onValueCancel={()=>setParameterSample({})} onValueCommit={n=>{setParameterSample({});numeric.commit(n);}}/><button type="button" title="Reset limits" aria-label="Reset limits" onClick={()=>{setParameterSample({});working.clearLimits();}}>↺</button></div>:
    <div className="dof-rule-number"><MathematicalDial key={settings.kind} label={numeric.label} value={numeric.value} min={numeric.min} max={numeric.max} integer={numeric.integer} onPreview={n=>setParameterSample({[numeric.key]:n})} onCancelPreview={()=>setParameterSample({})} onCommit={n=>{setParameterSample({});numeric.commit(n);}}/></div>}
  </ContextualMasterController>}
 </div>;
}
