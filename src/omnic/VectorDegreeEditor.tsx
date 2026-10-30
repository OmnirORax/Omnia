import {ContextualMasterController} from '../ui/ContextualMasterController';
import {cursorPosition} from '../ui/cursorPosition';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {EditableDegree} from '../properties/editableDegrees';
import {mathematicalValueSession} from '../properties/mathematicalDial';
import {sameVector,vectorMatchCandidate,type VectorValue} from '../properties/vectorStateField';
import {useContextNavigation} from '../ui/ContextStage';
import {RadialMenu} from '../ui/RadialMenu';
import {useNumericEditor} from '../ui/NumericEditorScope';
import type {DofInformationState,DofSettingsKind} from '../ui/DofInformation';
import {DegreeValueEditor} from './DegreeSetter';
import {useOperationReferencePicker} from './OperationScope';
import {stateFieldDomain} from './stateFieldAdapter';
import {targetDegreeValue,writeTargetDegree,type DegreeEditValue} from './targetDegrees';
import type {Recipe} from './model';
/** A vector executes one tuple through its existing owner, with scalar axes optional. */
export function VectorDegreeEditor({recipe,degree,configure,onPreview,onCommit,onDismiss}:{recipe:Recipe;degree:EditableDegree;configure?:boolean|DofSettingsKind;onPreview:(value:DegreeEditValue)=>void;onCommit:(value:DegreeEditValue)=>void;onDismiss?:()=>void}){
 const scope=useOperationReferencePicker(),numeric=useNumericEditor(),root=useRef<HTMLDivElement>(null),axes=degree.axes??[];
 const vector=degree.targets[0]?.input.freedom?.vector,matchLabel=vector?.matchLabel??'Match vector',matchSymbol=vector?.matchSymbol??'⨮';
 const [axis,setAxis]=useState<EditableDegree>(),[axisPoint,setAxisPoint]=useState(()=>cursorPosition()),[axisSettings,setAxisSettings]=useState(configure==='relation'),[picking,setPicking]=useState(false),alive=useRef(true),pickGeneration=useRef(0),pickingRef=useRef(false);pickingRef.current=picking;
 const current=Object.fromEntries(axes.map(a=>[a.properties[0],Number(targetDegreeValue(recipe,a))]));
 const [session]=useState(()=>mathematicalValueSession<VectorValue>(current,sameVector)),[sampling,setSampling]=useState(false);
 const callbacks=useRef({onPreview,cancel:numeric.cancelPreview,cancelPick:scope?.cancelPick});callbacks.current={onPreview,cancel:numeric.cancelPreview,cancelPick:scope?.cancelPick};
 useLayoutEffect(()=>{if(session.receive(current))setSampling(false);},[recipe]);
 const restore=()=>{if(session.sampling){const before=session.restore();if(numeric.cancelPreview)numeric.cancelPreview();else onPreview(before);}setSampling(false);};
 const candidate=useMemo(()=>{
  const components=axes.map(a=>({property:a.properties[0],domain:stateFieldDomain(a.targets[0].input as Parameters<typeof stateFieldDomain>[0]),reference:scope?.reference(a,degree)}));
  if(components.some(a=>!a.domain))return;
  return vectorMatchCandidate(components as Parameters<typeof vectorMatchCandidate>[0],value=>{try{writeTargetDegree(scope?.snapshot?.recipe??recipe,degree,value);return true;}catch{return false;}});
 },[scope,degree,recipe]);
 const preview=()=>{if(candidate&&!picking){setSampling(true);onPreview(session.preview(candidate));}};
 const apply=()=>{if(candidate&&!picking){setSampling(false);scope?.changeSettings(degree,{use:'match',measure:'context'});onCommit(session.commit(candidate));}};
 const pick=async()=>{restore();if(!scope)return;const generation=++pickGeneration.current;setPicking(true);await scope.pick(degree);if(alive.current&&generation===pickGeneration.current)setPicking(false);};
 const chooseDegrees=()=>{restore();numeric.showDegrees?.([...new Set(degree.targets.map(t=>t.id))]);};
 const handlers=useRef({pick,chooseDegrees,toggle:()=>{}});handlers.current={pick,chooseDegrees,toggle:()=>{restore();setAxisSettings(before=>!before);}};
 useEffect(()=>{if(configure==='reference')void handlers.current.pick();},[configure]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;pickGeneration.current++;if(pickingRef.current)callbacks.current.cancelPick?.();if(session.sampling){const before=session.restore();if(callbacks.current.cancel)callbacks.current.cancel();else callbacks.current.onPreview(before);}};},[session]);
 useContextNavigation({owner:root,back:axisSettings?()=>setAxisSettings(false):undefined,cancel:picking?()=>scope?.cancelPick():sampling?restore:undefined,confirm:axis||axisSettings?undefined:apply});
 const ids=[...new Set(degree.targets.map(t=>t.id))];
 const information=useMemo<DofInformationState>(()=>({label:degree.label,symbol:degree.symbol??'⊕',mode:matchLabel,modeIcon:'⨮',variable:'count',expression:matchSymbol,reference:scope?.references.get(ids[0])??'Self',ruleControls:false,referenceUse:'match',configure:kind=>{if(kind==='reference')void handlers.current.pick();else{restore();setAxis(undefined);setAxisSettings(true);}},degrees:()=>handlers.current.chooseDegrees()}),[scope?.references,degree]);
 useLayoutEffect(()=>axis?undefined:numeric.registerInformation?.(information,3),[axis,numeric.registerInformation,information]);
 useLayoutEffect(()=>{if(!axis)numeric.activateDegree?.(ids,degree.id);},[axis,degree.id,ids.join('|'),numeric.activateDegree]);
 useLayoutEffect(()=>axis?undefined:numeric.registerOptions?.(()=>handlers.current.toggle()),[axis,numeric.registerOptions]);
 if(axis)return <ContextualMasterController radial title={axis.label} position={axisPoint} onClose={()=>{numeric.cancelPreview?.();setAxis(undefined);}} onDismiss={()=>{setAxis(undefined);onDismiss?.();}}><DegreeValueEditor recipe={recipe} degree={axis} onPreview={value=>{if(typeof value==='number')onPreview({[axis.properties[0]]:value});}} onCommit={value=>{if(typeof value==='number')onCommit({[axis.properties[0]]:value});}} onDismiss={()=>setAxis(undefined)}/></ContextualMasterController>;
 return <div ref={root} className="dof-state-editor" data-ui-popup-interior>
  <RadialMenu onClose={()=>{restore();onDismiss?.();}} items={[
   ...(!axisSettings?[{id:'reference',label:'Reference',symbol:'⟴',content:<button type="button" title="Select reference for the whole vector" disabled={picking} onClick={()=>void pick()}>⟴</button>},
   {id:'centre',label:matchLabel,symbol:matchSymbol,content:<button type="button" title={`${matchLabel} · hover previews; click applies all components`} aria-label={matchLabel} disabled={!candidate||picking} onMouseEnter={preview} onMouseLeave={restore} onFocus={preview} onBlur={restore} onPointerDown={event=>{if(event.button===0)event.preventDefault();}} onClick={apply}>{matchSymbol}</button>}]:[]),
   ...axes.map(a=>({id:a.id,label:a.label,symbol:a.symbol??a.label,content:<button type="button" title={`${a.label} only`} onClick={()=>{restore();setAxisPoint(cursorPosition());setAxis(a);}}>{a.symbol??a.label}</button>}))
  ]}/>
 </div>;
}
