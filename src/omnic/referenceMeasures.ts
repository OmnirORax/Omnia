import type {EditableDegree} from '../properties/editableDegrees.ts';
import type {MeasuredReference,ReferenceMeasure} from '../properties/referenceUse.ts';
import type {OperationGeometry} from './operationContext.ts';
import type {ResizeRect} from '../ui/resizeGeometry.ts';
import {targetDegrees,targetParameter,targetDegreeValue} from './targetDegrees.ts';
import {stateFieldDomain} from './stateFieldAdapter.ts';
import {fieldReferenceFor} from './referenceGeometry.ts';
/** One evaluated source inventory, independent of the receiving preset. */
export function measuredReferenceFor(snapshot:OperationGeometry,degree:EditableDegree,id:string|undefined,environment?:ResizeRect):MeasuredReference|undefined{
 const ids=[...new Set(degree.targets.map(t=>t.id))];if(ids.length!==1||snapshot.evaluation.motion||snapshot.recipe.operations.some(op=>op.enabled&&(op.operator==='rotate'||op.operator==='oscillate')))return;
 const target=ids[0],source=id??target,parameter=targetParameter(degree),domain=stateFieldDomain(parameter);if(!domain)return;
 const view=snapshot.views.get(source),bounds=source==='@environment'?environment:view?.bounds;
 if(!bounds)return;
 const context=fieldReferenceFor(snapshot,degree,source,environment),unit=domain.unit??domain.quantity??parameter.property;
 const own=snapshot.views.get(target),axis=parameter.measurement==='center-x'?'x':parameter.measurement==='center-y'?'y':undefined;
 const matchOffset=axis&&own?Number(targetDegreeValue(snapshot.recipe,degree))-(own.bounds[axis]+own.bounds[axis==='x'?'width':'height']/2):0;
 const sourceDegrees=source==='@environment'?[]:targetDegrees(snapshot.recipe,[source]);
 const unambiguous=(quantity:string)=>sourceDegrees.filter(d=>targetParameter(d).measurement===quantity).length===1;
 const measures:ReferenceMeasure[]=[];
 if(context)measures.push({id:'context',label:context.min!==undefined&&context.max!==undefined?'Boundary':'Same DOF',symbol:context.min!==undefined?'□':degree.symbol??'=',unit,value:context.min!==undefined&&context.max!==undefined?context.max-context.min:context.value,matchValue:context.value-matchOffset,min:context.min,max:context.max});
 if(unit==='length'){
  measures.push({id:'width',label:'Width',symbol:'↔',unit,value:bounds.width},{id:'height',label:'Height',symbol:'↕',unit,value:bounds.height});
  for(const quantity of ['radius','length'] as const){const m=view?.measurements.get(quantity);if(m&&unambiguous(quantity))measures.push({id:quantity,label:quantity==='radius'?'Radius':'Length',symbol:quantity==='radius'?'⊖':'↗',unit,value:m.value});}
 }
 for(const other of sourceDegrees){
  const input=targetParameter(other),d=stateFieldDomain(input);if(!d||(d.unit??d.quantity)!==unit||input.measurement==='center-x'||input.measurement==='center-y'||input.measurement&&unambiguous(input.measurement))continue;
  const value=Number(targetDegreeValue(snapshot.recipe,other));if(Number.isFinite(value))measures.push({id:`value:${other.id}`,label:other.label,symbol:other.symbol??'●',unit,value});
 }
 if(!measures.length)return;
 return {...(context??{id:source,label:source===target?'Self':source==='@environment'?'Environment':source.slice(0,6),value:Number(targetDegreeValue(snapshot.recipe,degree))}),unit,measures:measures.map(m=>({...m,matchOffset}))};
}
