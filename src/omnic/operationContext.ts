import type {Recipe,RecipeResolver} from './model.ts';
import {evaluateRecipe,type Evaluation,type StructuralNode} from './evaluate.ts';
import {componentIndex} from './componentTargets.ts';
import {primitiveBounds,authoredNodeOwners} from './contextGeometry.ts';
import {definition,applicableParameters,type Parameter} from './registry.ts';
import {targetDegrees,targetParameter,targetDegreeValue,writeTargetDegree} from './targetDegrees.ts';
import {deriveMatchCandidate,measurementsAgree,type NumericOperationContext,type MatchCandidate,type MeasurementReference} from '../properties/operationContext.ts';
import {RENDER_BUDGET} from '../renderBudget.ts';

type Quantity=NonNullable<Parameter['measurement']>;
export function operationGeometry(recipe:Recipe,evaluation:Evaluation,stateOwner='recipe'){
 const components=componentIndex(recipe),owners=authoredNodeOwners(recipe,evaluation),groups=new Map<string,StructuralNode[]>();
 for(const node of evaluation.nodes){
  if(node.kind==='group')continue;
  let id=owners.get(node.id);
  while(id){let list=groups.get(id);if(!list){list=[];groups.set(id,list);}list.push(node);id=components.get(id)?.parent;}
 }
 const views=new Map<string,{bounds:NonNullable<ReturnType<typeof primitiveBounds>>;measurements:Map<Quantity,MeasurementReference>}>();
 for(const [id,nodes] of groups){
  const own=nodes.filter(n=>n.componentId===id),display=own.length?own:nodes,bounds=primitiveBounds(display);if(!bounds)continue;
  const component=components.get(id)!.component,measurements=new Map<Quantity,MeasurementReference>();
  for(const input of applicableParameters(definition(component.generator,true)!,component.params)){
   const quantity=input.measurement;if(!quantity)continue;
   const first=display.find(n=>quantity==='radius'?n.kind==='dot'||n.kind==='ring':n.kind==='line');
   const value=quantity==='center-x'?bounds.x+bounds.width/2:quantity==='center-y'?bounds.y+bounds.height/2:quantity==='radius'?first?.radius:first?.x2===undefined||first.y2===undefined?undefined:Math.hypot(first.x2-first.x,first.y2-first.y);
   if(value!==undefined&&Number.isFinite(value))measurements.set(quantity,{id:`${id}/${quantity}`,owner:id,quantity,unit:'scene-length',value});
  }
  views.set(id,{bounds,measurements});
 }
 return {recipe,evaluation,components,views,stateOwner};
}
export type OperationGeometry=ReturnType<typeof operationGeometry>;
export function referenceForOperation(snapshot:OperationGeometry,target:string,quantity:Quantity,retained?:string){
 if(retained)return retained;
 const own=snapshot.views.get(target);if(!own)return;
 const a=own.bounds;let found:string|undefined,best=Infinity;
 const descendants=new Set<string>();const collect=(id:string)=>{descendants.add(id);snapshot.components.get(id)?.component.children?.forEach(c=>collect(c.id));};collect(target);
 for(const [id,view] of snapshot.views){
  if(descendants.has(id)||!view.measurements.has(quantity))continue;
  const b=view.bounds;
  if(a.x>b.x+b.width||b.x>a.x+a.width||a.y>b.y+b.height||b.y>a.y+a.height)continue;
  const distance=(a.x+a.width/2-b.x-b.width/2)**2+(a.y+a.height/2-b.y-b.height/2)**2;
  if(distance<best){best=distance;found=id;}
 }
 return found;
}
/** Build an immutable context through existing property adapters, never a second
 * DOF inventory. Initially one authored component and declared geometry measures. */
export function targetOperationContext(snapshot:OperationGeometry,ids:readonly string[],property:string,reference:string):NumericOperationContext|undefined{
 if(ids.length!==1||ids[0]===reference)return;
 const degree=targetDegrees(snapshot.recipe,ids).find(d=>d.id===property);if(!degree)return;
 const input=targetParameter(degree),quantity=input.measurement;if(!quantity||input.kind!=='number')return;
 const measurement=snapshot.views.get(ids[0])?.measurements.get(quantity),ref=snapshot.views.get(reference)?.measurements.get(quantity);
 if(!measurement||!ref)return;
 return {stateOwner:snapshot.stateOwner,targets:[{id:ids[0],property}],scope:[...ids],value:Number(targetDegreeValue(snapshot.recipe,degree)),domain:{min:input.min!,max:input.max!,integer:input.integer},measurement,reference:ref,binding:'transient'};
}
/** Two bounded render probes at context creation, never on pointer movement.
 * A candidate must also pass the actual setter, renderer and measurement check. */
export function matchForOperation(snapshot:OperationGeometry,ids:readonly string[],property:string,reference:string,resolve?:RecipeResolver):MatchCandidate|undefined{
 if(snapshot.evaluation.motion||snapshot.evaluation.nodes.length>RENDER_BUDGET.omnicAnimatedRoles)return;
 const context=targetOperationContext(snapshot,ids,property,reference);if(!context)return;
 const degree=targetDegrees(snapshot.recipe,ids).find(d=>d.id===property)!,parameter=targetParameter(degree),value=context.value;
 const delta=value<parameter.max!?Math.min(1,parameter.max!-value):-Math.min(1,value-parameter.min!);
 if(!delta)return;
 const projected=(recipe:Recipe)=>{
  const evaluation=evaluateRecipe(recipe,resolve);
  if(evaluation.motion)return;
  return targetOperationContext(operationGeometry(recipe,evaluation,snapshot.stateOwner),ids,property,reference);
 };
 try{
  const probe=projected(writeTargetDegree(snapshot.recipe,degree,value+delta));if(!probe)return;
  const candidate=deriveMatchCandidate(context,{value:probe.value,measurement:probe.measurement.value,reference:probe.reference.value});if(!candidate)return;
  const verified=projected(writeTargetDegree(snapshot.recipe,degree,candidate.value));
  return verified&&measurementsAgree(verified.measurement.value,verified.reference.value)?candidate:undefined;
 }catch{return;}
}
/** Re-evaluate identities/derivation on commitment rather than replaying a stale
 * scalar after another edit, deletion or history operation. */
export function resolveMatch(recipe:Recipe,candidate:MatchCandidate,resolve?:RecipeResolver,stateOwner=candidate.context.stateOwner){
 if(stateOwner!==candidate.context.stateOwner)throw Error('Reference operation belongs to another state owner.');
 const ids=candidate.context.targets.map(t=>t.id),property=candidate.context.targets[0].property;
 const snapshot=operationGeometry(recipe,evaluateRecipe(recipe,resolve),stateOwner);
 const next=matchForOperation(snapshot,ids,property,candidate.context.reference.owner,resolve);
 if(!next||next.context.measurement.quantity!==candidate.context.measurement.quantity)throw Error('That reference candidate is no longer valid.');
 return next;
}
