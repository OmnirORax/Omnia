import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,locate} from '../src/core/model.ts';
import {composerAtlas} from '../src/composer/atlasAdapter.ts';
import {saveDefinition,pinDefinition} from '../src/omnic/atlas.ts';
import {referenceKey} from '../src/omnic/bindings.ts';
import {createRecipe} from '../src/omnic/presets.ts';

test('original composer projects V2 identities without creating placements or object IDs',()=>{
 const world=emptyWorld(),a=saveDefinition(world,undefined,createRecipe('line'),'line'),b=saveDefinition(world,undefined,createRecipe('radial'),'radial');
 const owner=locate(world,a),other=locate(world,b);other.catalog={preset:true,tags:[],collections:[]};
 const before=JSON.stringify(world),atlas=composerAtlas(world,a);
 assert.equal(JSON.stringify(world),before);assert.equal(atlas.objects.length,2);
 assert.equal(atlas.entity.id,referenceKey(owner,'follow',world));
 assert.equal(atlas.objects.find(item=>item.label==='radial').id,referenceKey(other,'structure',world));
 assert.deepEqual(atlas.presetIds,[referenceKey(other,'structure',world)]);
 owner.position=[50,20,0];assert.equal(composerAtlas(world,a).entity.id,atlas.entity.id);
 assert.equal(composerAtlas(world,a).resolveReference(atlas.entity.id).components[0].generator,'line');
});

test('original revision controls resolve V2 positional, follower and pinned references',()=>{
 const world=emptyWorld(),origin=saveDefinition(world,undefined,createRecipe('line'),'line'),owner=locate(world,origin);
 const follow=referenceKey(owner,'follow',world),position=referenceKey(owner,'position',world),revision=pinDefinition(world,origin);
 owner.omnic.components[0].params.length=170;owner.position=[10,0,0];const atlas=composerAtlas(world,origin);
 assert.equal(atlas.referenceObject(follow).omnicHistory[0].revision,revision);
 assert.equal(atlas.resolveReference(follow,revision).components[0].params.length,createRecipe('line').components[0].params.length);
 assert.equal(atlas.resolveReference(follow).components[0].params.length,170);
 assert.equal(atlas.referenceObject(position),undefined);
 assert.equal(atlas.referenceObject('old-arbitrary-object-id'),undefined);
 assert.throws(()=>composerAtlas(world,{born:999,at:[99,0,0]}),/removed/);
});

test('3D editing cache follows transient hover and brush feedback without changing the definition',async()=>{
 const {createGlyphPresentation}=await import('../src/omnic/presentation.ts'),{evaluateRecipe}=await import('../src/omnic/evaluate.ts');
 const world=emptyWorld(),origin=saveDefinition(world,undefined,createRecipe('line'),'line'),node=locate(world,origin),before=JSON.stringify(world),recipe=node.omnic,evaluation=evaluateRecipe(recipe),read=createGlyphPresentation(world,true);
 const plain=read(node,0,{recipe,evaluation}),ghost={x:5,y:10,radius:3,color:'#ff0000'};
 const brush=read(node,0,{recipe,evaluation,ghost});assert.notEqual(brush.key,plain.key);assert.notEqual(brush.asset.dataUrl,plain.asset.dataUrl);
 assert.equal(read(node,0,{recipe,evaluation,ghost}),brush);
 const moved=read(node,0,{recipe,evaluation,ghost:{...ghost,x:6}});assert.notEqual(moved.key,brush.key);assert.equal(JSON.stringify(world),before);
});
