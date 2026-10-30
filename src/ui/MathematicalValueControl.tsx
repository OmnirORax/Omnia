import {useState} from 'react';
import type {MathematicalDial} from './MathematicalDial';
import {DofStateField} from './DofStateField';
import {ContextualMasterController} from './ContextualMasterController';
import {cursorPosition} from './cursorPosition';
import {useNumericEditor} from './NumericEditorScope';

/** All Composer numeric projections inherit state selection. The math dial is
 * reserved for the field's rule parameters; external editors retain RangeControl. */
export function MathematicalValueControl({inline=false,configurationKey,step=1,...props}:Parameters<typeof MathematicalDial>[0]&{inline?:boolean;configurationKey?:string;step?:number}){
 const [point,setPoint]=useState<{x:number;y:number}|null>(null),scope=useNumericEditor();
 const close=()=>{scope.cancelPreview?.();setPoint(null);};
 const field=<DofStateField property={configurationKey??props.label??'value'} label={props.label??'Value'} value={props.value} disabled={props.disabled} configure={props.configure} onDismiss={close}
  domain={{min:props.min,max:props.max,integer:props.integer,resolution:step,projection:'radial'}} onPreview={props.onPreview} onCommit={props.onCommit}/>;
 if(inline)return field;
 return <span className="mathematical-value-control" data-ui-control>
  <button type="button" disabled={props.disabled} title={`${props.label??'Value'} · ${props.value}`} aria-label={`Open ${props.label??'value'} state field`} aria-expanded={!!point} onClick={()=>setPoint(cursorPosition())}>⠒❉ <span>{props.value}</span></button>
  {point&&<ContextualMasterController radial title={props.label??'Value'} position={point} onClose={close} onConfirm={close} onAdvance={close} onDismiss={close}>{field}</ContextualMasterController>}
 </span>;
}
