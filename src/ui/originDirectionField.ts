import {createStateField,radialFieldPoint,type StateField} from '../properties/stateField.ts';
import {directionCount,directionSlots,type OriginDirections} from '../core/originDirections.ts';
import {AXIS_COLORS} from '../world/axisReadout.ts';
export type OriginDirectionTarget={axis:number}|{key:string};
/** Adapt origin choices to the composer's existing direction field and picking. */
export function originDirectionField(settings:OriginDirections,active:readonly number[]){
 const domain={min:0,max:360,resolution:1,cyclic:{period:360,north:0},projection:'radial' as const};
 const make=(count:number)=>createStateField(domain,{mode:'symmetry',count,step:360/count,reference:0});
 const base=make(6);base.candidates=base.candidates.map(candidate=>({...candidate,id:`axis:${candidate.index}`}));const targets=new Map<number,OriginDirectionTarget>();
 for(const candidate of base.candidates)targets.set(candidate.value,{axis:candidate.index%3});
 const count=directionCount(settings),extra=settings.mode==='axis'&&active.length>1&&settings.halves?directionSlots(settings).flatMap((slot,index)=>index%(count/4)===0?[]:[{...base.candidates[0],id:`direction:${slot.key}`,index,value:index/count*360,point:radialFieldPoint(index/count),derivation:{...base.candidates[0].derivation,index,count,step:360/count}}]):[];
 for(const candidate of extra)targets.set(candidate.value,{key:`0:${candidate.index}`});
 const field:StateField={...base,candidates:[...base.candidates,...extra].sort((a,b)=>a.value-b.value)};
 const state=(value:number)=>{const target=targets.get(value);return target&&'axis'in target?{selected:active.includes(target.axis),color:AXIS_COLORS[target.axis]}:{selected:!!target&&!settings.disabled.includes((target as {key:string}).key)};};
 return {field,targets,state};
}
