import {HoverValue} from '../ui/HoverPreview';
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
type SetterProps={recipe:Recipe;degree:EditableDegree;onPreview:(value:string|number|boolean)=>void;onCommit:(value:string|number|boolean)=>void;onOpen:()=>void};
export function DegreeSetter(props:SetterProps){
 const {recipe,degree,onPreview,onCommit}=props,parameter=targetParameter(degree),value=targetDegreeValue(recipe,degree),control=<DegreeControl {...props}/>;
 if(degree.axes||degree.properties.length!==1)return control;
 if(parameter.kind==='color'){const spectrum=colorSpectrum(String(value)),color=(h:number)=>h===spectrum.hue?String(value):spectrum.color(h);return <HoverValue value={spectrum.hue} min={0} max={359} step={1} pixelsPerStep={1} preview={h=>onPreview(color(h))} commit={h=>onCommit(color(h))}>{control}</HoverValue>;}
 if(parameter.kind==='number')return <HoverValue value={Number(value)} min={parameter.min!} max={parameter.max!} step={parameter.step??1} preview={onPreview} commit={onCommit}>{control}</HoverValue>;
 const choices=parameter.kind==='toggle'?[false,true]:parameter.kind==='select'?parameter.options?.map(option=>option.id):undefined;
 if(choices?.length)return <HoverValue value={Math.max(0,choices.findIndex(option=>option===value))} min={0} max={choices.length-1} step={1} preview={i=>onPreview(choices[i])} commit={i=>onCommit(choices[i])}>{control}</HoverValue>;
 return control;
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


function colorSpectrum(value:string){
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
 const hue=d===0?0:((max===rgb[0]?(rgb[1]-rgb[2])/d:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60+360)%360;
 const color=(h:number)=>{const x=1-Math.abs((h/60)%2-1),parts=h<60?[1,x,0]:h<120?[x,1,0]:h<180?[0,1,x]:h<240?[0,x,1]:h<300?[x,0,1]:[1,0,x];return '#'+parts.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');};
 return {hue:Math.round(hue)%360,color};
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
