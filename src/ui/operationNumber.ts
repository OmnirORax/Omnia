import {mathematicalValueAllowed,mathematicalValueRejection,mathematicalValueSession,type MathematicalDomain,type MathematicalScaleMode} from '../properties/mathematicalDial.ts';
export type ConfirmedMathValue={mode:MathematicalScaleMode;anchor:number;count:number;value:number};
let sequence=0;
export function createOperationNumber(options:MathematicalDomain&{label:string;value:number;apply:(value:number)=>void;reject:(reason:string)=>void}){
 const session=mathematicalValueSession(options.value),listeners=new Set<()=>void>();let version=0,configuration:ConfirmedMathValue={mode:'value',anchor:options.value,count:0,value:options.value};
 const valid=(value:number)=>{if(mathematicalValueAllowed(value,options))return true;options.reject(mathematicalValueRejection(value,options)??'Value is unavailable.');return false;};
 const publish=()=>{version++;listeners.forEach(fn=>fn());};
 return {readoutOwner:`operation-number:${++sequence}`,get label(){return options.label;},get min(){return options.min;},get max(){return options.max;},integer:options.integer,
  get value(){return session.committed;},get current(){return session.expected;},get configuration(){return configuration;},
  preview(value:number){if(!valid(value))return false;options.apply(session.preview(value));return true;},
  commit(value:number,config:ConfirmedMathValue={mode:'value',anchor:value,count:0,value}){if(!valid(value))return false;configuration={...config,value};options.apply(session.commit(value));publish();return true;},
  restore(){options.apply(session.restore());},subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},snapshot:()=>version,
 };
}
export type OperationNumber=ReturnType<typeof createOperationNumber>;
