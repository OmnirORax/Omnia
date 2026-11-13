import {mathematicalEditValue,mathematicalValueAllowed,type MathematicalDomain} from './mathematicalDial.ts';

export type MeasurementReference=Readonly<{id:string;owner:string;quantity:string;unit:string;value:number}>;
export type NumericOperationContext=Readonly<{
 stateOwner:string;targets:readonly {id:string;property:string}[];scope:readonly string[];
 value:number;domain:MathematicalDomain;measurement:MeasurementReference;reference:MeasurementReference;
 binding:'transient';
}>;
export type MatchCandidate={context:NumericOperationContext;rule:{kind:'match'};value:number};
/** A renderer/state adapter supplies one bounded probe in its actual measurement
 * space. Reference and target may both respond (e.g. a containing group). */
export function deriveMatchCandidate(context:NumericOperationContext,probe:{value:number;measurement:number;reference:number}):MatchCandidate|undefined{
 if(context.measurement.quantity!==context.reference.quantity||context.measurement.unit!==context.reference.unit)return;
 const delta=probe.value-context.value;
 if(!Number.isFinite(delta)||!delta)return;
 const response=((probe.measurement-probe.reference)-(context.measurement.value-context.reference.value))/delta;
 if(!Number.isFinite(response)||Math.abs(response)<Number.EPSILON)return;
 const value=mathematicalEditValue({anchor:context.value,index:0,rule:{kind:'match',reference:context.reference.value,measurement:context.measurement.value,response}});
 if(!mathematicalValueAllowed(value,context.domain))return;
 return {context,rule:{kind:'match'},value};
}
/** Floating-point verification, not a screen-space snapping threshold. */
export function measurementsAgree(a:number,b:number){return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Number.EPSILON*1024*Math.max(1,Math.abs(a),Math.abs(b));}
