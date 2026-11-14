import {prepareConnectedInk} from './geometryRelations.ts';
import type {PatternMode} from './selectionGeometry.ts';
import {matchingVisualParts,type VisualPart,type VisualMeasurements,type SelectionConstraint} from './visualSelection.ts';
/** A catalog revision and its geometry indexes are inseparable. Entry during a
 * physical press prepares this same bundle synchronously before any pick runs. */
export function prepareSelectionSnapshot(catalog:VisualPart[],measurements:VisualMeasurements,pattern:PatternMode,scope:SelectionConstraint|null){
 const lensGeometry=new Map(catalog.filter(part=>part.element.closest('[data-selection-lens]')).map(part=>{
  const rects=measurements.rects(part),box=rects.length?{left:Math.min(...rects.map(r=>r.left)),right:Math.max(...rects.map(r=>r.right)),top:Math.min(...rects.map(r=>r.top)),bottom:Math.max(...rects.map(r=>r.bottom))}:measurements.bounds(part.element);
  return [part,{box,shape:measurements.shape(part.element)}] as const;
 }));
 const continuity=pattern==='continuity'?prepareConnectedInk((scope?matchingVisualParts(catalog,{...scope,include:true},measurements):catalog).flatMap(part=>{
  const geometry=measurements.partRelation(part);return geometry?[{key:part.key,scope:part.element.closest('[data-selection-scope]')??('ownerSVGElement' in part.element?part.element.ownerSVGElement:null)??part.element,geometry}]:[];
 })):undefined;
 return {catalog,measurements,lensGeometry,continuity};
}
