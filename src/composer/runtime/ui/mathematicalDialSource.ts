import type {MathematicalDialProps} from './MathematicalDialSurface.tsx';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import type {DialField} from '../../../ui/dialReferenceController.ts';
import {mathematicalLimitsRejection,mathematicalValueSession,type MathematicalDomain} from '../../../properties/mathematicalDial.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
type FieldRecord={configuration?:ConfirmedMathValue;snap?:number;snapConfiguration?:ConfirmedMathValue};
export function createMathematicalDialSource(id:string,read:()=>MathematicalDialProps){
 const session=mathematicalValueSession(read().value),records=new Map<DialField,FieldRecord>();let domain=`${read().min}:${read().max}:${!!read().integer}`;
 const record=(kind:DialField)=>{let found=records.get(kind);if(!found){found={snap:kind==='value'?read().grid?.snap:undefined};records.set(kind,found);}return found;};
 const source={id,read,record,
  receive(){const props=read(),next=`${props.min}:${props.max}:${!!props.integer}`,changed=session.receive(props.value)||next!==domain;domain=next;return changed;},
  field(kind:DialField){const p=read(),limits=p.limits;
   if(kind==='min'||kind==='max')return {value:limits?.[kind]??session.committed,domain:{min:limits?.hardMin??p.min,max:limits?.hardMax??p.max,integer:limits?.integer},label:`${limits?.label??p.label??'Value'} ${kind}`};
   if(kind==='amount'&&p.editing)return {value:p.editing.amount,domain:{min:p.editing.minimum,max:p.editing.maximum,integer:p.integer},label:`${p.label??'Value'} increment`};
   return {value:session.committed,domain:{min:p.min,max:p.max,integer:p.integer} as MathematicalDomain,label:p.label??'Value'};
  },
  preview(kind:DialField,n:number){if(kind==='value'||kind==='direct')read().onPreview?.(session.preview(n));},
  restore(kind:DialField){if(kind!=='value'&&kind!=='direct')return;const p=read(),n=session.restore();if(p.onCancelPreview)p.onCancelPreview();else p.onPreview?.(n);},
  commit(kind:DialField,n:number,configuration?:ConfirmedMathValue){const p=read();
   if(kind==='min'||kind==='max'){if(!p.limits)return false;const reason=mathematicalLimitsRejection(kind==='min'?n:p.limits.min,kind==='max'?n:p.limits.max,{min:p.limits.hardMin,max:p.limits.hardMax,integer:p.limits.integer});if(reason){(p.onReject??reportSystemMessage)(reason);return false;}if(p.limits.change(kind,n)===false)return false;}
   else if(kind==='amount'){p.editing?.onAmountChange(n);}
   else{if(configuration)p.onConfigurationCommit?.(configuration);session.commit(n);p.onCommit(n);}
   record(kind==='direct'?'value':kind).configuration=configuration;return true;
  },
  configuration(kind:DialField){const r=record(kind),f=source.field(kind);return r.configuration?.value===f.value?r.configuration:undefined;},
  setSnap(kind:DialField,n:number,configuration?:ConfirmedMathValue){Object.assign(record(kind),{snap:n,snapConfiguration:configuration});},
 };
 return source;
}
export type MathematicalDialSource=ReturnType<typeof createMathematicalDialSource>;
