import {selectionTurns,maximumSelectionStates,type CyclicSelection,type StateSelectionMode} from './stateSelection.ts';

export type StateFieldProjection='radial'|'axis-x'|'axis-y';
export type StateFieldDomain={min:number;max:number;integer?:boolean;resolution:number;unit?:string;quantity?:string;cyclic?:CyclicSelection;projection:StateFieldProjection};
export type StateFieldCandidate={id:string;index:number;value:number;point:{x:number;y:number};derivation:{mode:StateSelectionMode|'reference';reference:number;referenceId?:string;index:number;count:number;step:number;min:number;max:number}};
export type StateField={domain:StateFieldDomain;min:number;max:number;candidates:readonly StateFieldCandidate[];projection:StateFieldProjection};
export type StateFieldConfiguration={mode:StateSelectionMode;count:number;step:number;reference:number;referenceId?:string;min?:number;max?:number};
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
  return {id:`${config.mode}:${index}`,index,value,point,derivation:{mode:!domain.cyclic&&config.mode==='symmetry'&&index===referenceIndex?'reference' as const:config.mode,reference:config.reference,referenceId:config.referenceId,index,count:config.count,step:config.step,min,max}};
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
