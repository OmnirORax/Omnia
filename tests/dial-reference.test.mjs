import test from 'node:test';import assert from 'node:assert/strict';
import {createDialReferenceController} from '../src/ui/dialReferenceController.ts';
import {copyDialNotation} from '../src/properties/dialNotation.ts';
import {dialDrawingGeometry,dialDrawingMarks} from '../src/composer/runtime/ui/dialDrawingGeometry.ts';
import {createMathematicalDialSource} from '../src/composer/runtime/ui/mathematicalDialSource.ts';

test('internal slots do not add a ring; outside slots extend the rim on commitment',()=>{
 const first=dialDrawingGeometry(2,[]),internal=dialDrawingGeometry(2,['0:0','0:2']),outer=dialDrawingGeometry(2,['0:0','1:2']);
 assert.equal(first.orders,1);assert.equal(internal.orders,1);assert.equal(first.extent,internal.extent);assert.equal(outer.orders,2);assert.ok(outer.extent>first.extent);
 assert.equal(first.rings.length,2);assert.ok(first.rings[1].radius>first.extent/2);
});
test('compact notation retains exact strokes and geometry, not a value-derived clock',()=>{
 const notation={base:2,clockwise:false,marks:{selected:['0:0','1:2'],modes:{'1:2':'recursion'}}},saved=copyDialNotation(notation);
 notation.marks.selected.push('2:0');notation.marks.modes['1:2']='normal';assert.deepEqual(saved.marks.selected,['0:0','1:2']);assert.equal(saved.marks.modes['1:2'],'recursion');
 const live=dialDrawingGeometry(saved.base,saved.marks.selected),mini=dialDrawingGeometry(saved.base,saved.marks.selected);
 assert.deepEqual(mini,live);assert.equal(mini.orders,2);const marks=dialDrawingMarks(saved,mini);assert.equal(marks.length,2);assert.equal(marks[1].key,'1:2');assert.equal(marks[1].mode,'recursion');assert.ok(marks[1].x<0);
});
test('one host retargets references and restores the old preview before the new selection',()=>{
 const controller=createDialReferenceController(),events=[],a={name:'a'},b={name:'b'};
 const stopA=controller.register('a',a),stopB=controller.register('b',b);assert.equal(controller.snapshot().host,'a');assert.equal(controller.snapshot().selection.source,b);
 controller.select('a','min');controller.attachCancel('a','min',()=>events.push('restore min'));
 controller.subscribe(()=>events.push(controller.snapshot().selection?.field));controller.select('a','max');assert.deepEqual(events,['restore min','max']);assert.equal(controller.snapshot().host,'a');
 const generation=controller.snapshot().selection.generation;controller.select('a','max','snap');assert.equal(controller.snapshot().selection.generation,generation);assert.equal(controller.snapshot().selection.target,'snap');
 stopA();assert.equal(controller.snapshot().host,'b');assert.equal(controller.snapshot().selection.source,b);stopB();assert.deepEqual(controller.snapshot(),{});
});
test('source fields preserve one accepted number and its exact notation across preview/restore',()=>{
 let value=1;const writes=[],previews=[],configuration={mode:'value',anchor:4,count:0,value:4,notation:{base:2,clockwise:true,marks:{selected:['0:1'],modes:{}}}},props={value,min:0,max:10,label:'Step',onPreview:n=>previews.push(n),onCommit:n=>{value=n;writes.push(n);},limits:{label:'Step',min:0,max:10,hardMin:0,hardMax:10,change:(kind,n)=>{props.limits[kind]=n;}}};
 const source=createMathematicalDialSource('source',()=>props);source.preview('value',4);assert.equal(source.field('value').value,1);source.restore('value');assert.equal(previews.at(-1),1);assert.deepEqual(writes,[]);
 source.commit('value',4,configuration);assert.equal(source.configuration('value').notation.marks.selected[0],'0:1');assert.deepEqual(writes,[4]);props.value=4;assert.equal(source.receive(),false);
 source.commit('min',2,{...configuration,value:2});assert.equal(source.field('min').value,2);assert.equal(source.commit('max',1),false);assert.deepEqual(writes,[4]);
 props.max=8;assert.equal(source.receive(),true);assert.equal(source.configuration('min').value,2);assert.equal(source.configuration('value').value,4);
 props.value=6;assert.equal(source.receive(),true);assert.equal(source.configuration('value'),undefined);assert.equal(source.field('value').value,6);
});
