import test from 'node:test';
import assert from 'node:assert/strict';
import {degreeParameterBinding,targetEditorDegrees,selectedEditorDegrees,targetDegreeValue,writeTargetDegree} from '../src/omnic/targetDegrees.ts';
import {createRecipe} from '../src/omnic/presets.ts';
import {createDegreeHover} from '../src/composer/runtime/omnic/degreeHover.ts';
import {createHoverPreview} from '../src/composer/runtime/ui/hoverPreview.ts';

const source=()=>({version:2,revision:0,components:[{id:'a',generator:'ring',params:{radius:10,x:3,y:4,color:'#123456',fill:true}}],operations:[],frames:[]});
const entries={creation:recipe=>targetEditorDegrees(recipe,['a'],[],[],'available'),selection:recipe=>selectedEditorDegrees(recipe,['a'])};
for(const [name,degrees] of Object.entries(entries)){
 test(`${name} binding round-trips numeric, categorical and visual values without editing the source`,()=>{
  const recipe=source(),before=structuredClone(recipe);
  for(const [property,value] of [['omnic.count',3],['omnic.fill',false],['color','#ff00aa'],['opacity',.5]]){
   const degree=degrees(recipe).find(d=>d.properties.includes(property)),binding=degreeParameterBinding(degree),key=binding.parameters[0].key;
   const values=binding.read(recipe),updated=writeTargetDegree(recipe,degree,binding.edit({...values,[key]:value}));
   assert.equal(targetDegreeValue(updated,degree),value);assert.deepEqual(recipe,before);
  }
 });
 test(`${name} binding uses parameter keys for vector inputs and property IDs for writes`,()=>{
  const recipe=source(),degree=degrees(recipe).find(d=>d.id==='omnic.position'),binding=degreeParameterBinding(degree);
  assert.deepEqual(binding.read(recipe),{x:3,y:4});
  const edit=binding.edit({x:8,y:-2});assert.deepEqual(edit,{'omnic.coordinate.x':8,'omnic.coordinate.y':-2});
  const result=writeTargetDegree(recipe,degree,edit);assert.equal(result.components[0].params.x,8);assert.equal(result.components[0].params.y,-2);
  assert.equal(recipe.components[0].params.x,3);
 });
 test(`${name} contextual conversion preserves preview cancellation, handoff and one accepted write`,()=>{
  const recipe=source(),count=degrees(recipe).find(d=>d.properties.includes('omnic.count')),binding=degreeParameterBinding(count);
  let shown=recipe,saved=recipe,writes=0;
  const session=createHoverPreview();
  const apply=(value,temporary)=>{
   const params={...binding.read(saved),count:value},next=writeTargetDegree(saved,count,binding.edit(params));
   shown=next;if(!temporary){saved=next;writes++;}
  };
  const gesture=()=>createDegreeHover(saved,count,value=>apply(value,true),value=>apply(value,false),()=>shown=saved);
  session.enter({},gesture(),100,100);session.move(120,100);assert.ok(shown.components[0].params.count>1);assert.equal(writes,0);
  session.cancel();assert.equal(shown,recipe);
  session.enter({},gesture(),100,100);session.move(120,100);session.enter({},gesture(),100,100);assert.equal(shown,recipe);
  session.move(130,100);assert.equal(session.commit(),true);assert.equal(writes,1);assert.equal(session.commit(),false);
 });
}
test('shared vector binding translates a selected group without collapsing its spacing',()=>{
 const recipe=source();recipe.components.push({id:'b',generator:'ring',params:{radius:10,x:13,y:24}});
 const degree=selectedEditorDegrees(recipe,['a','b']).find(d=>d.id==='omnic.position'),binding=degreeParameterBinding(degree);
 const moved=writeTargetDegree(recipe,degree,binding.edit({x:8,y:9}));
 assert.deepEqual(moved.components.map(c=>[c.params.x,c.params.y]),[[8,9],[18,29]]);
});
test('extent aliases keep their declared parameter keys rather than assuming a property-name key',()=>{
 for(const [generator,key] of [['dot','size'],['line','length']]){
  const recipe=source();recipe.components[0].generator=generator;recipe.components[0].params={};
  const degree=selectedEditorDegrees(recipe,['a']).find(d=>d.properties.includes('omnic.extent')),binding=degreeParameterBinding(degree);
  assert.equal(binding.parameters[0].key,key);
  const changed=writeTargetDegree(recipe,degree,binding.edit({...binding.read(recipe),[key]:12}));assert.equal(changed.components[0].params[key],12);
 }
});
test('manual path text round-trips unchanged without enabling automatic hover',()=>{
 const recipe=createRecipe('path-rule'),degree=selectedEditorDegrees(recipe,[recipe.components[0].id]).find(d=>d.properties.includes('omnic.pathRule'));
 const binding=degreeParameterBinding(degree),before=structuredClone(recipe);
 assert.equal(binding.edit(binding.read(recipe)),targetDegreeValue(recipe,degree));assert.deepEqual(recipe,before);
 assert.equal(createDegreeHover(recipe,degree,()=>assert.fail('manual path preview'),()=>{}),undefined);
});
test('shared binding retains the intersection of selected parameter domains and existing validation',()=>{
 const recipe=source();recipe.components=[{id:'a',generator:'dot',params:{size:10}},{id:'b',generator:'line',params:{length:20}}];
 const degree=selectedEditorDegrees(recipe,['a','b']).find(d=>d.properties.includes('omnic.extent')),binding=degreeParameterBinding(degree),before=structuredClone(recipe);
 assert.equal(binding.parameters.length,1);assert.equal(binding.parameters[0].max,100);
 const accepted=writeTargetDegree(recipe,degree,binding.edit({size:12}));
 assert.equal(accepted.components[0].params.size,12);assert.equal(accepted.components[1].params.length,12);
 assert.throws(()=>writeTargetDegree(recipe,degree,binding.edit({size:NaN})));assert.deepEqual(recipe,before);
});
