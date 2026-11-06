import {targetPlacementDegree,targetParameter,targetDegreeValue} from './targetDegrees.ts';
import {fieldReferenceFor} from './referenceGeometry.ts';
import {targetNodes} from './contextGeometry.ts';
import type {OperationGeometry} from './operationContext.ts';
import type {StateFieldDomain} from '../properties/stateField.ts';
/** Compose the selected contributors' declared coordinate frames and thresholds.
 * Their union does not choose an attachment owner or invent a parent. */
export function regionReference(snapshot:OperationGeometry,source:string|readonly string[]){
 if(snapshot.evaluation.motion)return;
 const ids=typeof source==='string'?[source]:source,nodes=targetNodes(snapshot.evaluation,ids);
 if(!nodes.some(n=>n.kind==='dot'||n.kind==='ring'))return;
 const axes=(['center-x','center-y'] as const).map(measurement=>{
  const frames=ids.flatMap(id=>{
   const placement=targetPlacementDegree(snapshot.recipe,[id]),degree=placement?.axes?.find(a=>targetParameter(a).measurement===measurement);if(!degree)return [];
   const reference=fieldReferenceFor(snapshot,degree,id);if(reference?.min===undefined||reference.max===undefined||reference.max<=reference.min)return [];
   const axis=measurement==='center-x'?'x':'y',extent=axis==='x'?'width':'height',bounds=snapshot.views.get(id)!.bounds,offset=bounds[axis]+bounds[extent]/2-Number(targetDegreeValue(snapshot.recipe,degree));
   return [{min:reference.min+offset,max:reference.max+offset,thresholds:[...(reference.thresholds??[]),...(targetParameter(degree).significantThresholds??[])].map(t=>({...t,value:t.value+offset}))}];
  });
  if(frames.length!==ids.length)return;
  const min=Math.min(...frames.map(f=>f.min)),max=Math.max(...frames.map(f=>f.max)),span=max-min;
  return {min,max,thresholds:frames.flatMap(frame=>frame.thresholds.map(t=>({...t,value:(t.value-min)/span})))};
 });
 if(!axes[0]||!axes[1])return;
 const domain:StateFieldDomain={min:0,max:1,resolution:.001,projection:'axis-x',thresholds:[]};
 return {id:ids.join('|'),ids,axes:[axes[0],axes[1]],domain,nodes};
}
