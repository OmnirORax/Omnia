import test from 'node:test';
import assert from 'node:assert/strict';
import {loadEditorModule} from '../src/ui/moduleLoader.ts';
test('an old document-module URL exposes reload recovery instead of a raw asset URL',async()=>{
 let calls=0,reloadsOffered=0;
 const load=()=>{calls++;throw new TypeError('Failed to fetch dynamically imported module: https://pr-81.omnia-web-bae.pages.dev/assets/editor-DmzVCgUt.js');};
 await assert.rejects(loadEditorModule(load,()=>reloadsOffered++),/Reload to get the current build or renew your session/);
 assert.equal(calls,1);assert.equal(reloadsOffered,1);
});
test('module evaluation errors retain their original diagnostic, and successful imports have no recovery work',async()=>{
 let offers=0;const error=new TypeError('Cannot read properties of undefined');
 await assert.rejects(loadEditorModule(()=>Promise.reject(error),()=>offers++),failure=>failure===error);
 const module={editDocument:()=>{}};assert.equal(await loadEditorModule(()=>Promise.resolve(module),()=>offers++),module);assert.equal(offers,0);
});
