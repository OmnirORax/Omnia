import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesAssignedShortcut} from '../src/ui/shortcuts.ts';
import {WORLD_GESTURES} from '../src/ui/gestureShortcuts.ts';
test('multi-selection gestures are discoverable by action, aliases and pointer binding',()=>{
 for(const query of ['multi selection','multi-selection','multiselect','multiple selection','Ctrl drag'])assert.ok(WORLD_GESTURES.some(item=>matchesAssignedShortcut(item,item.defaultKey,query)),query);
 assert.equal(WORLD_GESTURES.find(item=>item.id==='gesture:multi-plane').defaultKey,'Ctrl+MB1');assert.ok(WORLD_GESTURES.every(item=>item.editable!==false));
});
test('only assigned shortcuts are listed, including gestures without keyboard aliases',()=>{
 const item={category:'Omnium',id:'test',label:'Test',defaultKey:'R'};assert.equal(matchesAssignedShortcut(item,'',''),false);assert.equal(matchesAssignedShortcut(item,'R',''),true);assert.equal(matchesAssignedShortcut({...item,gesture:'MB3 + scroll'},'','scroll'),true);
});
