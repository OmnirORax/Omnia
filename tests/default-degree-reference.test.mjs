import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipe} from '../src/omnic/presets.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
import {operationGeometry} from '../src/omnic/operationContext.ts';
import {selectedEditorDegrees,targetParameter} from '../src/omnic/targetDegrees.ts';
import {degreeReferenceSource,measuredReferenceFor} from '../src/omnic/referenceMeasures.ts';
import {resolveReferenceUse,DEFAULT_REFERENCE_SETTINGS} from '../src/properties/referenceUse.ts';

test('first numeric DOF activation resolves composer references without an entry preparation step',()=>{
 const recipe=createRecipe('boundary'),id=recipe.components[0].id,snapshot=operationGeometry(recipe,evaluateRecipe(recipe));
 const environment={x:-300,y:-200,width:600,height:400};
 const degrees=selectedEditorDegrees(recipe,[id]).filter(d=>(d.axes??[d]).every(a=>targetParameter(a).kind==='number'));
 assert.ok(degrees.some(d=>d.id==='omnic.position'));
 for(const degree of degrees){
  const source=degreeReferenceSource(snapshot,degree,undefined,environment);
  assert.equal(source,'@environment',degree.id);
  for(const axis of degree.axes??[degree]){
   const measured=measuredReferenceFor(snapshot,axis,source,environment);
   assert.equal(measured.label,'Omnic composer');
   assert.ok(resolveReferenceUse(measured,DEFAULT_REFERENCE_SETTINGS,0),axis.id);
  }
  assert.equal(degreeReferenceSource(snapshot,degree,id,environment),id,'explicit Self remains available');
 }
 const position=degrees.find(d=>d.id==='omnic.position');
 const x=measuredReferenceFor(snapshot,position.axes[0],'@environment',environment);
 assert.equal(x.max-x.min,600);
 assert.equal(degreeReferenceSource(snapshot,position,'deleted-component',environment),'@environment');
 assert.equal(degreeReferenceSource(snapshot,position,undefined),undefined,'missing composer geometry does not invent a frame');
});
