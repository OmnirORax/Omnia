import test from 'node:test';
import assert from 'node:assert/strict';
import {createRecipe,PRESETS} from '../src/omnic/presets.ts';
import {validateRecipe,validateRecipeReferences} from '../src/omnic/model.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
import {renderSVG} from '../src/omnic/svg.ts';
import {defaultParams,OPERATORS} from '../src/omnic/registry.ts';
import {deleteComponents} from '../src/omnic/componentTargets.ts';
test('reused constructions evaluate and render independently without mutating their definitions',()=>{
 for(const preset of PRESETS){const source=createRecipe(preset.id),before=structuredClone(source),result=evaluateRecipe(source);assert.ok(result.nodes.length>0,preset.id);assert.match(renderSVG(result),/<svg/);assert.deepEqual(source,before);assert.notEqual(createRecipe(preset.id),source);}
});
test('operator chains preserve authored targets and disabled operations do not change geometry',()=>{
 const source=createRecipe('radial'),owner=source.components[0].id,move=OPERATORS.find(item=>item.id==='size');assert.ok(move);
 const operation={id:'move',operator:move.id,targets:[owner],params:{...defaultParams(move),factor:2},enabled:false};
 const original=evaluateRecipe(source);source.operations.push(operation);assert.deepEqual(evaluateRecipe(source).nodes,original.nodes);
 operation.enabled=true;assert.notDeepEqual(evaluateRecipe(source).nodes,original.nodes);
});
test('definition validation rejects unresolved references and preserves explicit empty scopes',()=>{
 const source=createRecipe('radial');source.components=[{id:'reference',generator:'reference',params:{},reference:'missing'}];assert.throws(()=>validateRecipeReferences(new Map([['root',source]]),id=>id==='root'?source:undefined),/Missing Omnic/);
 const recipe=createRecipe('radial'),id=recipe.components[0].id;recipe.operations=[{id:'op',operator:'fill',targets:[id],params:{fill:true},enabled:true}];
 const result=deleteComponents(validateRecipe(recipe),new Set([id]));assert.equal(result.components.length,0);assert.ok(!result.operations.some(op=>op.targets.length===0&&op.enabled));
});
test('invariant specifications ignore editor handles and revision numbers but retain program differences',async()=>{
 const {recipeSpecification}=await import('../src/omnic/specification.ts');
 const source=createRecipe('radial'),copy=structuredClone(source),old=copy.components[0].id;
 source.operations=[{id:'paint',operator:'fill',params:{fill:true,color:'#ff0000'},targets:[old],enabled:true}];copy.operations=structuredClone(source.operations);copy.revision=99;copy.components[0].id='different-handle';copy.operations[0].id='another-operation-handle';copy.operations[0].targets=['different-handle'];
 assert.equal(recipeSpecification(source),recipeSpecification(copy));copy.operations[0].enabled=false;assert.notEqual(recipeSpecification(source),recipeSpecification(copy));
});
