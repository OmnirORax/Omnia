import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint,resetPaint,paintPreview} from '../src/core/appearance.ts';
import {childNode} from '../src/core/nodeOperations.ts';
import {textStyle,textBorderStyle} from '../src/ui/appearance.ts';
import {visualProperties} from '../src/properties/visual.ts';
test('text opacity inherits and overrides independently from translucency and body opacity',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1),variant=childNode(world,parent.origin,true);
 assert.equal(readPaint(world,'text').opacity,1);
 writePaint(world,'text',[],{opacity:.4,translucency:.25});
 assert.equal(readPaint(world,'nodeText',variant.origin).opacity,.4);assert.equal(readPaint(world,'nodes',variant.origin).opacity,1);
 writePaint(world,'nodeText',[parent.origin],{opacity:.2});assert.equal(readPaint(world,'nodeText',variant.origin).opacity,.2);
 writePaint(world,'nodeText',[variant.origin],{opacity:.8});assert.equal(readPaint(world,'nodeText',variant.origin).opacity,.8);
 resetPaint(world,'nodeText',[variant.origin]);assert.equal(readPaint(world,'nodeText',variant.origin).opacity,.2);
 validateWorld(JSON.parse(JSON.stringify(world)));assert.throws(()=>writePaint(world,'text',[],{opacity:1.1}),/Invalid/);
 const preview=paintPreview(world,'text',[],{opacity:0});assert.equal(preview.appearance.text.opacity,0);assert.equal(world.appearance.text.opacity,.4);
 assert.ok(visualProperties(true).some(property=>property.key==='opacity'&&property.min===0&&property.max===1));
});
test('text opacity fades ink, halo and linked borders; border paint still excludes text translucency',()=>{
 const paint={color:'#ff4000',glowColor:'#0080ff',glow:1,opacity:0};
 assert.ok(textStyle(paint).color.endsWith('00'));assert.ok(textStyle(paint).textShadow.includes('#0080ff00'));
 assert.ok(textBorderStyle(paint).borderColor.endsWith('00'));assert.ok(textBorderStyle(paint).boxShadow.endsWith('00'));
 const visible={...paint,opacity:.5};assert.ok(textStyle({...visible,translucency:.5}).color.endsWith('40'));
 assert.deepEqual(textBorderStyle(visible),textBorderStyle({...visible,translucency:1}));
});
