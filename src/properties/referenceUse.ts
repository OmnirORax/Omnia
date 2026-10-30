import {createStateField,fieldLimits,type FieldReference,type StateFieldDomain,type StateFieldConfiguration} from './stateField.ts';
export type ReferenceUse='bounds'|'step'|'match';
export type ReferenceMeasure=Readonly<{id:string;label:string;symbol:string;unit:string;value:number;matchValue?:number;matchOffset?:number;min?:number;max?:number}>;
export type ReferenceSettings=Readonly<{use:ReferenceUse;measure:string;numerator:number;denominator:number}>;
export const DEFAULT_REFERENCE_SETTINGS:ReferenceSettings={use:'bounds',measure:'context',numerator:1,denominator:1};
export type MeasuredReference=FieldReference&{unit:string;measures:readonly ReferenceMeasure[]};
export type UsedReference=FieldReference&{unit:string;use:ReferenceUse;step?:number;match?:number};
/** Source geometry and consumer use are independent. No preset/DOF dispatch. */
export function resolveReferenceUse(source:MeasuredReference,settings:ReferenceSettings,anchor:number):UsedReference|undefined{
 const measure=source.measures.find(m=>m.id===settings.measure),factor=settings.numerator/settings.denominator;
 if(!measure||measure.unit!==source.unit||!Number.isFinite(factor)||settings.denominator<=0)return;
 const base={id:source.id,label:source.label,unit:source.unit,use:settings.use};
 if(settings.use==='step'){
  const step=Math.abs(measure.value*factor);if(!Number.isFinite(step)||step===0)return;
  return {...base,value:anchor,step};
 }
 if(settings.use==='match'){
  const match=(measure.matchValue??measure.value)*factor+(measure.matchOffset??0);if(!Number.isFinite(match))return;
  return {...base,value:anchor,match};
 }
 if(settings.measure==='context'&&factor===1)return {...source,...base};
 const min=measure.min??0,max=min+measure.value*factor;
 return {...base,value:(measure.matchValue??min)+(measure.matchOffset??0), min:Math.min(min,max),max:Math.max(min,max),thresholds:[{id:`${source.id}/${measure.id}:min`,value:Math.min(min,max)},{id:`${source.id}/${measure.id}:max`,value:Math.max(min,max)}]};
}
/** Slider, wheel and direct gestures all execute the same resolved relation. */
export function createReferenceField(domain:StateFieldDomain,config:StateFieldConfiguration,reference:UsedReference|FieldReference|undefined,allowed?:(n:number)=>boolean){
 const used=reference as UsedReference|undefined;
 if(used?.unit&&(domain.unit??domain.quantity)&&used.unit!==(domain.unit??domain.quantity))return {domain,min:domain.min,max:domain.max,candidates:[],projection:domain.projection};
 const exact=used?.match===undefined?undefined:Number(used.match.toPrecision(15));
 const defaults=fieldLimits(domain,reference,config);
 const limits=used?.use==='match'?{min:Math.max(defaults.min,exact??Infinity),max:Math.min(defaults.max,exact??-Infinity)}:defaults;
 return createStateField(domain,{...config,...limits,reference:reference?.value??config.reference,referenceId:reference?.id,
  ...(used?.use==='step'?{mode:'step',step:used.step??0}:used?.use==='match'?{mode:'symmetry',reference:exact??config.reference}:{}),thresholds:reference?.thresholds},allowed);
}

/** A Step-space choice changes its setting, without invoking a geometry writer. */
export function selectedReferenceStep(settings:ReferenceSettings,currentStep:number,value:number):Partial<ReferenceSettings>|undefined{
 if(settings.use!=='step'||!Number.isFinite(currentStep)||currentStep<=0||!Number.isFinite(value)||value<=0)return;
 const factor=settings.numerator/settings.denominator*value/currentStep;
 // Keep ordinary fractional choices editable by the existing integer math dial.
 for(let denominator=1;denominator<=512;denominator++){const numerator=Math.round(factor*denominator);if(numerator>0&&numerator<=512&&Math.abs(numerator/denominator-factor)<=Math.max(1,Math.abs(factor))*1e-12)return {numerator,denominator};}
 return {numerator:settings.numerator*value/currentStep};
}
