import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint,paintPreview,resetPaint} from '../src/core/appearance.ts';
import {childNode} from '../src/core/nodeOperations.ts';
import {textStyle,textBorderStyle} from '../src/ui/appearance.ts';
import {renderedTextPaint,visualProperties} from '../src/properties/visual.ts';

test('brightness is inert when off and changes ink, halo and UI borders once when enabled',()=>{
 const paint={color:'#204060',glowColor:'#102030',glow:1,brightness:.75};
 assert.equal(textStyle(paint).color,'#204060ff');assert.equal(textBorderStyle(paint).borderColor,'#204060');
 const on={...paint,brightnessEnabled:true};assert.equal(textStyle(on).color,'#70a0cfff');assert.equal(textBorderStyle(on).borderColor,'#70a0cf');assert.ok(textStyle(on).textShadow.includes('#5890c7'));
 const world=emptyWorld();writePaint(world,'text',[],on);
 assert.equal(readPaint(world,'text').color,'#204060');assert.equal(textStyle(readPaint(world,'text')).color,'#70a0cfff','read then render cannot apply brightness twice');
 writePaint(world,'text',[],{brightnessEnabled:false});assert.equal(textStyle(readPaint(world,'text')).color,'#204060ff');assert.equal(readPaint(world,'text').brightness,.75);
 for(const [brightness,color] of [[0,'#000000'],[.5,paint.color],[1,'#ffffff']])assert.equal(renderedTextPaint({...paint,brightness,brightnessEnabled:true}).color,color);
});
test('brightness switch and value inherit, preview, reset and save independently of body settings',()=>{
 const world=emptyWorld(),parent=addStructure(world,[0,0,0],1),child=childNode(world,parent.origin,true);
 assert.equal(readPaint(world,'text').brightness,.5);assert.equal(readPaint(world,'text').brightnessEnabled,false);
 writePaint(world,'text',[],{brightness:.75,brightnessEnabled:true});assert.equal(readPaint(world,'nodeText',child.origin).brightnessEnabled,true);
 writePaint(world,'nodeText',[parent.origin],{brightnessEnabled:false});assert.equal(readPaint(world,'nodeText',child.origin).brightnessEnabled,false);
 const preview=paintPreview(world,'nodeText',[child.origin],{brightnessEnabled:true});assert.equal(readPaint(preview,'nodeText',child.origin).brightnessEnabled,true);assert.equal(readPaint(world,'nodeText',child.origin).brightnessEnabled,false);
 writePaint(world,'nodeText',[child.origin],{brightnessEnabled:true});resetPaint(world,'nodeText',[child.origin]);assert.equal(readPaint(world,'nodeText',child.origin).brightnessEnabled,false);
 const restored=validateWorld(JSON.parse(JSON.stringify(world)));assert.equal(readPaint(restored,'text').brightnessEnabled,true);assert.equal(readPaint(restored,'nodes',parent.origin).brightness,1);
 assert.throws(()=>writePaint(world,'text',[],{brightnessEnabled:'yes'}),/Invalid/);assert.throws(()=>writePaint(world,'text',[],{brightness:1.1}),/Invalid/);
 assert.ok(visualProperties(true).some(property=>property.key==='brightnessEnabled'));
});
