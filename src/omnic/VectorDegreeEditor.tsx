import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ContextualMasterController} from '../ui/ContextualMasterController';
import {cursorPosition} from '../ui/cursorPosition';
import {useWorkingSelectionReader} from '../ui/RangeControl';
import {DofStateField} from '../ui/DofStateField';
import type {DofSettingsKind} from '../ui/DofInformation';
import {useNumericEditor} from '../ui/NumericEditorScope';
import {mathematicalValueSession} from '../properties/mathematicalDial';
import {sameVector,vectorMatchCandidate,type VectorValue} from '../properties/vectorStateField';
import type {EditableDegree} from '../properties/editableDegrees';
import {DegreeValueEditor} from './DegreeSetter';
import {OperationDegreeScope,useOperationReferencePicker} from './OperationScope';
import {stateFieldDomain} from './stateFieldAdapter';
import {targetDegreeValue,targetParameter,writeTargetDegree,type DegreeEditValue} from './targetDegrees';
import type {Recipe} from './model';
/** Vector adapter only: all controls and rules remain in the shared DOF editor.
 * Scene execution uses prepared component fields; exact matches commit one tuple. */
export function VectorDegreeEditor({recipe,degree,configure,onPreview,onCommit,onDismiss}:{recipe:Recipe;degree:EditableDegree;configure?:boolean|DofSettingsKind;onPreview:(value:DegreeEditValue)=>void;onCommit:(value:DegreeEditValue)=>void;onDismiss?:()=>void}){
 const scope=useOperationReferencePicker(),numeric=useNumericEditor(),axes=degree.axes!;
 const [axis,setAxis]=useState<EditableDegree>(),[point,setPoint]=useState(()=>cursorPosition());
 const current=Object.fromEntries(axes.map(a=>[a.properties[0],Number(targetDegreeValue(recipe,a))]));
 const [session]=useState(()=>mathematicalValueSession<VectorValue>(current,sameVector));
 const callbacks=useRef({onPreview,cancel:numeric.cancelPreview});callbacks.current={onPreview,cancel:numeric.cancelPreview};
 useLayoutEffect(()=>{session.receive(current);},[recipe]);
 useEffect(()=>()=>{if(session.sampling){const before=session.restore();if(callbacks.current.cancel)callbacks.current.cancel();else callbacks.current.onPreview(before);}},[session]);
 const readRule=useWorkingSelectionReader(),limitsKey=JSON.stringify(axes.map(a=>{const r=readRule(a.properties[0]);return [r?.min,r?.max];}));
 const candidate=useMemo(()=>vectorMatchCandidate(axes.map(a=>({property:a.properties[0],domain:stateFieldDomain(targetParameter(a))!,reference:scope?.reference(a,degree),limits:readRule(a.properties[0])})),value=>{try{writeTargetDegree(scope?.snapshot?.recipe??recipe,degree,value);return true;}catch{return false;}}),[scope,degree,recipe,limitsKey]);
 const domain=stateFieldDomain(targetParameter(axes[0]))!;
 if(axis)return <ContextualMasterController radial title={axis.label} position={point} onClose={()=>{numeric.cancelPreview?.();setAxis(undefined);}} onDismiss={onDismiss}>
  <DegreeValueEditor recipe={recipe} degree={axis} onPreview={value=>{if(typeof value==='number')onPreview({[axis.properties[0]]:value});}} onCommit={value=>{if(typeof value==='number')onCommit({[axis.properties[0]]:value});}} onDismiss={()=>setAxis(undefined)}/>
 </ContextualMasterController>;
 return <OperationDegreeScope degree={degree}><DofStateField property={degree.id} label={degree.label} symbol={degree.symbol} domain={domain} value={current[axes[0].properties[0]]}
  configure={configure} execution="scene" workingKeys={axes.flatMap(a=>a.properties)} onDismiss={onDismiss}
  components={axes.map(a=>({id:a.id,label:a.label,symbol:a.symbol??a.label,content:<button type="button" title={`${a.label} only`} onClick={()=>{numeric.cancelPreview?.();setPoint(cursorPosition());setAxis(a);}}>{a.symbol??a.label}</button>}))}
  disabled={scope?.settings(degree).use==='match'&&!candidate}
  onPreview={()=>{if(candidate&&(!session.sampling||!sameVector(session.expected,candidate)))onPreview(session.preview(candidate));}} onCommit={()=>{if(candidate)onCommit(session.commit(candidate));}}/>
 </OperationDegreeScope>;
}
