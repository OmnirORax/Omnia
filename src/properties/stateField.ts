import {selectionTurns,maximumSelectionStates,type CyclicSelection,type StateSelectionMode} from './stateSelection.ts';

export type StateFieldProjection='radial'|'axis-x'|'axis-y';
export type FieldThreshold=Readonly<{id:string;value:number}>;
export type FieldReference=Readonly<{id:string;label:string;value:number;min?:number;max?:number;thresholds?:readonly FieldThreshold[]}>;
/** Working limits override reference defaults; hard domain constraints always win. */
export function fieldLimits(domain:{min:number;max:number},reference:FieldReference|undefined,limits:{min?:number;max?:number}={}){
 return {min:Math.max(domain.min,limits.min??reference?.min??domain.min),max:Math.min(domain.max,limits.max??reference?.max??domain.max)};
}
export type StateFieldDomain={min:number;max:number;integer?:boolean;resolution:number;unit?:string;quantity?:string;cyclic?:CyclicSelection;projection:StateFieldProjection;thresholds?:readonly FieldThreshold[]};
export type StateFieldCandidate={id:string;index:number;value:number;point:{x:number;y:number};thresholds?:readonly string[];derivation:{mode:StateSelectionMode|'reference';reference:number;referenceId?:string;index:number;count:number;step:number;min:number;max:number}};
export type StateField={domain:StateFieldDomain;min:number;max:number;candidates:readonly StateFieldCandidate[];projection:StateFieldProjection};
export type StateFieldConfiguration={mode:StateSelectionMode;count:number;step:number;reference:number;referenceId?:string;min?:number;max?:number;thresholds?:readonly FieldThreshold[]};
/** One bounded generator/filter/project path. Projections are addresses for raw
 * quantities, directions for cyclic values, and coordinates for spatial axes. */
export function createStateField(domain:StateFieldDomain,config:StateFieldConfiguration,allowed:(value:number)=>boolean=()=>true):StateField{
 const min=Math.max(domain.min,config.min??domain.min),max=Math.min(domain.max,config.max??domain.max);
 const empty={domain,min,max,candidates:[],projection:domain.projection};
 if(![min,max,config.reference,config.step].every(Number.isFinite)||max<min||!Number.isInteger(config.count)||config.count<1||config.count>maximumSelectionStates(config.mode))return empty;
 let values:number[];
 if(domain.cyclic){
  values=selectionTurns(config.mode,config.count,config.step,domain.cyclic.period).map(turn=>config.reference+turn*domain.cyclic!.period);
 }else if(config.mode==='symmetry'){
  values=Array.from({length:config.count+1},(_,i)=>min+(max-min)*i/config.count);
 }else if(config.mode==='halving'){
  values=Array.from({length:config.count},(_,i)=>config.reference/2**i);
 }else{
  if(config.step===0)return empty;
  values=Array.from({length:config.count+1},(_,i)=>config.reference+(i-Math.floor(config.count/2))*config.step);
 }
 const referenceIndex=values.length;
 // A declared reference is itself a meaningful state, even when it lies between
 // regular partitions. It is offered, never silently applied.
 if(!domain.cyclic&&config.mode==='symmetry')values.push(config.reference);
 const thresholds=[...(domain.thresholds??[]),...(config.thresholds??[])];
 values.push(...thresholds.map(t=>t.value));
 const thresholdIds=new Map<number,string[]>();
 for(const t of thresholds){const value=Number(t.value.toPrecision(15));thresholdIds.set(value,[...(thresholdIds.get(value)??[]),t.id]);}
 const seen=new Set<number>(),valid=values.flatMap((raw,index)=>{
  // Decimal arithmetic noise may be normalized; integer constraints never round
  // a fractional candidate into a different, invented state.
  const value=Number(raw.toPrecision(15));
  if(!Number.isFinite(value)||value<min||value>max||domain.integer&&!Number.isInteger(value)||seen.has(value)||!allowed(value))return [];
  seen.add(value);return [{index,value}];
 });
 const candidates=valid.map(({value,index},address)=>{
  const turn=domain.cyclic?(value-domain.cyclic.north)/domain.cyclic.period:address/Math.max(1,valid.length);
  const position=max===min?0:2*(value-min)/(max-min)-1;
  const point=domain.projection==='axis-x'?{x:position*.8,y:0}:domain.projection==='axis-y'?{x:0,y:position*.8}:{x:Math.sin(turn*Math.PI*2)*.8,y:-Math.cos(turn*Math.PI*2)*.8};
  const landmarks=thresholdIds.get(value);
  return {id:landmarks?`threshold:${landmarks.join("|")}`:`${config.mode}:${index}`,index,value,point,...(landmarks?{thresholds:landmarks}:{}),derivation:{mode:!domain.cyclic&&config.mode==='symmetry'&&index===referenceIndex?'reference' as const:config.mode,reference:config.reference,referenceId:config.referenceId,index,count:config.count,step:config.step,min,max}};
 });
 return {domain,min,max,candidates,projection:domain.projection};
}
/** Nearest selection is projection-independent and only visits prepared states. */
export function nearestFieldCandidate(field:StateField,point:{x:number;y:number}){
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))return;
 let found:StateFieldCandidate|undefined,distance=Infinity;
 for(const candidate of field.candidates){const next=(candidate.point.x-point.x)**2+(candidate.point.y-point.y)**2;if(next<distance){distance=next;found=candidate;}}
 return found;
}

/** The wheel centre is a neutral origin, not an implicit first-angle choice. */
export function axisFieldCandidate(field:StateField,point:{x:number;y:number}){
 const radius=Math.hypot(point.x,point.y);
 return field.domain.cyclic&&radius>=.28&&radius<=1.08?nearestFieldCandidate(field,point):undefined;
}

/** A linear field can project any scalar DOF without assuming its scene axis. */
export function linearFieldCandidate(field:StateField,fraction:number){
 if(!Number.isFinite(fraction)||fraction<0||fraction>1)return;
 const value=field.min+fraction*(field.max-field.min);
 return field.candidates.reduce<StateFieldCandidate|undefined>((best,candidate)=>!best||Math.abs(candidate.value-value)<Math.abs(best.value-value)?candidate:best,undefined);
}

/** Address in the configured subdivisions; extra landmarks do not change precision. */
export function axisFraction(field:StateField,value:number){
 const total=field.candidates[0]?.derivation.count??0,period=field.domain.cyclic?.period??360,north=field.domain.cyclic?.north??0;
 return {index:Number.isFinite(value)&&total?Number((1+(((value-north)%period+period)%period)/period*total).toFixed(6)):0,total};
}
