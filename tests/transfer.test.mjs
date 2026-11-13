import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, addStructure, bind, resolve } from '../src/core/model.ts';
import { parseWorkspaceFile, rebindScenes, encodeBytes, decodeScene, sceneReferences, checkedWorld } from '../src/core/transfer.ts';
import { createStore } from '../src/core/store.ts';

function fixture() {
  const world = emptyWorld(), a = addStructure(world, [1, 2, 3], 10), b = addStructure(world, [4, 5, 6], 11);
  world.scene.image = null;
  a.invariant = true; a.label = 'Shared'; b.parts = ['follow', 'position', 'structure'].map(mode => bind(a, mode, world));
  return world;
}
const pack = (world, scenes = []) => JSON.stringify({ format:'omnium-v2-workspace',version:1,world,scenes });
function memory() {
  const slots = new Map(); let blocked = '';
  return { slots, block(key) { blocked = key; }, getItem(key) { return slots.get(key) ?? null; }, setItem(key,value) { if (key === blocked) throw Error('Quota'); slots.set(key,value); } };
}

test('workspace round trip preserves coordinates, birth anchors, and all three binding semantics', () => {
  const original = fixture(), restored = parseWorkspaceFile(pack(original)).world;
  assert.deepEqual(restored, original);
  for (const binding of restored.nodes[1].parts) assert.equal(resolve(binding, restored)[0], restored.nodes[0]);
});
test('image transport is lossless and rejects malformed or mismatched image content', () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  const image = { id:'image',name:'scene.png',type:'image/png',data:encodeBytes(bytes) };
  assert.deepEqual(decodeScene(image), bytes);
  assert.throws(() => decodeScene({ ...image, type:'image/jpeg' }));
  assert.throws(() => decodeScene({ ...image, data:'AAAA?' }));
});
test('referenced images must be complete and unique; remapping preserves explicit clear and inheritance', () => {
  const world = fixture(); world.scene.image = 'image'; world.nodes[0].scene = null; world.nodes[1].scene = 'image';
  assert.deepEqual([...sceneReferences(world)], ['image']);
  assert.throws(() => parseWorkspaceFile(pack(world)), /missing scene/);
  const image = { id:'image',name:'scene.png',type:'image/png',data:encodeBytes(new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])) };
  assert.throws(() => parseWorkspaceFile(pack(world,[image,image])), /Duplicate/);
  assert.equal(parseWorkspaceFile(pack(world,[image])).scenes.length,1);
  const restored = rebindScenes(world,new Map([['image','restored']]));
  assert.equal(restored.scene.image,'restored'); assert.equal(restored.nodes[0].scene,null); assert.equal(restored.nodes[1].scene,'restored');
  assert.equal(world.scene.image,'image'); assert.throws(() => rebindScenes(world,new Map()), /not restored/);
});
test('unsupported versions, invalid compositions and oversize worlds are rejected', () => {
  const world = fixture();
  assert.throws(() => parseWorkspaceFile(pack(world).replace('"version":1','"version":99')), /Unsupported/);
  world.nodes[0].parts.push(bind(world.nodes[1],'follow',world));
  assert.throws(() => parseWorkspaceFile(pack(world)), /Circular|itself/);
  assert.throws(() => checkedWorld({ ...emptyWorld(), extra:'x'.repeat(4_000_000) }), /4 MB/);
});
test('replacement survives reload, is undoable, and recovery swaps to the previous workspace', () => {
  const storage=memory(), store=createStore(storage); store.change(world => addStructure(world,[0,0,0],1));
  const before=structuredClone(store.world), incoming=fixture(); store.replace(incoming);
  assert.deepEqual(createStore(storage).world,incoming); store.undo(); assert.deepEqual(store.world,before);
  store.redo(); assert.deepEqual(store.world,incoming); store.recover(); assert.deepEqual(store.world,before);
  store.recover(); assert.deepEqual(store.world,incoming);
});
test('failed replacement preserves current state and active save, including malformed input', () => {
  for (const blocked of ['omnium.v2.world.2','omnium.v2.world.2.before-import']) {
    const storage=memory(), store=createStore(storage); store.change(world => addStructure(world,[0,0,0],1));
    const before=store.world, raw=storage.getItem('omnium.v2.world.2'); storage.block(blocked);
    assert.throws(() => store.replace(fixture()), /Quota/);
    assert.equal(store.world,before); assert.equal(storage.getItem('omnium.v2.world.2'),raw);
    assert.throws(() => store.replace({format:'broken'})); assert.equal(store.world,before);
  }
});
test('import out of recovery preserves the unreadable original save', () => {
  const storage=memory(); storage.setItem('omnium.v2.world.2','broken'); const store=createStore(storage);
  assert.match(store.message,/paused/); store.replace(fixture());
  assert.equal(storage.getItem('omnium.v2.world.2.before-import'),'broken'); assert.equal(store.message,'');
});
