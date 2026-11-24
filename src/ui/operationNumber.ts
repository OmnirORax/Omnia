import {dialCenterScrub} from '../composer/runtime/ui/dialCenterScrub.ts';
import {dialValueGrid,dialSnapDomain} from '../properties/dialValueGrid.ts';
import type {DialNotation} from '../properties/dialNotation.ts';
import {mathematicalScaleMaximum,mathematicalLimitsRejection,mathematicalValueAllowed,mathematicalValueRejection,mathematicalValueSession,type MathematicalDomain,type MathematicalScaleMode} from '../properties/mathematicalDial.ts';
export type ConfirmedMathValue={mode:MathematicalScaleMode;anchor:number;count:number;value:number;equilibrium?:number;snap?:number;notation?:DialNotation;base?:1|2};
let sequence=0;
export function createOperationNumber(options:MathematicalDomain&{label:string;value:number;initialConfiguration?:ConfirmedMathValue;scaleStart?:number;gridSnap?:number;formatValue?:(value:number)=>string;apply:(value:number,phase:'preview'|'commit'|'restore')=>void;reject:(reason:string)=>void}){
 const session=mathematicalValueSession(options.value),listeners=new Set<()=>void>();let limits:{min:number;max:number}|undefined,snap=options.gridSnap;
 const domain=()=>({min:Math.max(options.min,limits?.min??options.min),max:Math.min(options.max,limits?.max??options.max),integer:options.integer});
 let version=0,configuration:ConfirmedMathValue=options.initialConfiguration??{mode:'value',anchor:options.value,count:0,value:options.value},pendingConfiguration:ConfirmedMathValue|undefined;
 const valid=(value:number)=>{if(mathematicalValueAllowed(value,domain()))return true;options.reject(mathematicalValueRejection(value,domain())??'Value is unavailable.');return false;};
 const publish=()=>{version++;listeners.forEach(fn=>fn());};
 const preview=(value:number,config?:ConfirmedMathValue,report=true)=>{if(report?!valid(value):!mathematicalValueAllowed(value,domain()))return false;pendingConfiguration=config;options.apply(session.preview(value),'preview');return true;};
 return {readoutOwner:`operation-number:${++sequence}`,get label(){return options.label;},get min(){return domain().min;},get max(){return domain().max;},get hardMin(){return options.min;},get hardMax(){return options.max;},integer:options.integer,get scaleStart(){return options.scaleStart;},get grid(){return snap===undefined?undefined:dialValueGrid(domain(),snap);},
  formatValue:(value:number)=>options.formatValue?.(value)??String(value),get value(){return session.committed;},get current(){return session.expected;},get configuration(){return configuration;},get currentConfiguration(){return pendingConfiguration??configuration;},
  scrub(){const config=pendingConfiguration??configuration,base=config.base??config.notation?.base??1,grid=snap===undefined?undefined:dialValueGrid(domain(),snap),scrub=dialCenterScrub({value:session.expected,domain:domain(),grid,mode:config.mode,anchor:config.anchor,count:config.count,base,maximum:config.mode==='value'?undefined:mathematicalScaleMaximum(config.anchor,config.mode,domain())});return {...scrub,configuration(n:number):ConfirmedMathValue{const value=scrub.toValue(n);return {mode:config.mode,base,anchor:config.mode==='value'?value:config.anchor,count:config.mode==='value'?(grid?scrub.numeral(n):0):Math.abs(scrub.numeral(n)),value,...(grid?{equilibrium:grid.equilibrium,snap:grid.snap}:{})};}};},
  preview,
  type(text:string,report=false){const value=text.trim()?Number(text):NaN;return preview(value,{mode:'value',base:1,anchor:value,count:0,value},report);},
  commit(value:number,config:ConfirmedMathValue={mode:'value',anchor:value,count:0,value}){if(!valid(value))return false;configuration={...config,value};pendingConfiguration=undefined;options.apply(session.commit(value),'commit');publish();return true;},
  setLimit(which:'min'|'max',value:number){const next={min:domain().min,max:domain().max,[which]:value},reason=mathematicalLimitsRejection(next.min,next.max,options);if(reason){options.reject(reason);return false;}limits=next;pendingConfiguration=undefined;const n=Math.max(next.min,Math.min(next.max,session.committed));if(n!==session.committed){configuration={mode:'value',anchor:n,count:0,value:n};}options.apply(session.commit(n),'commit');publish();return true;},
  setSnap(value:number){if(!mathematicalValueAllowed(value,dialSnapDomain(domain()))){options.reject(mathematicalValueRejection(value,dialSnapDomain(domain()))??'Snap must be positive and match this value’s numeric type.');return false;}snap=value;publish();return true;},
  resetLimits(){limits=undefined;publish();},
  restore(){pendingConfiguration=undefined;options.apply(session.restore(),'restore');},subscribe(fn:()=>void){listeners.add(fn);return()=>{listeners.delete(fn);};},snapshot:()=>version,
 };
}
export type OperationNumber=ReturnType<typeof createOperationNumber>;

export type OperationChoices={read:()=>string;items:readonly {id:string;symbol:string;label:string}[];change:(id:string)=>void};
