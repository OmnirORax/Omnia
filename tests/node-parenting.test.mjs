import test from 'node:test';
import assert from 'node:assert/strict';
import { addStructure, bind, emptyWorld, locate, validateWorld } from '../src/core/model.ts';
import { adoptNodes, childNode } from '../src/core/nodeOperations.ts';
import { createStore } from '../src/core/store.ts';

test('dropping a branch onto a node reparents it and lands beside occupied cells', () => {
  const world = emptyWorld(), old = addStructure(world, [0,0,0], 1);
  const child = childNode(world, old.origin), nested = childNode(world, child.origin);
  const parent = addStructure(world, [10,0,0], 4);
  const offset = nested.position.map((n, i) => n - child.position[i]);
  const delta = parent.position.map((n, i) => n - child.position[i]);
  adoptNodes(world, [child.origin, nested.origin], parent.origin, delta);
  assert.deepEqual(child.parent, parent.origin);
  assert.deepEqual(nested.parent, child.origin);
  assert.equal(old.parts.length, 0);
  assert.deepEqual(parent.parts, [bind(child, 'follow', world)]);
  assert.notDeepEqual(child.position, parent.position);
  assert.ok(Math.hypot(...child.position.map((n, i) => n - parent.position[i])) <= 1);
  assert.deepEqual(nested.position.map((n, i) => n - child.position[i]), offset);
  validateWorld(world);
});

test('adoption supports multiple roots, expands the owner and avoids duplicate links', () => {
  const world = emptyWorld(), parent = addStructure(world, [10,0,0], 1);
  const a = addStructure(world, [0,0,0], 2), b = addStructure(world, [0,3,0], 3);
  parent.parts.push(bind(a, 'follow', world)); parent.collapsed = true;
  adoptNodes(world, [a.origin, b.origin], parent.origin, [10,0,0]);
  assert.deepEqual(a.parent, parent.origin); assert.deepEqual(b.parent, parent.origin);
  assert.equal(parent.parts.length, 2); assert.equal(parent.collapsed, false);
  assert.deepEqual(b.position.map((n, i) => n - a.position[i]), [0,3,0]);
  validateWorld(world);
});

test('self and descendant adoption are rejected before mutation', () => {
  const world = emptyWorld(), parent = addStructure(world, [0,0,0], 1), child = childNode(world, parent.origin);
  const before = structuredClone(world);
  for (const target of [parent.origin, child.origin]) assert.throws(() => adoptNodes(world, [parent.origin], target, [1,0,0]), /own branch/);
  assert.deepEqual(world, before);
});

test('reparenting a variant materializes inherited content', () => {
  const world = emptyWorld(), source = addStructure(world, [0,0,0], 1), owner = addStructure(world, [10,0,0], 2);
  source.label = 'Inherited'; const variant = childNode(world, source.origin, true);
  adoptNodes(world, [variant.origin], owner.origin, [9,1,0]);
  assert.equal(variant.variantOf, undefined); assert.equal(variant.label, 'Inherited');
  assert.deepEqual(variant.parent, owner.origin); validateWorld(world);
});

test('drop is one undoable edit and a composition cycle leaves saved state untouched', () => {
  let saved = null; const store = createStore({ getItem: () => saved, setItem: (_key, value) => { saved = value; } });
  let a, b;
  store.change(world => { a = addStructure(world, [0,0,0], 1).origin; b = addStructure(world, [10,0,0], 2).origin; });
  store.change(world => adoptNodes(world, [a], b, [10,0,0]));
  const after = saved;
  store.undo(); assert.equal(locate(store.world, a).parent, undefined); assert.deepEqual(locate(store.world, a).position, [0,0,0]);
  store.redo(); assert.equal(saved, after);
  // Independent composition references must also prevent cycles.
  store.undo(); store.change(world => locate(world, a).parts.push(bind(locate(world, b), 'follow', world)));
  const before = saved;
  assert.throws(() => store.change(world => adoptNodes(world, [a], b, [10,0,0])), /Circular|contain itself/);
  assert.equal(saved, before); assert.equal(locate(store.world, a).parent, undefined);
});
