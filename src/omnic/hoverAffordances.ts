/** Temporarily parked at the user's request: explicit right-click DOF selection
 * replaces precision hover/edge activation. Keep the adapter for later review. */
export const HOVER_TOOL_DETECTION_ENABLED:boolean=false;
import type {EditableDegree} from '../properties/editableDegrees.ts';
import type {Recipe} from './model.ts';
import type {Evaluation,StructuralNode} from './evaluate.ts';
import {authoredNodeOwners} from './contextGeometry.ts';
import {prepareGeometryEdges,geometryAffordanceHit} from './geometryEdges.ts';
import {targetDegrees,targetParameter} from './targetDegrees.ts';
/** Geometry and registered capabilities are prepared once per displayed snapshot.
 * Merely asking for a hover preview never selects a target or writes its recipe. */
export function prepareHoverAffordances(recipe:Recipe,evaluation:Evaluation){
 const owners=authoredNodeOwners(recipe,evaluation),nodes:StructuralNode[]=[];
 for(const node of evaluation.nodes){const owner=owners.get(node.id);if(!owner)continue;const copy={...node,componentId:owner};nodes.push(copy);}
 const targets=new Map([...new Set(nodes.map(node=>node.componentId))].map(id=>{const degrees=targetDegrees(recipe,[id]);return [id,{ids:[id],rotation:degrees.find(d=>targetParameter(d).selection),move:degrees.some(d=>['center-x','center-y'].includes(targetParameter(d).measurement??''))}] as const;}));
 return {edges:prepareGeometryEdges(nodes),targets};
}
export function previewHoverAffordance(prepared:ReturnType<typeof prepareHoverAffordances>|undefined,point:{x:number;y:number;scenePerPixel?:number},selection?:{ids:readonly string[];rotation:EditableDegree;roles:ReadonlySet<string>}){
 if(!prepared)return;const hit=geometryAffordanceHit(prepared.edges,point,point.scenePerPixel);if(!hit)return;
 if(hit.mode==='rotate'&&selection?.roles.has(hit.id))return {hit,target:{ids:selection.ids,rotation:selection.rotation,move:true}};
 const target=prepared.targets.get(hit.owner);if(!target||hit.mode==='rotate'&&!target.rotation||hit.mode==='move'&&!target.move)return;
 return {hit,target};
}
