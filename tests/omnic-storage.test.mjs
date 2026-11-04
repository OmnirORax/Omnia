import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspace,WORKSPACE_KEY} from '../src/omnic/workspace.ts';

test('workspace storage retains the latest successful authority and never reopens stale fallback state',async()=>{
  const rows=new Map(),local=new Map();let failed=false;
  const db={close(){},transaction(){
    const tx={objectStore:()=>({get:key=>{const request={result:rows.get(key)};queueMicrotask(()=>failed?tx.onabort?.():tx.oncomplete?.());return request;},put:(value,key)=>{queueMicrotask(()=>{if(failed)tx.onabort?.();else{rows.set(key,structuredClone(value));tx.oncomplete?.();}});}})};return tx;
  }};
  globalThis.localStorage={getItem:key=>local.get(key)??null,setItem:(key,value)=>local.set(key,value),removeItem:key=>local.delete(key)};
  globalThis.indexedDB={open(){const request={result:db};queueMicrotask(()=>request.onsuccess?.());return request;}};
  const {saveWorkspaceSlot,readWorkspaceSlot,readWorkspaceReplacement}=await import('../src/omnic/workspaceStorage.ts');
  const initial=createWorkspace();await saveWorkspaceSlot(initial);assert.deepEqual(await readWorkspaceSlot(),initial);
  failed=true;const next={...initial,name:'Fallback is newer'};await saveWorkspaceSlot(next);
  assert.equal(local.get(`${WORKSPACE_KEY}:storage`),'local');assert.deepEqual(await readWorkspaceSlot(),next);
  failed=false;const latest={...initial,name:'IndexedDB recovered'};await saveWorkspaceSlot(latest);
  assert.equal(local.get(`${WORKSPACE_KEY}:storage`),'indexeddb');assert.deepEqual(await readWorkspaceSlot(),latest);
  failed=true;await assert.rejects(readWorkspaceSlot(),'a failed authoritative read cannot reopen the older fallback');
  failed=false;await saveWorkspaceSlot(initial,'before-replace');assert.deepEqual(await readWorkspaceSlot('before-replace'),initial);
  assert.deepEqual(await readWorkspaceSlot(),latest,'backup does not replace the active workspace');
  const ui={format:'omnium-ui-template',version:3,layout:{custom:'preserved'},settings:{bindings:{Q:''}},fonts:[]};
  await saveWorkspaceSlot(initial,'before-replace',ui);
  assert.deepEqual(await readWorkspaceReplacement(),{workspace:initial,ui});assert.deepEqual(await readWorkspaceSlot('before-replace'),initial,'workspace-only readers can recover the workspace');
  assert.deepEqual(await readWorkspaceSlot(),latest,'saving the original pair never replaces active work');
  failed=true;await saveWorkspaceSlot(next,'before-replace',ui);assert.deepEqual(await readWorkspaceReplacement(),{workspace:next,ui},'restricted storage fallback preserves the pair in one record');
  failed=false;await saveWorkspaceSlot(initial,'before-replace');assert.deepEqual(await readWorkspaceReplacement(),{workspace:initial},'a later workspace-only replacement cannot revive stale UI from an older import');
  rows.set('before-replace',{format:'omnium-workspace-replacement',version:2,workspace:initial,ui});await assert.rejects(readWorkspaceReplacement(),/Unsupported/);assert.equal(rows.get('before-replace').version,2,'unsupported recovery data is untouched');
  rows.delete('active');await assert.rejects(readWorkspaceSlot(),/missing/);
  delete globalThis.indexedDB;delete globalThis.localStorage;
});
