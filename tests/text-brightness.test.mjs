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
 writePaint(world,'text',[],{color:'#204060',glowColor:'#102030',brightness:2});
 assert.equal(readPaint(world,'nodeText',variant.origin).brightness,2);
 writePaint(world,'nodeText',[parent.origin],{brightness:.5});assert.equal(readPaint(world,'nodeText',variant.origin).brightness,.5);
 writePaint(world,'nodeText',[variant.origin],{brightness:3});assert.equal(readPaint(world,'nodeText',variant.origin).brightness,3);
 assert.equal(world.appearance.text.color,'#204060');assert.equal(parent.brightness,undefined);
 resetPaint(world,'nodeText',[variant.origin]);assert.equal(readPaint(world,'nodeText',variant.origin).brightness,.5);
 validateWorld(JSON.parse(JSON.stringify(world)));assert.throws(()=>writePaint(world,'text',[],{brightness:3.1}),/Invalid/);
 const preview=paintPreview(world,'text',[],{brightness:0});assert.equal(preview.appearance.text.brightness,0);assert.equal(world.appearance.text.brightness,2);
});
test('DOM and world share rendered text brightness while borders ignore text translucency',()=>{
 const paint={color:'#204060',glowColor:'#102030',brightness:2,glow:.5,translucency:.7};
 const rendered=renderedTextPaint(paint);assert.equal(rendered.color,'#4080c0');assert.equal(rendered.glowColor,'#204060');
 assert.ok(textStyle(paint).color.startsWith('#4080c0'));assert.equal(textBorderStyle(paint).borderColor,'#4080c0');
 assert.deepEqual(textBorderStyle(paint),textBorderStyle({...paint,translucency:0}));
 assert.ok(!('opacity' in textBorderStyle(paint)));assert.ok(textBorderStyle(paint).boxShadow.includes('#204060'));
 assert.equal(renderedTextPaint({...paint,brightness:0}).color,'#000000');
 assert.ok(UI_BORDER_SELECTOR.includes('.spatial-menu'));assert.ok(visualProperties(true).some(p=>p.key==='brightness'));
});
