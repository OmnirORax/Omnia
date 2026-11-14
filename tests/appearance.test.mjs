import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyWorld,addStructure,validateWorld,specification,locate } from '../src/core/model.ts';
import { readPaint,writePaint,resetPaint } from '../src/core/appearance.ts';
import { inherited } from '../src/core/lattice.ts';
import { childNode,copyNode,detachNode } from '../src/core/nodeOperations.ts';
import { createStore } from '../src/core/store.ts';
import { parseWorkspaceFile } from '../src/core/transfer.ts';
import { visualProperties,paintColor } from '../src/properties/visual.ts';
import { emboldenStrokeEm } from '../src/properties/embolden.ts';
import { textStyle } from '../src/ui/appearance.ts';

test('targets share paint definitions and expose font only for text',()=>{
  const text=visualProperties(true),surface=visualProperties(false);
  assert.equal(text[0],surface[0]);assert.equal(text[1],surface[1]);assert.equal(text[2],surface[2]);
  assert.equal(text.at(-1).key,'font');assert.ok(text.some(p=>p.key==='embolden'&&p.presentation==='slider'));assert.ok(!surface.some(p=>p.key==='font'||p.key==='embolden'||p.key==='texture'));
  const world=emptyWorld(),node=addStructure(world,[0,0,0],1);
  for(const target of ['nodes','background'])assert.throws(()=>writePaint(world,target,[node.origin],{font:'serif'}),/Invalid/);
});

test('editing each target keeps independent values, graph identity and text content',()=>{
  const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[5,0,0],2);
  a.text={version:1,content:['Authored **text**']};const content=structuredClone(a.text),origin=structuredClone(a.origin),signature=specification(a,world);
  writePaint(world,'nodes',[a.origin],{color:'#abcdef',translucency:.3,glow:.8});
  writePaint(world,'text',[],{color:'#eeeeee',font:'serif'});
  writePaint(world,'background',[],{color:'#123456',translucency:.5,glow:.3});
  writePaint(world,'nodeText',[a.origin],{font:'mono',glow:.2});
  assert.equal(readPaint(world,'nodes',a.origin).color,'#abcdef');assert.notEqual(b.color,a.color);
  assert.equal(readPaint(world,'nodeText',a.origin).font,'mono');assert.equal(readPaint(world,'nodeText',b.origin).font,'serif');
  assert.equal(readPaint(world,'nodeText',a.origin).color,'#eeeeee');
  assert.equal(paintColor(readPaint(world,'background')),'#12345680');
  assert.deepEqual(a.text,content);assert.deepEqual(a.origin,origin);assert.equal(specification(a,world),signature);validateWorld(world);
});

test('variant text paint inherits, overrides, resets, copies and materializes on detach',()=>{
  const world=emptyWorld(),owner=addStructure(world,[0,0,0],1),variant=childNode(world,owner.origin,true);
  writePaint(world,'nodeText',[owner.origin],{color:'#aabbcc',font:'serif'});
  assert.equal(readPaint(world,'nodeText',variant.origin).font,'serif');
  writePaint(world,'nodeText',[variant.origin],{font:'mono'});
  assert.equal(readPaint(world,'nodeText',owner.origin).font,'serif');assert.equal(readPaint(world,'nodeText',variant.origin).color,'#aabbcc');
  resetPaint(world,'nodeText',[variant.origin]);assert.equal(readPaint(world,'nodeText',variant.origin).font,'serif');
  const copy=copyNode(world,variant,[8,0,0]);assert.deepEqual(copy.textAppearance,inherited(variant,world).textAppearance);
  detachNode(world,variant.origin);writePaint(world,'nodeText',[owner.origin],{font:'system'});
  assert.equal(readPaint(world,'nodeText',variant.origin).font,'serif');validateWorld(world);
});

test('appearance survives save, export, reload and undo without damaging other settings',()=>{
  let saved=null;const store=createStore({getItem:()=>saved,setItem:(_key,value)=>saved=value});let origin;
  store.change(world=>{origin=addStructure(world,[0,0,0],1).origin;});
  store.change(world=>{writePaint(world,'nodeText',[origin],{color:'#123456',translucency:.4,font:'electric'});writePaint(world,'background',[],{glow:1});});
  const restored=createStore({getItem:()=>saved,setItem:()=>{}}).world;
  const exported=parseWorkspaceFile(JSON.stringify({format:'omnium-v2-workspace',version:1,world:{...restored,scene:{...restored.scene,image:null}},scenes:[]}));
  assert.deepEqual(exported.world.appearance,store.world.appearance);assert.deepEqual(locate(exported.world,origin).textAppearance,locate(store.world,origin).textAppearance);
  store.undo();assert.equal(locate(store.world,origin).textAppearance,undefined);store.redo();assert.equal(locate(store.world,origin).textAppearance.font,'electric');
  const settings=structuredClone(store.world.settings);store.change(world=>resetPaint(world,'background',[]));assert.deepEqual(store.world.settings,settings);
});

test('invalid paint values cannot be committed or imported',()=>{
  for(const patch of [{color:'red'},{translucency:-1},{glow:2},{font:'url(bad)'},{glow:Infinity},{embolden:-1},{embolden:11},{embolden:'huge'}]){
    const world=emptyWorld();world.appearance={text:patch};assert.throws(()=>validateWorld(world),/Invalid/);
  }
  const world=emptyWorld();world.appearance={background:{font:'serif'}};assert.throws(()=>validateWorld(world),/Invalid/);
  world.appearance={background:{embolden:2}};assert.throws(()=>validateWorld(world),/Invalid/);
  const node=addStructure(emptyWorld(),[0,0,0],1);node.textAppearance={translucency:NaN};
  const next=emptyWorld();next.nodes=[node];assert.throws(()=>validateWorld(next),/Invalid/);
});

test('forced boldness is an independent reusable text property',()=>{
  assert.equal(emboldenStrokeEm(0),0);
  assert.equal(emboldenStrokeEm(10),.09);
  assert.ok(emboldenStrokeEm(6) > 0.05 && emboldenStrokeEm(6) < 0.07);
  assert.ok(emboldenStrokeEm(2) > 0.02 && emboldenStrokeEm(2) < 0.03);
  assert.ok(emboldenStrokeEm(10) < .1, 'avoid sealing glyph counters at high strength');
  assert.equal('WebkitTextStroke' in textStyle({embolden:6}),false);
  const world=emptyWorld(),node=addStructure(world,[0,0,0],1);
  writePaint(world,'text',[],{embolden:5});
  assert.equal(readPaint(world,'nodeText',node.origin).embolden,5);
  writePaint(world,'nodeText',[node.origin],{embolden:8});
  assert.equal(readPaint(world,'nodeText',node.origin).embolden,8);
  assert.equal(readPaint(world,'text').embolden,5);
  validateWorld(world);
  const roundtrip=validateWorld(structuredClone(world));
  assert.equal(readPaint(roundtrip,'nodeText',node.origin).embolden,8);
  resetPaint(world,'nodeText',[node.origin]);
  assert.equal(readPaint(world,'nodeText',node.origin).embolden,5);
});


test('global Nodes paint is a shared default for existing and new nodes with independent overrides',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[5,0,0],2);
 const original=structuredClone(world.nodes);writePaint(world,'nodeDefaults',[],{color:'#123456',translucency:.2,glow:.8});
 assert.deepEqual(world.nodes,original);assert.deepEqual(readPaint(world,'nodes',a.origin),{color:'#123456',translucency:.2,glow:.8});
 const fresh=addStructure(world,[8,0,0],3);assert.equal(readPaint(world,'nodes',fresh.origin).color,'#123456');
 writePaint(world,'nodes',[b.origin],{color:'#ffb000',glow:.1});assert.equal(readPaint(world,'nodes',b.origin).color,'#ffb000');assert.equal(readPaint(world,'nodes',b.origin).glow,.1);
 writePaint(world,'nodeDefaults',[],{color:'#abcdef',glow:.9});assert.equal(readPaint(world,'nodes',a.origin).color,'#abcdef');assert.equal(readPaint(world,'nodes',b.origin).color,'#ffb000');
 resetPaint(world,'nodes',[b.origin]);assert.equal(readPaint(world,'nodes',b.origin).color,'#abcdef');assert.equal(readPaint(world,'nodes',b.origin).glow,.9);
 resetPaint(world,'nodeDefaults',[]);assert.equal(readPaint(world,'nodes',a.origin).color,'#ffb000');validateWorld(world);
});
test('global Nodes defaults preserve legacy colors and inherited/copied explicit default-color overrides',()=>{
 const world=emptyWorld(),owner=addStructure(world,[0,0,0],1),legacy=addStructure(world,[9,0,0],2);legacy.color='#ffffff';
 writePaint(world,'nodeDefaults',[],{color:'#123456'});writePaint(world,'nodes',[owner.origin],{color:'#ffb000'});
 const variant=childNode(world,owner.origin,true);assert.equal(readPaint(world,'nodes',variant.origin).color,'#ffb000');
 const copy=copyNode(world,variant,[12,0,0]);assert.equal(readPaint(world,'nodes',copy.origin).color,'#ffb000');assert.equal(readPaint(world,'nodes',legacy.origin).color,'#ffffff');
 validateWorld(JSON.parse(JSON.stringify(world)));assert.throws(()=>writePaint(world,'nodeDefaults',[],{font:'serif'}),/Invalid/);
});
test('global Nodes defaults share workspace export and history without rewriting authored nodes',()=>{
 const saved=new Map(),store=createStore({getItem:key=>saved.get(key)??null,setItem:(key,value)=>saved.set(key,value)});let origin;
 store.change(world=>{origin=addStructure(world,[0,0,0],1).origin;});
 store.change(world=>writePaint(world,'nodeDefaults',[],{color:'#123456',glow:.7}));
 const restored=validateWorld(JSON.parse(JSON.stringify(store.world)));assert.equal(readPaint(restored,'nodes',origin).color,'#123456');assert.equal(restored.nodes[0].color,'#ffb000');
 store.undo();assert.equal(store.world.appearance.nodes,undefined);store.redo();assert.equal(readPaint(store.world,'nodes',origin).color,'#123456');
});
