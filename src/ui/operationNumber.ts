import {mathematicalLimitsRejection,mathematicalValueAllowed,mathematicalValueRejection,mathematicalValueSession,type MathematicalDomain,type MathematicalScaleMode} from '../properties/mathematicalDial.ts';
export type ConfirmedMathValue={mode:MathematicalScaleMode;anchor:number;count:number;value:number};
let sequence=0;
export function createOperationNumber(options:MathematicalDomain&{label:string;value:number;formatValue?:(value:number)=>string;apply:(value:number)=>void;reject:(reason:string)=>void}){
 const session=mathematicalValueSession(options.value),listeners=new Set<()=>void>();let limits:{min:number;max:number}|undefined;
 const domain=()=>({min:Math.max(options.min,limits?.min??options.min),max:Math.min(options.max,limits?.max??options.max),integer:options.integer});
 let version=0,configuration:ConfirmedMathValue={mode:'value',anchor:options.value,count:0,value:options.value};
 const valid=(value:number)=>{if(mathematicalValueAllowed(value,domain()))return true;options.reject(mathematicalValueRejection(value,domain())??'Value is unavailable.');return false;};
 const publish=()=>{version++;listeners.forEach(fn=>fn());};
 return {readoutOwner:`operation-number:${++sequence}`,get label(){return options.label;},get min(){return domain().min;},get max(){return domain().max;},get hardMin(){return options.min;},get hardMax(){return options.max;},integer:options.integer,
  formatValue:(value:number)=>options.formatValue?.(value)??String(value),get value(){return session.committed;},get current(){return session.expected;},get configuration(){return configuration;},
  preview(value:number){if(!valid(value))return false;options.apply(session.preview(value));return true;},
  commit(value:number,config:ConfirmedMathValue={mode:'value',anchor:value,count:0,value}){if(!valid(value))return false;configuration={...config,value};options.apply(session.commit(value));publish();return true;},
  setLimit(which:'min'|'max',value:number){const next={min:domain().min,max:domain().max,[which]:value},reason=mathematicalLimitsRejection(next.min,next.max,options);if(reason){options.reject(reason);return false;}limits=next;const n=Math.max(next.min,Math.min(next.max,session.committed));if(n!==session.committed){configuration={mode:'value',anchor:n,count:0,value:n};}options.apply(session.commit(n));publish();return true;},
  resetLimits(){limits=undefined;publish();},
  restore(){options.apply(session.restore());},subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},snapshot:()=>version,
 };
}
export type OperationNumber=ReturnType<typeof createOperationNumber>;

export type OperationChoices={read:()=>string;items:readonly {id:string;symbol:string;label:string}[];change:(id:string)=>void};
