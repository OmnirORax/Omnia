import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrimaryClickGate} from '../src/ui/primaryClick.ts';

test('one physical press admits one click while genuine consecutive clicks remain independent',()=>{
 const gate=createPrimaryClickGate(),control={};
 gate.press([control]);assert.equal(gate.click(control,1),true);assert.equal(gate.click(control,1),false);
 gate.press([control]);assert.equal(gate.click(control,2),true);
});
test('new controls cannot inherit a press after a popup is replaced or dismissed',()=>{
 const gate=createPrimaryClickGate(),old={},replacement={};gate.press([old]);
 assert.equal(gate.click(replacement,1),false);assert.equal(gate.click(old,1),false);
 gate.press([old]);assert.equal(gate.click(old,1),true);
});
test('keyboard and programmatic activation stay usable; cancellation discards mouse tails',()=>{
 const gate=createPrimaryClickGate(),control={};assert.equal(gate.click(control,0),true);
 gate.press([control]);gate.cancel();assert.equal(gate.click(control,1),false);
 assert.equal(gate.click(control,0),true);
});
