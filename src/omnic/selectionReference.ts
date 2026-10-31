import type {Recipe} from './model.ts';
import type {EditableDegree} from '../properties/editableDegrees.ts';
import {targetDegrees,targetDegreeValue,targetParameter} from './targetDegrees.ts';
/** Numeric references use the same property, quantity and declared units.
 * Raw fallback remains conservative for transformed scenes; evaluated geometry
 * adapters can supply supported measurements independently. */
export function selectionReference(recipe:Recipe,target:EditableDegree,id:string){
 if(target.targets.some(t=>t.id===id)||recipe.operations.some(op=>op.enabled&&(op.operator==='rotate'||op.operator==='oscillate')))return;
 const fresh=targetDegrees(recipe,[...new Set(target.targets.map(t=>t.id))]).find(d=>d.id===target.id);if(!fresh)return;
 const destinationInput=targetParameter(fresh);
 const compatible=(input:ReturnType<typeof targetParameter>)=>input.kind==='number'&&input.unit===destinationInput.unit&&input.measurement===destinationInput.measurement;
 const options=targetDegrees(recipe,[id]);
 const other=options.find(d=>d.id===target.id)??(destinationInput.measurement?options.find(d=>compatible(targetParameter(d))):undefined);if(!other)return;
 const sourceInput=targetParameter(other);
 if(!compatible(sourceInput)||destinationInput.kind!=='number')return;
 const source=sourceInput.selection,destination=destinationInput.selection;
 if(!!source!==!!destination||source&&destination&&source.period!==destination.period)return;
 const value=Number(targetDegreeValue(recipe,other))+(destination&&source?destination.north-source.north:0);
 return Number.isFinite(value)?{id,label:id.slice(0,6),value}:undefined;
}
