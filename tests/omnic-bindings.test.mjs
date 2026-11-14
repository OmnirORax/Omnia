import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {atlasRecipeResolver,referenceKey} from '../src/omnic/bindings.ts';
import {createRecipe} from '../src/omnic/presets.ts';
test('glyph uses resolve canonical atlas structures without creating placement nodes',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);node.omnic={...createRecipe(),revision:2};
 const follower=referenceKey(node,'follow',world),occupant=referenceKey(node,'position',world),count=world.nodes.length;
 assert.equal(atlasRecipeResolver(world)(follower),node.omnic);assert.equal(world.nodes.length,count);
 node.position=[2,0,0];const replacement=addStructure(world,[0,0,0],2);replacement.omnic=createRecipe('line');
 assert.equal(atlasRecipeResolver(world)(follower),node.omnic);assert.equal(atlasRecipeResolver(world)(occupant),replacement.omnic);
 world.nodes.splice(world.nodes.indexOf(node),1);assert.equal(atlasRecipeResolver(world)(follower),undefined);
});
test('pinned references resolve an explicitly retained definition instead of silently using current code',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);node.omnic={...createRecipe(),revision:2};const old={...createRecipe('line'),revision:1};node.omnicHistory=[old];
 const key=referenceKey(node,'follow',world),resolve=atlasRecipeResolver(world);assert.equal(resolve(key),node.omnic);assert.equal(resolve(key,1),old);assert.equal(resolve(key,99),undefined);assert.equal(resolve('arbitrary-object-id'),undefined);
});
