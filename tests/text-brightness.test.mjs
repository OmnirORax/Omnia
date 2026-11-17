import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint,resetPaint,paintPreview} from '../src/core/appearance.ts';
import {textStyle,textBorderStyle} from '../src/ui/appearance.ts';
import {renderedTextPaint,visualProperties} from '../src/properties/visual.ts';
import {childNode} from '../src/core/nodeOperations.ts';
import {UI_BORDER_SELECTOR} from '../src/composer/runtime/appearance/registry.ts';

test('text brightness inherits, overrides and resets without modifying authored color or node brightness',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1),variant=childNode(world,parent.origin,true);
 writePaint(world,'text',[],{color:'#204060',glowColor:'#102030',brightness:.75});
 assert.equal(readPaint(world,'nodeText',variant.origin).brightness,.75);
 writePaint(world,'nodeText',[parent.origin],{brightness:.25});assert.equal(readPaint(world,'nodeText',variant.origin).brightness,.25);
 writePaint(world,'nodeText',[variant.origin],{brightness:1});assert.equal(readPaint(world,'nodeText',variant.origin).brightness,1);
 assert.equal(world.appearance.text.color,'#204060');assert.equal(parent.brightness,undefined);
 resetPaint(world,'nodeText',[variant.origin]);assert.equal(readPaint(world,'nodeText',variant.origin).brightness,.25);
 validateWorld(JSON.parse(JSON.stringify(world)));assert.throws(()=>writePaint(world,'text',[],{brightness:1.1}),/Invalid/);
 const preview=paintPreview(world,'text',[],{brightness:0});assert.equal(preview.appearance.text.brightness,0);assert.equal(world.appearance.text.brightness,.75);
});
test('DOM and world share rendered text brightness while borders ignore text translucency',()=>{
 const paint={color:'#204060',glowColor:'#102030',brightness:.75,glow:.5,translucency:.7};
 const rendered=renderedTextPaint(paint);assert.equal(rendered.color,'#70a0cf');assert.equal(rendered.glowColor,'#5890c7');
 assert.ok(textStyle(paint).color.startsWith('#70a0cf'));assert.equal(textBorderStyle(paint).borderColor,'#70a0cf');
 assert.deepEqual(textBorderStyle(paint),textBorderStyle({...paint,translucency:0}));
 assert.ok(!('opacity' in textBorderStyle(paint)));assert.ok(textBorderStyle(paint).boxShadow.includes(rendered.glowColor));
 assert.equal(renderedTextPaint({...paint,brightness:0}).color,'#000000');
 assert.ok(UI_BORDER_SELECTOR.includes('.spatial-menu'));assert.ok(visualProperties(true).some(p=>p.key==='brightness'));
});

test('text brightness has black/original/white endpoints and does not clip hue above neutral',()=>{
 for(const color of ['#ff4000','#0080ff','#af2040']){assert.equal(renderedTextPaint({color,brightness:0}).color,'#000000');assert.equal(renderedTextPaint({color,brightness:.5}).color,color);assert.equal(renderedTextPaint({color,brightness:1}).color,'#ffffff');}
 assert.equal(renderedTextPaint({color:'#ff4000',brightness:.75}).color,'#ffa080');
 const world=emptyWorld();world.appearance.text.brightness=2;validateWorld(world);assert.equal(world.appearance.text.brightness,1);
});
