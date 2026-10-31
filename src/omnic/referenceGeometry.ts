import type {OperationGeometry} from './operationContext.ts';
import type {EditableDegree} from '../properties/editableDegrees.ts';
import type {ResizeRect} from '../ui/resizeGeometry.ts';
import {targetDegreeValue,targetParameter} from './targetDegrees.ts';
import {selectionReference} from './selectionReference.ts';
/** Reference axes come from canonical evaluated geometry, never DOM pixels.
 * These are boundary landmarks, not an assertion of glyph containment. */
export type GeometryReference=import('../properties/stateField.ts').FieldReference;
export function fieldReferenceFor(snapshot:OperationGeometry,degree:EditableDegree,reference:string|undefined,environment?:ResizeRect):GeometryReference|undefined{
 if(snapshot.recipe.operations.some(op=>op.enabled&&(op.operator==='rotate'||op.operator==='oscillate')))return;
 const ids=[...new Set(degree.targets.map(t=>t.id))];if(ids.length!==1)return;
 reference??=ids[0];
 const self=reference===ids[0];
 const target=ids[0],parameter=targetParameter(degree),quantity=parameter.measurement;
 const axis=quantity==='center-x'?'x':quantity==='center-y'?'y':undefined;
 const own=snapshot.views.get(target),bounds=reference==='@environment'?environment:snapshot.views.get(reference)?.bounds;
 if(axis&&bounds&&own){
  const extent=axis==='x'?'width':'height',offset=Number(targetDegreeValue(snapshot.recipe,degree))-(own.bounds[axis]+own.bounds[extent]/2);
  return {id:reference,label:self?'Self':reference==='@environment'?'Environment':reference.slice(0,6),value:bounds[axis]+bounds[extent]/2+offset,min:bounds[axis]+offset,max:bounds[axis]+bounds[extent]+offset,thresholds:[{id:`${reference}/${axis}:start`,value:bounds[axis]+offset},{id:`${reference}/${axis}:centre`,value:bounds[axis]+bounds[extent]/2+offset},{id:`${reference}/${axis}:end`,value:bounds[axis]+bounds[extent]+offset}]};
 }
 if(self)return {id:reference,label:'Self',value:parameter.selection?.north??Number(targetDegreeValue(snapshot.recipe,degree))};
 const other=reference==='@environment'?undefined:selectionReference(snapshot.recipe,degree,reference);
 return other&&parameter.selection?{...other,thresholds:Array.from({length:4},(_,i)=>({id:`${reference}/axis:${i}`,value:other.value+i*parameter.selection!.period/4}))}:other;
}
