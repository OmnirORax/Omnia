import { sceneReferences } from '../src/core/transfer.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld, addStructure, bind, resolve, validateWorld } from '../src/core/model.ts';
import { subsetWorld, createPartsFile, parsePartsFile, preparePartsImport, fullChoice, availableChoice } from '../src/core/transferParts.ts';
const content = nodes => ({ nodes: nodes.map(n => JSON.stringify(n.origin)), settings: false, scene: false, appearance: false });

test('selected content includes hierarchy, variant, glyph and structural dependencies but omits unrelated nodes', () => {
  const world = emptyWorld(), a = addStructure(world,[0,0,0],1), b = addStructure(world,[1,0,0],2), c = addStructure(world,[2,0,0],3), spare = addStructure(world,[3,0,0],4);
  a.invariant = true; b.parts = [bind(a,'structure',world)]; c.parent = b.origin; c.variantOf = b.origin;
  c.text = { version:1, content:[{glyph:JSON.stringify(a.origin)}] };
  const subset = subsetWorld(world, content([c]));
  assert.deepEqual(subset.nodes.map(n => n.origin), [a,b,c].map(n => n.origin));
  assert.equal(subset.scene, undefined); assert.equal(subset.appearance,undefined); assert.equal(subset.settings,undefined);
  assert.ok(!subset.nodes.some(n => n.origin.born === spare.origin.born)); validateWorld(subset);
});
test('partial files round trip and settings-only imports preserve content and unselected settings', () => {
  const source = emptyWorld(); source.settings.names = 'all'; source.appearance = { background:{color:'#123456'} }; addStructure(source,[0,0,0],1);
  const current = emptyWorld(); addStructure(current,[9,0,0],10);
  const choice = { nodes:[], settings:true, scene:false, appearance:false };
  const file = parsePartsFile(JSON.stringify(createPartsFile(source,choice)));
  const next = preparePartsImport(current,file,availableChoice(file),false);
  assert.deepEqual(next.nodes,current.nodes); assert.deepEqual(next.scene,current.scene); assert.equal(next.appearance,undefined); assert.equal(next.settings.names,'all');
  assert.throws(() => preparePartsImport(current,file,choice,true),/complete/);
  assert.throws(() => preparePartsImport(current,file,{...choice,appearance:true},false),/present/);
});
test('adding copies remaps birth anchors, position bindings, glyphs, hierarchy and relationship endpoints together', () => {
  const source = emptyWorld(), a=addStructure(source,[0,0,0],1), b=addStructure(source,[1,0,0],2);
  a.invariant=true; b.parts=[bind(a,'follow',source),bind(a,'position',source),bind(a,'structure',source)]; b.parent=a.origin;
  b.text={version:1,content:[{glyph:JSON.stringify(a.origin)}]};
  source.relationships=[{from:bind(a,'follow',source),to:bind(b,'position',source),kind:'test',label:''}];
  const current=structuredClone(source), file=createPartsFile(source,fullChoice(source));
  const next=preparePartsImport(current,file,availableChoice(file),false), [copyA,copyB]=next.nodes.slice(2);
  assert.equal(next.nodes.length,4); assert.notDeepEqual(copyA.origin,a.origin); assert.equal(copyA.invariant,false);
  assert.deepEqual(copyB.parent,copyA.origin); assert.equal(copyB.text.content[0].glyph,JSON.stringify(copyA.origin));
  assert.equal(resolve(copyB.parts[0],next)[0],copyA); assert.equal(resolve(copyB.parts[1],next)[0],copyA);
  assert.equal(resolve(copyB.parts[2],next)[0],next.nodes[0]);
  assert.equal(resolve(next.relationships[1].to,next)[0],copyB);
  assert.deepEqual(current,source); validateWorld(next);
});
test('replacement restores only selected parts and legacy full backups remain supported', () => {
  const source=emptyWorld(); addStructure(source,[0,0,0],1); source.settings.names='all';
  const current=emptyWorld(); current.appearance={background:{color:'#123456'}};
  const legacy=parsePartsFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world:source,scenes:[]}));
  const choice={...fullChoice(source),appearance:false,scene:false,settings:false};
  const next=preparePartsImport(current,legacy,choice,true);
  assert.deepEqual(next.nodes,source.nodes); assert.deepEqual(next.appearance,current.appearance); assert.deepEqual(next.settings,current.settings);
});
test('malformed choices and unresolved merge references fail without changing either world', () => {
  const source=emptyWorld(), node=addStructure(source,[0,0,0],1); node.parts=[{mode:'follow',origin:{born:99,at:[9,9,9]}}];
  const file=createPartsFile(source,fullChoice(source)), current=emptyWorld(), before=structuredClone(file);
  assert.throws(()=>preparePartsImport(current,file,availableChoice(file),false),/unresolved/);
  assert.deepEqual(file,before); assert.deepEqual(current,emptyWorld());
  assert.throws(()=>parsePartsFile(JSON.stringify({...file,parts:{...file.parts,nodes:['missing']}})),/present/);
  assert.throws(()=>subsetWorld(source,{...fullChoice(source),nodes:[JSON.stringify(node.origin),JSON.stringify(node.origin)]}),/present/);
});
test('node exports retain referenced assets and node images while excluding unselected global media', () => {
  const source=emptyWorld(), a=addStructure(source,[0,0,0],1), b=addStructure(source,[1,0,0],2);
  const image={id:'visual',name:'visual.png',kind:'image',dataUrl:'data:image/png;base64,iVBORw0KGgo='};
  source.assets=[image]; a.visual={assetId:image.id}; a.scene='node-image'; b.scene='other-image'; source.scene.image='global-image';
  const file=createPartsFile(source,content([a]));
  assert.deepEqual(file.world.assets,[image]); assert.equal(file.world.scene,undefined); assert.equal(file.world.nodes.length,1);
  assert.deepEqual([...sceneReferences(file.world)],['node-image']);
  const settings=createPartsFile(source,{nodes:[],settings:false,scene:true,appearance:false});
  assert.deepEqual(settings.world.assets,[]); assert.deepEqual([...sceneReferences(settings.world)],['global-image']);
});
