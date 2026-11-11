import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, addStructure, bind, resolve, specification, validateWorld, setInvariant, locate } from '../src/core/model.ts';
import { capabilities, translate } from '../src/core/capabilities.ts';
import { createSelection } from '../src/core/selection.ts';
import { createStore } from '../src/core/store.ts';

function sample() {
  const world = emptyWorld();
  const a = addStructure(world, [0, 0, 0], 1), b = addStructure(world, [8, 0, 0], 2), c = addStructure(world, [16, 0, 0], 3);
  return { world, a, b, c };
}
function memory(initial = null) {
  let value = initial, writes = 0;
  return { getItem: () => value, setItem: (_key, next) => { value = next; writes++; }, get value() { return value; }, get writes() { return writes; } };
}

test('a follower survives changes and reload but cannot silently substitute after deletion', () => {
  const { world, a, b } = sample(); const reference = bind(a, 'follow', world);
  a.position = [2, 3, 4]; a.label = 'Changed';
  assert.equal(resolve(reference, world)[0], a);
  const restored = validateWorld(JSON.parse(JSON.stringify(world)));
  assert.equal(resolve(reference, restored)[0].label, 'Changed');
  world.nodes.splice(world.nodes.indexOf(a), 1); b.position = [2, 3, 4];
  assert.deepEqual(resolve(reference, world), []);
});
test('a positional reference follows occupancy instead of the originally selected structure', () => {
  const { world, a, b } = sample(), reference = bind(a, 'position', world);
  a.position = [0, 4, 0]; assert.deepEqual(resolve(reference, world), []);
  b.position = [0, 0, 0]; assert.deepEqual(resolve(reference, world), [b]);
});
test('invariant equality ignores labels, position and paint; duplicate promotion is rejected', () => {
  const { world, a, b } = sample(); a.label = 'One'; b.label = 'Another'; b.color = '#ff0000';
  assert.equal(specification(a, world), specification(b, world));
  setInvariant(world, a, true);
  assert.throws(() => setInvariant(world, b, true), /equivalent/);
  assert.deepEqual(resolve(bind(a, 'structure', world), world), [a]);
});
test('ordered composition reuses components and retains meaningful order', () => {
  const { world, a, b, c } = sample(); b.parts.push(bind(a, 'follow', world));
  c.parts.push(bind(a, 'follow', world), bind(b, 'follow', world));
  const before = specification(c, world); c.parts.reverse();
  assert.notEqual(specification(c, world), before); assert.equal(world.nodes.length, 3);
  validateWorld(world);
});
test('cycles through positional and continuity references cannot be committed', () => {
  const { world, a, b } = sample(); a.parts.push(bind(b, 'position', world)); b.parts.push(bind(a, 'follow', world));
  assert.throws(() => validateWorld(world), /Circular|contain itself/);
});
test('a changed invariant leaves an incompatible structural selector unresolved', () => {
  const { world, a, b } = sample(); setInvariant(world, a, true);
  const unit = bind(a, 'structure', world); a.parts.push(unit);
  // The old unit selector is unresolved after this actual structural change.
  validateWorld(world); assert.deepEqual(resolve(unit, world), []);
  b.parts.push(bind(a, 'structure', world)); validateWorld(world);
});
test('shared definitions retain independent values and target only the requested set', () => {
  const { world, a, b } = sample();
  const ca = capabilities(a).find(c => c.key === 'color'), cb = capabilities(b).find(c => c.key === 'color');
  assert.equal(ca.properties[0].property, cb.properties[0].property);
  ca.properties[0].write('#ff0000'); assert.equal(b.color, '#c4cb9b');
  translate(world, [a.origin, b.origin], [1, 2, 3]);
  assert.deepEqual(a.position, [1, 2, 3]); assert.deepEqual(b.position, [9, 2, 3]);
});
test('borrowed picking preserves selection on rejection, acceptance and cancellation', () => {
  const selection = createSelection((a, b) => a === b); selection.set(['original']);
  selection.request(target => target === 'valid'); selection.pick('invalid');
  assert.equal(selection.requesting, true); assert.deepEqual(selection.values, ['original']);
  selection.pick('valid'); assert.equal(selection.requesting, false); assert.deepEqual(selection.values, ['original']);
  selection.request(() => false); selection.cancel(); assert.deepEqual(selection.values, ['original']);
});
test('an accepting reference picker cannot close a newer request', () => {
  const selection = createSelection((a, b) => a === b); selection.set(['original']);
  selection.request(() => { selection.request(() => false); return true; });
  selection.pick('target'); assert.equal(selection.requesting, true);
  selection.cancel(); assert.deepEqual(selection.values, ['original']);
});
test('one operation produces one undo entry, including references and independently saved values', () => {
  const storage = memory(), store = createStore(storage); let origin;
  store.change(world => { origin = addStructure(world, [1, 2, 3], 1).origin; });
  store.change(world => { locate(world, origin).label = 'Saved'; });
  store.undo(); assert.equal(locate(store.world, origin).label, '');
  store.redo(); assert.equal(locate(store.world, origin).label, 'Saved');
  assert.equal(createStore(storage).world.nodes[0].label, 'Saved');
});
test('an invalid operation leaves state and storage untouched', () => {
  const storage = memory(), store = createStore(storage); store.change(world => addStructure(world, [0, 0, 0], 1));
  const before = storage.value, writes = storage.writes;
  assert.throws(() => store.change(world => { const node = world.nodes[0]; node.parts.push(bind(node, 'follow', world)); }), /Circular|contain itself/);
  assert.equal(storage.value, before); assert.equal(storage.writes, writes); assert.equal(store.world.nodes[0].parts.length, 0);
});
test('unknown, corrupt or oversized saves are preserved without overwrite', () => {
  for (const saved of ['broken', JSON.stringify({ format: 'omnium-world', version: 99, nodes: [] }), 'x'.repeat(4000001)]) {
    const storage = memory(saved), store = createStore(storage);
    store.change(world => addStructure(world, [0, 0, 0], 1));
    assert.equal(storage.value, saved); assert.equal(storage.writes, 0); assert.match(store.message, /preserved/);
  }
});
test('a denied save leaves committed work in memory and reports the failure', () => {
  const store = createStore({ getItem: () => null, setItem: () => { throw new Error('full'); } });
  store.change(world => addStructure(world, [1, 2, 3], 1));
  assert.equal(store.world.nodes.length, 1); assert.match(store.message, /Saving failed/);
});
test('coincident positions cannot pass validation', () => {
  const { world, a, b } = sample(); b.position = [...a.position];
  assert.throws(() => validateWorld(world), /same address/);
});
test('duplicate birth anchors cannot pass validation', () => {
  const { world, a, b } = sample(); b.origin = structuredClone(a.origin);
  assert.throws(() => validateWorld(world), /same address/);
});
test('combinatorial compositions fail at the structural budget rather than expanding unboundedly', () => {
  const { world, a } = sample(); let previous = a;
  for (let i = 0; i < 20; i++) {
    const node = addStructure(world, [i * 4, 10, 0], i + 10);
    node.parts = Array.from({ length: 8 }, () => bind(previous, 'follow', world)); previous = node;
  }
  assert.throws(() => validateWorld(world), /budget/);
});
