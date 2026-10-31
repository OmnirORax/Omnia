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
export function DegreeSetter({recipe,degree,onPreview,onCommit,onOpen}: {recipe:Recipe;degree:EditableDegree;onPreview:(value:string|number|boolean)=>void;onCommit:(value:string|number|boolean)=>void;onOpen:()=>void}) {
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
 const rgb=[1,3,5].map(i=>parseInt(value.slice(i,i+2),16)/255),max=Math.max(...rgb),min=Math.min(...rgb),d=max-min;
 const hue=d===0?0:((max===rgb[0]?(rgb[1]-rgb[2])/d:max===rgb[1]?(rgb[2]-rgb[0])/d+2:(rgb[0]-rgb[1])/d+4)*60+360)%360;
 const color=(h:number)=>{const x=1-Math.abs((h/60)%2-1),parts=h<60?[1,x,0]:h<120?[x,1,0]:h<180?[0,1,x]:h<240?[0,x,1]:h<300?[x,0,1]:[1,0,x];return '#'+parts.map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');};
 return <RangeControl aria-label="Color spectrum" value={hue} min={0} max={359} step={1} onValueChange={v=>onPreview(color(v))} onValueCommit={v=>onCommit(color(v))} onValueCancel={()=>onPreview(value)}/>;
}

/** One metadata-selected value editor for preset and selected-target requests. */
export function DegreeValueEditor({recipe,degree,configure=false,onPreview,onCommit,onDismiss}:{recipe:Recipe;degree:EditableDegree;configure?:boolean|DofSettingsKind;onDismiss?:()=>void;onPreview:(value:DegreeEditValue)=>void;onCommit:(value:DegreeEditValue)=>void}){
 const entry=configure===false?'source':configure,numeric=useNumericEditor(),targetKey=[...new Set(degree.targets.map(t=>t.id))].join('|');
 useLayoutEffect(()=>numeric.activateDegree?.([...new Set(degree.targets.map(t=>t.id))],degree.id),[numeric.activateDegree,degree.id,targetKey]);
 if(degree.axes)return <VectorDegreeEditor recipe={recipe} degree={degree} configure={entry} onPreview={onPreview} onCommit={onCommit} onDismiss={onDismiss}/>;
 const parameter=targetParameter(degree),value=targetDegreeValue(recipe,degree),domain=stateFieldDomain(parameter);
 return <OperationDegreeScope degree={degree}>{domain?<DofStateField property={degree.properties[0]} label={degree.label} symbol={degree.symbol} domain={domain} value={Number(value)} configure={entry} onDismiss={onDismiss} onPreview={onPreview} onCommit={onCommit}/>:<ReferencedProperty degree={degree} picking={entry==='source'} onDismiss={onDismiss}><PropertyEditor numericPresentation="inline" property={degree.properties[0]} label={degree.label} value={value} configuration={configure===true?'step':undefined} choices={parameter.options?.map(option=>option.id)} onPreview={onPreview} onCommit={onCommit}/></ReferencedProperty>}</OperationDegreeScope>;
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
