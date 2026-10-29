import type {Recipe} from './model.ts';
import type {EditableDegree} from '../properties/editableDegrees.ts';
import {targetDegrees,targetDegreeValue,targetParameter} from './targetDegrees.ts';
/** First cyclic reference adapter uses actual declared orientation values.
 * Reject transformed/animated scenes until an evaluated orientation adapter exists. */
export function selectionReference(recipe:Recipe,target:EditableDegree,id:string){
 if(target.targets.some(t=>t.id===id)||recipe.operations.some(op=>op.enabled&&(op.operator==='rotate'||op.operator==='oscillate')))return;
 const fresh=targetDegrees(recipe,[...new Set(target.targets.map(t=>t.id))]).find(d=>d.id===target.id);if(!fresh)return;
 const other=targetDegrees(recipe,[id]).find(d=>d.id===target.id);if(!other)return;
 const source=targetParameter(other).selection,destination=targetParameter(fresh).selection;
 if(!source||!destination||source.period!==destination.period)return;
 const value=Number(targetDegreeValue(recipe,other))+destination.north-source.north;
 return Number.isFinite(value)?{id,label:id.slice(0,6),value}:undefined;
}
