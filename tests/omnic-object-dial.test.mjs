import test from 'node:test';
import assert from 'node:assert/strict';
import {targetEditorDegrees,targetDegreeValue,writeTargetDegree} from '../src/omnic/targetDegrees.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
import {legalAtoms} from '../src/omnic/atomnic.ts';
import {objectDialSlots,objectDegreeLabel} from '../src/composer/runtime/omnic/objectDial.ts';
import {radialTree} from '../src/composer/runtime/ui/radialMenuModel.ts';
const recipe=generator=>({version:2,revision:0,components:[{id:'item',generator,params:generator==='ring'?{radius:10}:generator==='dot'?{size:10}:{length:20}}],operations:[],frames:[]});
for(const generator of ['dot','ring','line'])test(`${generator} count edits real generated units without changing legacy single-unit identity`,()=>{
 const source=recipe(generator),old=evaluateRecipe(source).nodes.filter(n=>n.kind!=='group');assert.equal(old.length,1);assert.equal(old[0].id,'item:shape');
 const degree=targetEditorDegrees(source,['item']).find(d=>d.properties.includes('omnic.count'));assert.ok(degree);assert.equal(targetDegreeValue(source,degree),1);const changed=writeTargetDegree(source,degree,3),units=evaluateRecipe(changed).nodes.filter(n=>n.kind!=='group');assert.equal(units.length,3);assert.equal(units[0].id,'item:shape');assert.equal(targetDegreeValue(changed,degree),3);assert.equal(source.components[0].params.count,undefined);
 if(generator!=='line')assert.deepEqual(units.map(n=>n.x),[-20,0,20]);else assert.deepEqual(units.map(n=>[n.x,n.x2]),[[-30,-10],[-10,10],[10,30]]);
});
test('object dial exposes count, fill, radius, thickness on right and position, rotation on left without eye category',()=>{
 const degrees=targetEditorDegrees(recipe('ring'),['item']),slots=objectDialSlots(degrees),find=p=>degrees.find(d=>d.id===p||d.properties.includes(p));
 for(const [property,x] of [['omnic.count',36],['omnic.fill',72],['omnic.radius',108],['omnic.thickness',144],['omnic.position',-36],['omnic.angle',-72]])assert.equal(slots[find(property).id].x,x,property);
 assert.equal(objectDegreeLabel(find('omnic.thickness')),'Line thickness');const tree=radialTree(degrees.map(d=>({id:d.id,label:d.label,symbol:d.symbol??'',group:d.group?.map(g=>({...g,flatten:true})),content:d.id})));assert.ok(!tree.some(item=>item.id==='visual'||item.id==='units'));assert.ok(tree.some(item=>item.id===find('omnic.count').id));assert.ok(tree.some(item=>item.id==='color'));
});
test('constrained repetition remains on lattice and rejects collisions with other units',()=>{
 const source=recipe('dot');source.atomnic={active:true,mode:'constrained',size:10};source.components[0].params.count=2;assert.equal(legalAtoms(source),true);assert.deepEqual(evaluateRecipe(source).nodes.filter(n=>n.kind==='dot').map(n=>Math.round(n.y)),[0,-20]);
 source.components.push({id:'occupied',generator:'dot',params:{x:0,y:-20,size:10}});assert.equal(legalAtoms(source),false);source.components[1].params.y=-40;assert.equal(legalAtoms(source),true);
});
