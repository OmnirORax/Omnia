import {HoverGesture} from '../ui/HoverPreview';
import {createDegreeHover,colorSpectrum} from './degreeHover.ts';
import {ReferenceRegionEditor} from './ReferenceRegionEditor';
import {PathRuleEditor} from './PathRuleEditor';
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
import {useOperationReferencePicker} from './OperationScope';
import {VectorDegreeEditor} from './VectorDegreeEditor';
import type {DofSettingsKind} from '../ui/DofInformation';
import {DofStateField} from '../ui/DofStateField';
import {stateFieldDomain} from './stateFieldAdapter';
import {OperationDegreeScope} from './OperationScope';
import { RangeControl } from '../ui/RangeControl';
import type { Recipe } from './model';
import type { EditableDegree } from '../properties/editableDegrees';
import { type DegreeEditValue, targetParameter, targetDegreeValue } from './targetDegrees';
import { PropertyEditor } from '../appearance/Controls';
import { useNumericEditor } from '../ui/NumericEditorScope';
/** The compact strip is the same shared numeric editor, with its secondary
 * controls available through the DOF's existing right-click configuration. */
type SetterProps={recipe:Recipe;degree:EditableDegree;onPreview:(value:DegreeEditValue)=>void;onCommit:(value:DegreeEditValue)=>void;onOpen:()=>void};
export function DegreeSetter(props:SetterProps){
 const {recipe,degree,onPreview,onCommit}=props,numeric=useNumericEditor();
 return <HoverGesture create={()=>createDegreeHover(recipe,degree,onPreview,onCommit,numeric.cancelPreview)}><DegreeControl {...props}/></HoverGesture>;
}

function DegreeControl({recipe,degree,onPreview,onCommit,onOpen}:SetterProps) {
  const parameter=targetParameter(degree),value=targetDegreeValue(recipe,degree);
  const numericEditor=useNumericEditor();
 if((numericEditor.mathematical||degree.axes)&&!degree.action)return <button type="button" aria-label={`Open ${degree.label}`} title={degree.label} onClick={onOpen}>{degree.symbol??'⠒❉'}</button>;
  if(degree.action)return <button type="button" aria-label={`Configure ${degree.label}`} title={`Configure ${degree.label}`} onClick={onOpen}/>;
  if(parameter.kind==='color')return <SpectrumSetter value={String(value)} onPreview={onPreview} onCommit={onCommit}/>;
  if(parameter.kind==='number')return <PropertyEditor property={degree.properties[0]} label={degree.label} value={value} limits={{min:parameter.min!,max:parameter.max!,step:parameter.step}} onPreview={onPreview} onCommit={onCommit}/>;
  return <button type="button" aria-label={`${degree.label}: ${value}`} title={`${degree.label} · ${value}`} style={{opacity:value===false ? .3 : 1}} onClick={()=>{
    if(parameter.kind==='toggle')onCommit(!value);
    else if(parameter.kind==='select'&&parameter.options?.length){const options=parameter.options;onCommit(options[(options.findIndex(option=>option.id===value)+1)%options.length].id);}
    else onOpen();
  }}/>;
}


function SpectrumSetter({value,onPreview,onCommit}:{value:string;onPreview:(value:string)=>void;onCommit:(value:string)=>void}){
 const {hue,color}=colorSpectrum(value),editing=useRef(false),before=useRef(value);
 if(!editing.current)before.current=value;
 return <RangeControl aria-label="Color spectrum" value={hue} min={0} max={359} step={1} pixelsPerStep={1} onValueChange={v=>{editing.current=true;onPreview(color(v));}} onValueCommit={v=>{editing.current=false;onCommit(color(v));}} onValueCancel={()=>{editing.current=false;onPreview(before.current);}}/>;
}

/** One metadata-selected value editor for preset and selected-target requests. */
export function DegreeValueEditor({recipe,degree,configure=false,pickReference=true,onPreview,onCommit,onDismiss}:{recipe:Recipe;degree:EditableDegree;configure?:boolean|DofSettingsKind;pickReference?:boolean;onDismiss?:()=>void;onPreview:(value:DegreeEditValue)=>void;onCommit:(value:DegreeEditValue)=>void}){
 const parameter=targetParameter(degree),references=parameter.kind==='number';
 const entry=references?(configure===false&&pickReference?'source':configure):configure==='source'?false:configure,numeric=useNumericEditor(),targetKey=[...new Set(degree.targets.map(t=>t.id))].join('|');
 useLayoutEffect(()=>{if(references)numeric.activateDegree?.([...new Set(degree.targets.map(t=>t.id))],degree.id);},[numeric.activateDegree,degree.id,targetKey,references]);
 if(degree.axes)return <VectorDegreeEditor recipe={recipe} degree={degree} configure={entry} onPreview={onPreview} onCommit={onCommit} onDismiss={onDismiss}/>;
 const value=targetDegreeValue(recipe,degree),domain=stateFieldDomain(parameter);
 if(parameter.editor==='reference-region')return <ReferenceRegionEditor configure={configure} targets={[...new Set(degree.targets.map(t=>t.id))]} onDismiss={onDismiss}/>;
 if(parameter.editor==='path-rule')return <PathRuleEditor value={String(value)} onCommit={onCommit}/>;
 return <OperationDegreeScope degree={degree}>{domain?<DofStateField property={degree.properties[0]} label={degree.label} symbol={degree.symbol} domain={domain} value={Number(value)} configure={entry} onDismiss={onDismiss} onPreview={onPreview} onCommit={onCommit}/>:<ReferencedProperty degree={degree} picking={entry==='source'} onDismiss={onDismiss}><PropertyEditor autoOpen={configure===false} numericPresentation="inline" property={degree.properties[0]} label={degree.label} value={value} configuration={configure===true?'step':undefined} choices={parameter.options?.map(option=>option.id)} onPreview={onPreview} onCommit={onCommit}/></ReferencedProperty>}</OperationDegreeScope>;
}

/** Categorical freedoms share source selection and retain their actual editor. */
function ReferencedProperty({degree,picking,children,onDismiss}:{degree:EditableDegree;picking:boolean;children:ReactNode;onDismiss?:()=>void}){
 const picker=useOperationReferencePicker(),latest=useRef(picker);latest.current=picker;
 const [ready,setReady]=useState(!picking),degreeRef=useRef(degree);degreeRef.current=degree;
 const requestOwner=useRef(Symbol());
 const targetKey=`${degree.id}:${[...new Set(degree.targets.map(t=>t.id))].join('|')}`;
 useLayoutEffect(()=>{if(!picking){setReady(true);return;}setReady(false);let active=true,completed=false;const scope=latest.current;if(!scope){setReady(true);return;}
  void scope.pickSource(degreeRef.current,requestOwner.current).then(source=>{completed=true;if(active){if(source)setReady(true);else onDismiss?.();}});
  return()=>{active=false;if(!completed)scope.cancelPick(requestOwner.current);};
 },[picking,targetKey]);
 return ready?children:null;
}
