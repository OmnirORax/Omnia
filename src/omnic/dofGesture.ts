import {nearestFieldCandidate,type StateField} from '../properties/stateField.ts';
export type PositionField={axis:'x'|'y';start:number;field:StateField};
/** Direct gesture projection consumes the same prepared field as the slider. */
export function positionFieldDelta(fields:readonly PositionField[]|undefined,fallback:{x:number;y:number},raw:{x:number;y:number}){
 if(!fields?.length)return fallback;
 const delta={...fallback};
 for(const {axis,start,field} of fields){
  const t=field.max===field.min?0:(start+raw[axis]-field.min)/(field.max-field.min)*1.6-.8;
  const candidate=nearestFieldCandidate(field,axis==='x'?{x:t,y:0}:{x:0,y:t});
  if(!candidate)throw Error('No valid position in the configured field.');
  delta[axis]=candidate.value-start;
 }
 return delta;
}
