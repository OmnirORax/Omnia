import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS} from '../src/omnic/presets.ts';
import {insertConstruction} from '../src/omnic/tools.ts';
import {constructionEditorDegree,targetEditorDegrees,targetParameter} from '../src/omnic/targetDegrees.ts';
import {evaluateRecipe} from '../src/omnic/evaluate.ts';
const empty=()=>({version:2,revision:0,components:[],operations:[],frames:[]});
function insert(source){let id=0;return insertConstruction(empty(),source,{x:0,y:0},()=>`inserted-${++id}`);}
test('choosing Ring leaves Fill explicit instead of entering and previewing a filled region',()=>{
 const {recipe,ids}=insert(PRESETS.find(p=>p.id==='boundary').recipe),before=structuredClone(recipe);
 assert.equal(targetEditorDegrees(recipe,ids,[],[],'available').find(d=>targetParameter(d).editor)?.id,'omnic.fill');
 assert.equal(constructionEditorDegree(recipe,ids),undefined);
 assert.ok(targetEditorDegrees(recipe,ids).some(d=>d.id==='omnic.fill'));
 assert.ok(evaluateRecipe(recipe).nodes.filter(n=>n.kind!=='group').every(n=>n.fill===false));
 assert.deepEqual(recipe,before);
});
test('ordinary construction presets stay on their DOF menu; Path rule retains its structural editor',()=>{
 for(const preset of PRESETS){const {recipe,ids}=insert(preset.recipe),editor=constructionEditorDegree(recipe,ids);
  if(preset.id==='path-rule'){assert.equal(editor.id,'omnic.pathRule');assert.equal(targetParameter(editor).editor,'path-rule');}
  else assert.equal(editor,undefined,preset.id);
 }
});
