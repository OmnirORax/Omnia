import type { Recipe } from './model';
import type { EditableDegree } from '../properties/editableDegrees';
import { targetParameter, targetDegreeValue } from './targetDegrees';
import { PropertyEditor } from '../appearance/Controls';
/** The compact strip is the same shared numeric editor, with its secondary
 * controls available through the DOF's existing right-click configuration. */
export function DegreeSetter({recipe,degree,onPreview,onCommit,onOpen}: {recipe:Recipe;degree:EditableDegree;onPreview:(value:string|number|boolean)=>void;onCommit:(value:string|number|boolean)=>void;onOpen:()=>void}) {
  const parameter=targetParameter(degree),value=targetDegreeValue(recipe,degree);
  if(degree.action)return <button type="button" aria-label={`Configure ${degree.label}`} title={`Configure ${degree.label}`} onClick={onOpen}/>;
  if(parameter.kind==='number')return <PropertyEditor property={degree.properties[0]} label={degree.label} value={value} limits={{min:parameter.min!,max:parameter.max!}} onPreview={onPreview} onCommit={onCommit}/>;
  return <button type="button" aria-label={`${degree.label}: ${value}`} title={`${degree.label} · ${value}`} style={parameter.kind==='color'?{background:String(value)}:{opacity:value===false ? .3 : 1}} onClick={()=>{
    if(parameter.kind==='toggle')onCommit(!value);
    else if(parameter.kind==='select'&&parameter.options?.length){const options=parameter.options;onCommit(options[(options.findIndex(option=>option.id===value)+1)%options.length].id);}
    else onOpen();
  }}/>;
}

