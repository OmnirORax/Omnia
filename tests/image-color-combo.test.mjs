import test from 'node:test';import assert from 'node:assert/strict';
import {imageColorCombo,applyImageColorCombo} from '../src/scene/colorCombo.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint} from '../src/core/appearance.ts';
import {createStore} from '../src/core/store.ts';
import {childNode} from '../src/core/nodeOperations.ts';
const pixels=new Uint8ClampedArray([0,200,160,255,0,200,160,255,240,80,120,255]);
test('plain image combos keep chromatic accents and never change glow strength or geometry',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1),before=structuredClone(node),glow=world.appearance?.text?.glow,nodeGlow=world.appearance?.nodes?.glow,combo=imageColorCombo(pixels);
 applyImageColorCombo(world,combo);assert.deepEqual(node,before);assert.equal(readPaint(world,'text').color,combo.text);assert.equal(readPaint(world,'nodeDefaults').glowColor,combo.nodeGlow);
 assert.match(combo.text,/^#[0-9a-f]{6}$/);assert.equal(world.appearance.text.glow,glow);assert.equal(world.appearance.nodes.glow,nodeGlow);validateWorld(world);
});
test('selected combo uses the shared inheritance owner and does not alter unrelated nodes',()=>{
 const world=emptyWorld(),owner=addStructure(world,[0,0,0],1),variant=childNode(world,owner.origin,true),other=addStructure(world,[8,0,0],2),before=readPaint(world,'nodes',other.origin),appearance=structuredClone(world.appearance),combo=imageColorCombo(pixels);
 applyImageColorCombo(world,combo,owner.origin);assert.equal(readPaint(world,'nodeText',variant.origin).color,combo.text);assert.equal(readPaint(world,'nodes',variant.origin).color,combo.node);assert.deepEqual(readPaint(world,'nodes',other.origin),before);assert.deepEqual(world.appearance,appearance);validateWorld(world);
});
test('one store edit applies all four colors atomically and undo restores them',()=>{
 const store=createStore({getItem:()=>null,setItem(){}}),before=structuredClone(store.world),combo=imageColorCombo(pixels);
 store.change(world=>applyImageColorCombo(world,combo));store.undo();assert.deepEqual(store.world,before);store.redo();assert.equal(store.world.appearance.text.glowColor,combo.textGlow);assert.equal(store.world.appearance.nodes.color,combo.node);
});

test('applying once leaves ordinary editable colors after the image changes',()=>{
 const world=emptyWorld(),combo=imageColorCombo(pixels);applyImageColorCombo(world,combo);world.scene.image=null;
 assert.equal(readPaint(world,'text').color,combo.text);writePaint(world,'text',[],{color:'#aabbcc'});assert.equal(readPaint(world,'text').color,'#aabbcc');
 assert.throws(()=>imageColorCombo(new Uint8ClampedArray([0,0,0,0])),/no visible/);
});

test('many blue shades do not crowd out purple/orange and white stays neutral',async()=>{
 const {extractScenePalette}=await import('../src/scene/palette.ts');const sample=[];
 for(let i=0;i<700;i++)sample.push(20+i%20,40+i%35,180+i%70,255);
 for(let i=0;i<100;i++)sample.push(255,130,30,255);
 for(let i=0;i<100;i++)sample.push(160,40,220,255);
 for(let i=0;i<100;i++)sample.push(245,245,245,255);
 const palette=extractScenePalette(new Uint8ClampedArray(sample));assert.equal(palette.accents.length,3);assert.equal(palette.neutrals.length,1);
 assert.ok(palette.accents.some(item=>parseInt(item.color.slice(1,3),16)>240));
 assert.ok(palette.accents.some(item=>parseInt(item.color.slice(1,3),16)>140&&parseInt(item.color.slice(5,7),16)>200));
});
