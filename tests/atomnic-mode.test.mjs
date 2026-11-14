import test from 'node:test';
import assert from 'node:assert/strict';
import {translateTargets,selectedEditorDegrees} from '../src/omnic/targetDegrees.ts';
import {legalAtoms} from '../src/omnic/atomnic.ts';
const construction=()=>({version:2,revision:0,atomnic:{active:true,mode:'constrained',size:10},components:[{id:'unit',generator:'dot',params:{x:0,y:0,size:10}}],operations:[],frames:[]});
test('turning Atomnic off releases its lattice constraints and restores ordinary shape freedoms',()=>{
 const source=construction();assert.throws(()=>translateTargets(source,new Set(['unit']),{x:3,y:7}),/touching-lattice/);
 assert.ok(!selectedEditorDegrees(source,['unit']).some(degree=>degree.properties.includes('omnic.extent')));
 const off={...source,atomnic:{...source.atomnic,active:false}},moved=translateTargets(off,new Set(['unit']),{x:3,y:7});
 assert.equal(moved.components[0].params.x,3);assert.equal(moved.components[0].params.y,7);assert.ok(legalAtoms(moved));assert.ok(selectedEditorDegrees(off,['unit']).some(degree=>degree.properties.includes('omnic.extent')));
 assert.deepEqual(off.components,source.components);assert.deepEqual(off.operations,source.operations);
});
