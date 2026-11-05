import {targetPlacementDegree,targetParameter,targetDegreeValue} from './targetDegrees.ts';
import {fieldReferenceFor} from './referenceGeometry.ts';
import {targetNodes} from './contextGeometry.ts';
import type {OperationGeometry} from './operationContext.ts';
import type {StateFieldDomain} from '../properties/stateField.ts';
/** Coordinate-region projection comes from the selected reference's declared
 * coordinate adapters. Filled area support belongs to rendered primitive kinds,
 * never generator names or Fill presets. Unsupported references stay unaccepted. */
export function regionReference(snapshot:OperationGeometry,id:string){
 if(snapshot.evaluation.motion)return;
 const nodes=targetNodes(snapshot.evaluation,[id]);
 if(!nodes.some(n=>n.kind==='dot'||n.kind==='ring'))return;
 const placement=targetPlacementDegree(snapshot.recipe,[id]);if(!placement?.axes)return;
 const axes=(['center-x','center-y'] as const).map(measurement=>{
  const degree=placement.axes!.find(a=>targetParameter(a).measurement===measurement);if(!degree)return;
  const reference=fieldReferenceFor(snapshot,degree,id);if(reference?.min===undefined||reference.max===undefined||reference.max<=reference.min)return;
  const axis=measurement==='center-x'?'x':'y',extent=axis==='x'?'width':'height',bounds=snapshot.views.get(id)!.bounds;
  const sceneOffset=bounds[axis]+bounds[extent]/2-Number(targetDegreeValue(snapshot.recipe,degree));
  const min=reference.min+sceneOffset,max=reference.max+sceneOffset,span=max-min;
  return {min,max,thresholds:[...(reference.thresholds??[]),...(targetParameter(degree).significantThresholds??[])].map(t=>({...t,value:(t.value-reference.min!)/span}))};
 });
 if(!axes[0]||!axes[1])return;
 const domain:StateFieldDomain={min:0,max:1,resolution:.001,projection:'axis-x',thresholds:[]};
 return {id,axes:[axes[0],axes[1]],domain,nodes};
}
