import test from 'node:test';
import assert from 'node:assert/strict';
import {createDegreeHover,degreeHoverAllowed} from '../src/composer/runtime/omnic/degreeHover.ts';
import {createHoverPreview} from '../src/composer/runtime/ui/hoverPreview.ts';
import {selectedEditorDegrees,writeTargetDegree} from '../src/omnic/targetDegrees.ts';
import {createRecipe} from '../src/omnic/presets.ts';
function fixture(){const base=createRecipe('boundary'),id=base.components[0].id,session=createHoverPreview();let saved=base,shown=base,saves=0;
 const degrees=selectedEditorDegrees(base,[id]);
 return {base,id,session,get shown(){return shown;},get saves(){return saves;},enter(property){const degree=degrees.find(d=>d.id===property||d.properties.includes(property));assert.ok(degree,property);const gesture=createDegreeHover(saved,degree,value=>{shown=writeTargetDegree(saved,degree,value);},value=>{saved=shown=writeTargetDegree(saved,degree,value);saves++;},()=>{shown=saved;});assert.ok(gesture,property);const owner={};session.enter(owner,gesture,100,100);return owner;}};
}
test('Position previews on hover, yields to every scalar DOF, and clicks accept instead of toggling a mode',()=>{
 const position=fixture();position.enter('omnic.position');position.session.move(120,80);assert.ok(position.shown.components[0].params.x>0&&position.shown.components[0].params.y>0);position.session.commit();assert.equal(position.saves,1);assert.equal(position.session.active(),false);position.enter('opacity');assert.equal(position.session.active(),true);
 for(const property of ['omnic.radius','omnic.thickness','color','opacity','omnic.fill']){
  const f=fixture();f.enter('omnic.position');f.session.move(120,80);assert.notDeepEqual(f.shown,f.base);assert.equal(f.saves,0);
  const owner=f.enter(property);assert.equal(f.session.owns(owner),true);assert.deepEqual(f.shown,f.base);
  f.session.move(property==='opacity'?20:250,100);assert.notDeepEqual(f.shown,f.base,property);assert.equal(f.saves,0);
  assert.equal(f.session.commit(),true);assert.equal(f.session.active(),false);assert.equal(f.saves,1);assert.equal(f.session.commit(),false);
 }
});
test('a scalar preview restores before Position takes over; Escape restores position without saving',()=>{
 const f=fixture();f.enter('omnic.radius');f.session.move(140,100);assert.notDeepEqual(f.shown,f.base);
 f.enter('omnic.position');assert.deepEqual(f.shown,f.base);f.session.move(115,90);assert.notDeepEqual(f.shown,f.base);
 f.session.cancel();assert.deepEqual(f.shown,f.base);assert.equal(f.saves,0);
});
test('old scene placement is cancelled before a new construction/DOF starts its preview',()=>{
 const session=createHoverPreview(),order=[];let visual='base';
 session.enter({}, {start:()=>{visual='position';},move:()=>{},commit:()=>{},cancel:()=>{order.push('position cancelled');visual='base';}},0,0);
 session.enter({}, {start:()=>{order.push('new preview started');visual='new preview';},move:()=>{},commit:()=>{},cancel:()=>{}},0,0);
 assert.deepEqual(order,['position cancelled','new preview started']);assert.equal(visual,'new preview');
});
test('Path remains manual, including its Position and scalar DOFs',()=>{
 const recipe=createRecipe('path-rule'),id=recipe.components[0].id;
 for(const degree of selectedEditorDegrees(recipe,[id])){assert.equal(degreeHoverAllowed(recipe,degree),false);assert.equal(createDegreeHover(recipe,degree,()=>assert.fail('Path must not preview'),()=>assert.fail('Path must not commit')),undefined);}
});
test('ownership observers settle the old preview before the incoming preview publishes',()=>{
 const session=createHoverPreview();let visual='old';
 session.subscribe(()=>{if(session.active())visual='restored';});
 session.enter({}, {start:()=>{visual='incoming';},move:()=>{},commit:()=>{},cancel:()=>{}},0,0);
 assert.equal(visual,'incoming');
});
test('scene placement retains its scene click handler; DOF hover owns click-to-accept',()=>{
 const session=createHoverPreview();let changes=0;
 session.enter({}, {capturePress:false,start:()=>{},move:()=>{},commit:()=>changes++,cancel:()=>{}},0,0);
 assert.equal(session.capturesPress(),false);
 session.enter({}, {start:()=>{},move:()=>{},commit:()=>changes++,cancel:()=>{}},0,0);
 assert.equal(session.capturesPress(),true);session.commit();assert.equal(changes,1);
});
test('a numeric action adapter such as Rotation retains hover preview',()=>{
 const recipe={version:2,revision:0,components:[{id:'dot',generator:'dot',params:{size:10,angle:0}}],operations:[],frames:[]};
 const degree={...selectedEditorDegrees(recipe,['dot']).find(d=>d.id==='omnic.angle'),action:'atomnic.rotate',id:'atomnic.rotate'};
 let shown=recipe;const gesture=createDegreeHover(recipe,degree,value=>{shown=writeTargetDegree(recipe,degree,value);},()=>{});
 assert.ok(gesture);gesture.start(100,100);gesture.move(110,100);assert.notEqual(shown.components[0].params.angle,0);
});
test('accepting a DOF hover opens its full editor once, including Position and Fill coordinates',()=>{
 for(const property of ['omnic.position','omnic.fill','omnic.radius']){
  const recipe=createRecipe('boundary'),degree=selectedEditorDegrees(recipe,[recipe.components[0].id]).find(d=>d.id===property),session=createHoverPreview();let writes=0,opened=0;
  const gesture=createDegreeHover(recipe,degree,()=>{},()=>writes++,()=>{},()=>opened++);
  session.enter({},gesture,100,100);session.move(110,90);assert.equal(opened,0);assert.equal(writes,0);
  session.commit();session.commit();assert.equal(writes,1);assert.equal(opened,1);assert.equal(session.active(),false);
 }
});
