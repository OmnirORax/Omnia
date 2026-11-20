import test from 'node:test';import assert from 'node:assert/strict';
import {createSelection} from '../src/core/selection.ts';
test('a hover-only action retains its node after the canvas loses hover to the label editor',()=>{
 const selection=createSelection((a,b)=>a===b);selection.hover('hovered node');selection.commitTargets();selection.hover(undefined);
 assert.deepEqual(selection.targets,['hovered node']);assert.deepEqual(selection.committed,['hovered node']);
});
test('a hovered node replaces a previous single target for the next action',()=>{
 const selection=createSelection((a,b)=>a===b);selection.set(['old node']);selection.hover('new node');selection.commitTargets();selection.hover(undefined);assert.deepEqual(selection.targets,['new node']);
});
test('committing action targets preserves a selected group and supports binder targets',()=>{
 const selection=createSelection((a,b)=>a===b);selection.set(['a','b']);selection.hover('other');selection.commitTargets();assert.deepEqual(selection.committed,['a','b']);
 selection.clear();selection.hover('binder');selection.commitTargets();selection.hover(undefined);assert.deepEqual(selection.targets,['binder']);
});
