import {useState} from 'react';
import {MathematicalDial} from './MathematicalDial';
import {ContextualMasterController} from './ContextualMasterController';
import {cursorPosition} from './cursorPosition';
import {useNumericEditor} from './NumericEditorScope';

/** Compact resident projection; the same dial can fill an already requested stage. */
export function MathematicalValueControl({inline=false,...props}:Parameters<typeof MathematicalDial>[0]&{inline?:boolean;disabled?:boolean}){
 const [point,setPoint]=useState<{x:number;y:number}|null>(null);
 const scope=useNumericEditor();
 const close=()=>{scope.cancelPreview?.();setPoint(null);};
 if(inline)return <MathematicalDial {...props} onCancelPreview={scope.cancelPreview}/>;
 return <span className="mathematical-value-control" data-ui-control>
  <button type="button" disabled={props.disabled} title={`${props.label??'Value'} · ${props.value} · ⠒❉`} aria-label={`Open ${props.label??'value'} mathematical dial`} aria-expanded={!!point} onClick={()=>setPoint(cursorPosition())}>⠒❉ <span>{props.value}</span></button>
  {point&&<ContextualMasterController radial title={props.label??'⠒❉'} position={point} onClose={close} onConfirm={close} onAdvance={close} onDismiss={close}>
   <MathematicalDial {...props} onCancelPreview={scope.cancelPreview}/>
  </ContextualMasterController>}
 </span>;
}
