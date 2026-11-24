import {showMathCursorReadout} from '../../../ui/mathCursorReadout.ts';
import {createDialValueDraft,dialGridCount} from '../../../properties/dialValueGrid.ts';
import type {MathematicalDialProps} from './MathematicalDialSurface.tsx';
import type {ConfirmedMathValue} from '../../../ui/operationNumber.ts';
import type {DialField} from '../../../ui/dialReferenceController.ts';
import {mathematicalLimitsRejection,mathematicalValueSession,type MathematicalDomain} from '../../../properties/mathematicalDial.ts';
import {reportSystemMessage} from '../../../ui/systemMessage.ts';
type FieldRecord={configuration?:ConfirmedMathValue;snap?:number;snapConfiguration?:ConfirmedMathValue};
export function createMathematicalDialSource(id:string,read:()=>MathematicalDialProps){
 const session=mathematicalValueSession(read().value),records=new Map<DialField,FieldRecord>();let domain=`${read().min}:${read().max}:${!!read().integer}`;
 const record=(kind:DialField)=>{if(kind==='direct')kind='value';let found=records.get(kind);if(!found){found={snap:kind==='value'?read().grid?.snap:undefined};records.set(kind,found);}return found;};
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
   record(kind).configuration=configuration;if(configuration)showMathCursorReadout(p.readoutOwner??id,source.field(kind).label,configuration);return true;
  },
  configuration(kind:DialField){const r=record(kind),f=source.field(kind);return r.configuration?.value===f.value?r.configuration:undefined;},
  setSnap(kind:DialField,n:number,configuration?:ConfirmedMathValue){Object.assign(record(kind),{snap:n,snapConfiguration:configuration});if(kind==='value'||kind==='direct')read().onSnapChange?.(n,configuration);},
 };
 return source;
}
export type MathematicalDialSource=ReturnType<typeof createMathematicalDialSource>;

/** Direct and reference editors share scratch values, snap and confirmation. */
export function createDialEditorDraft(source:MathematicalDialSource,field:DialField='direct'){
 const initial=source.field(field),record=source.record(field);
 let configuration=source.configuration(field)??(field==='direct'?source.read().initialConfiguration:undefined),snapConfiguration=record.snapConfiguration,gridded=field!=='direct'||record.snap!==undefined;
 const draft=createDialValueDraft({domain:initial.domain,value:initial.value,snap:record.snap,represented:field==='direct'||!!configuration,preview:n=>source.preview(field,n),restore:()=>source.restore(field),commit:n=>source.commit(field,n,configuration)});
 return {...draft,get finished(){return draft.finished;},get grid(){return draft.grid;},get valueGrid(){return gridded?draft.grid:undefined;},get candidate(){return draft.candidate;},
  get configuration(){if(!configuration&&gridded)configuration={mode:'value',anchor:draft.candidate,count:dialGridCount(draft.grid,draft.candidate),value:draft.candidate,equilibrium:draft.grid.equilibrium,snap:draft.grid.snap};return configuration;},
  get snapConfiguration(){return snapConfiguration?.value===draft.grid.snap?snapConfiguration:undefined;},
  configure(next:ConfirmedMathValue){configuration=next;},
  configureSnap(next:ConfirmedMathValue){snapConfiguration=next;},
  setSnap(n:number,config:ConfirmedMathValue|undefined=snapConfiguration){if(!draft.setSnap(n))return false;gridded=true;configuration=undefined;snapConfiguration=config;return true;},
  saveSnap(){if(gridded)source.setSnap(field,draft.grid.snap,snapConfiguration);},
 };
}
