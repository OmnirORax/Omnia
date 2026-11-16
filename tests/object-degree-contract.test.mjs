import test from 'node:test';
import assert from 'node:assert/strict';
import {targetEditorDegrees,selectedEditorDegrees,writeTargetDegree,targetDegreeValue} from '../src/omnic/targetDegrees.ts';
import {objectDegreeMenu} from '../src/composer/runtime/omnic/objectDegreeMenu.ts';
import {radialLayout} from '../src/composer/runtime/ui/radialMenuModel.ts';
import {createDegreeHover} from '../src/composer/runtime/omnic/degreeHover.ts';
import {createHoverPreview} from '../src/composer/runtime/ui/hoverPreview.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
const recipe=()=>({version:2,revision:0,components:[{id:'shape',generator:'ring',params:{radius:10}}],operations:[],frames:[]});
for(const entry of ['creation','selection'])test(`${entry} uses editable Count and Relocation anchors with existing outward rows`,()=>{
 const source=recipe(),degrees=entry==='creation'?targetEditorDegrees(source,['shape'],[],[],'available'):selectedEditorDegrees(source,['shape']);
 const nodes=objectDegreeMenu(degrees,degree=>({content:degree,setter:degree}));
 assert.deepEqual(nodes.filter(n=>n.row.id==='right').map(n=>n.label),['Count','Fill','Radius','Line thickness']);assert.deepEqual(nodes.filter(n=>n.row.id==='left').map(n=>n.label),['Relocation','Rotation']);
 assert.equal(nodes[0].symbol,'●●');assert.ok(nodes.every(n=>n.content.targets.length));assert.ok(!nodes.some(n=>n.symbol==='👁'));assert.ok(nodes.every(n=>!n.children));assert.deepEqual(new Set(nodes.map(n=>n.id)),new Set(degrees.map(d=>d.id)));assert.ok(nodes.some(n=>n.content.properties.includes('color')));
 const layout=radialLayout(nodes);assert.ok(layout.slots[0].x>50);assert.ok(layout.slots[nodes.findIndex(n=>n.row.id==='left')].x<50);assert.equal(new Set(layout.slots.map(slot=>slot.size)).size,1);for(let i=0;i<layout.slots.length;i++)for(let j=i+1;j<layout.slots.length;j++){const a=layout.slots[i],b=layout.slots[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)*layout.extent/100>=(a.size+b.size)/2);}
 // Deleting the first control cannot remove or reparent the other freedoms.
 const withoutCount=objectDegreeMenu(degrees.filter(d=>!d.properties.includes('omnic.count')),degree=>({content:degree}));
 assert.ok(withoutCount.some(n=>n.label==='Fill'));assert.ok(withoutCount.every(n=>!n.children));
 const smaller=radialLayout(withoutCount);assert.equal(new Set(smaller.slots.map(slot=>slot.size)).size,1);

});
for(const entry of ['creation','selection'])test(`${entry} Count follows free pointer movement, commits once and restores on cancellation/handoff`,()=>{
 const base=recipe(),degrees=entry==='creation'?targetEditorDegrees(base,['shape'],[],[],'available'):selectedEditorDegrees(base,['shape']);
 const nodes=objectDegreeMenu(degrees,degree=>({content:degree})),count=nodes.find(n=>n.label==='Count').content,fill=nodes.find(n=>n.label==='Fill').content;let shown=base,saved=base,writes=0;
 const session=createHoverPreview(),activate=degree=>{const value=createDegreeHover(saved,degree,next=>shown=writeTargetDegree(saved,degree,next),next=>{saved=shown=writeTargetDegree(saved,degree,next);writes++;},()=>shown=saved);assert.ok(value);session.enter({},value,100,100);};
 activate(count);session.move(120,100);assert.ok(Number(targetDegreeValue(shown,count))>1);assert.equal(writes,0);assert.equal(evaluateRecipe(shown).nodes.filter(n=>n.kind==='ring').length,targetDegreeValue(shown,count));session.cancel();assert.deepEqual(shown,base);
 activate(count);session.move(120,100);activate(fill);assert.deepEqual(shown,base);session.cancel();activate(count);session.move(120,100);assert.equal(session.commit(),true);assert.equal(writes,1);assert.equal(session.commit(),false);
});
test('legacy shape defaults remain one unit with the original role identity',()=>{for(const generator of ['dot','ring','line']){const source=recipe();source.components[0].generator=generator;source.components[0].params={};const nodes=evaluateRecipe(source).nodes.filter(n=>n.kind!=='group');assert.equal(nodes.length,1);assert.equal(nodes[0].id,'shape:shape');}});

test('manual Path control remains available without acquiring automatic pointer preview',async()=>{const {createRecipe}=await import('../src/omnic/presets.ts');const source=createRecipe('path-rule'),degrees=selectedEditorDegrees(source,[source.components[0].id]),nodes=objectDegreeMenu(degrees,degree=>({content:degree}));const path=nodes.find(n=>n.content.targets[0].input.editor==='path-rule');assert.ok(path);assert.equal(createDegreeHover(source,path.content,()=>assert.fail('manual Path preview'),()=>{}),undefined);});
test('Count copies in constrained mode respect occupied lattice slots',async()=>{const {legalAtoms}=await import('../src/omnic/atomnic.ts');const source={...recipe(),atomnic:{active:true,mode:'constrained',size:10},components:[{id:'unit',generator:'dot',params:{size:10,count:2}},{id:'occupied',generator:'dot',params:{size:10,x:0,y:-20}}]};assert.equal(legalAtoms(source),false);source.components[1].params.y=-40;assert.equal(legalAtoms(source),true);});
