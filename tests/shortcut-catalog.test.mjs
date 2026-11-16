import test from 'node:test';
import assert from 'node:assert/strict';
import {assignedShortcuts,registerContextActions} from '../src/ui/contextActions.ts';
test('shortcut aggregation tracks current bindings and retains metadata after a context closes',()=>{
 let key='R';const release=registerContextActions({label:'Test context',owns:()=>false,read:()=>[{label:'Rotate',key},{label:'No shortcut'}]});
 assert.deepEqual(assignedShortcuts().filter(item=>item.context==='Test context'),[{context:'Test context',label:'Rotate',key:'R'}]);key='Shift+R';assert.equal(assignedShortcuts().find(item=>item.context==='Test context').key,'Shift+R');release();key='Z';assert.equal(assignedShortcuts().find(item=>item.context==='Test context').key,'Shift+R');
});
