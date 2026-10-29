import {useState} from 'react';
import {MathematicalDial} from './MathematicalDial';
import {ContextualMasterController} from './ContextualMasterController';
import {cursorPosition} from './cursorPosition';
import {useNumericEditor,useNumericOperation} from './NumericEditorScope';
import {useWorkingEditingRule} from './RangeControl';

/** Compact resident projection; the same dial can fill an already requested stage. */
export function MathematicalValueControl({inline=false,configurationKey,step=1,...props}:Parameters<typeof MathematicalDial>[0]&{inline?:boolean;configurationKey?:string;step?:number}){
 const [point,setPoint]=useState<{x:number;y:number}|null>(null);
 const scope=useNumericEditor(),reference=useNumericOperation();
 const editing=useWorkingEditingRule(configurationKey,step,props.min,props.max);
 const close=()=>{scope.cancelPreview?.();setPoint(null);};
 if(inline)return <MathematicalDial {...props} editing={editing} reference={reference} onCancelPreview={scope.cancelPreview}/>;
 return <span className="mathematical-value-control" data-ui-control>
  <button type="button" disabled={props.disabled} title={`${props.label??'Value'} · ${props.value} · ⠒❉`} aria-label={`Open ${props.label??'value'} mathematical dial`} aria-expanded={!!point} onClick={()=>setPoint(cursorPosition())}>⠒❉ <span>{props.value}</span></button>
  {point&&<ContextualMasterController radial title={props.label??'⠒❉'} position={point} onClose={close} onConfirm={close} onAdvance={close} onDismiss={close}>
   <MathematicalDial {...props} editing={editing} reference={reference} onCancelPreview={scope.cancelPreview}/>
  </ContextualMasterController>}
 </span>;
}
