import test from 'node:test';import assert from 'node:assert/strict';
import {createImageTrash} from '../src/scene/imageTrash.ts';import {createActionHistory} from '../src/composer/runtime/ui/actionHistory.ts';import {createStore} from '../src/core/store.ts';
const id='sha256:'+'a'.repeat(64);
function fixture(saved=null){let value=saved;const history=createActionHistory({mode:'recent',steps:1,limit:10,minimum:1,categories:['settings','omnium']}),pending=new Set(),trash=createImageTrash({getItem:()=>value,setItem:(_key,next)=>value=next},history,ids=>ids.forEach(id=>pending.delete(id)),id=>pending.add(id));return {history,trash,pending,saved:()=>value};}
test('delete and background cleanup Undo/Redo share one action and synchronize visibility and pending shared deletion',()=>{
 const f=fixture(),store=createStore({getItem:()=>null,setItem(){}},f.history);store.change(world=>world.scene.image=id);const before=f.history.candidates('undo').length;
 f.trash.remove(id,14,()=>store.change(world=>world.scene.image=null));assert.equal(f.history.candidates('undo').length,before+1);assert.equal(store.world.scene.image,null);assert.equal(f.trash.has(id),true);assert.equal(f.pending.has(id),true);
 f.history.travel('undo');assert.equal(store.world.scene.image,id);assert.equal(f.trash.has(id),false);assert.equal(f.pending.has(id),false);
 f.history.travel('redo');assert.equal(store.world.scene.image,null);assert.equal(f.trash.has(id),true);assert.equal(f.pending.has(id),true);
});
test('retained bytes are bounded and failed deletion does not alter visibility/history',()=>{const f=fixture();assert.throws(()=>f.trash.remove(id,101*1024*1024),/full/);assert.equal(f.trash.has(id),false);assert.equal(f.history.candidates('undo').length,0);f.trash.remove(id,10);assert.equal(f.trash.bytes,10);});
test('a new session exposes previously deleted IDs for disk cleanup and starts with empty undo retention',()=>{const f=fixture(JSON.stringify({[id]:10}));assert.deepEqual(f.trash.previous,[id]);assert.equal(f.trash.has(id),false);assert.equal(f.trash.bytes,0);assert.equal(f.saved(),'{}');});
