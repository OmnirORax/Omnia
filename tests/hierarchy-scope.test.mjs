import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure} from '../src/core/model.ts';
import {hierarchyScope,toggleHierarchies} from '../src/core/nodeOperations.ts';
import {heldContentAction} from '../src/ui/contentViewShortcut.ts';
function fixture(){const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[2,0,0],2),c=addStructure(world,[4,0,0],3),other=addStructure(world,[8,0,0],4);b.parent=a.origin;c.parent=b.origin;return {world,a,b,c,other};}
test('empty-space hierarchy toggle treats all trees as one group',()=>{const {world,a,b,other}=fixture();const affected=toggleHierarchies(world,[]);assert.equal(affected.length,4);assert.equal(a.collapsed,true);assert.equal(b.collapsed,true);a.collapsed=false;toggleHierarchies(world,[]);assert.equal(a.collapsed,false);assert.equal(b.collapsed,false);assert.equal(other.collapsed,undefined);});
test('hierarchy content scope excludes unrelated trees and honors next level',()=>{const {world,a,b,c}=fixture();assert.deepEqual(hierarchyScope(world,[a.origin],true).nodes.map(n=>n.origin),[a.origin,b.origin]);assert.deepEqual(hierarchyScope(world,[a.origin]).nodes.map(n=>n.origin),[a.origin,b.origin,c.origin]);});
test('holding V while Q acts suppresses the standalone V toggle on release',()=>{let toggles=0;const hold=heldContentAction(()=>toggles++);hold.press('v');assert.equal(hold.active,true);hold.consume();hold.release('V');assert.equal(toggles,0);hold.press('v');hold.release('v');assert.equal(toggles,1);hold.press('v');hold.cancel();hold.release('v');assert.equal(toggles,1);});

test('picking up a hovered member uses the whole committed group',async()=>{const {createSelection,pickupSelection}=await import('../src/core/selection.ts');const selection=createSelection((a,b)=>a===b);selection.set(['a','b','c']);selection.hover('b');assert.deepEqual(selection.values,['b']);assert.deepEqual(pickupSelection(selection.committed,'b',(a,b)=>a===b),['a','b','c']);assert.deepEqual(pickupSelection(selection.committed,'other',(a,b)=>a===b),['other']);assert.deepEqual(selection.committed,['a','b','c']);});
