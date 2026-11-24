import test from 'node:test';import assert from 'node:assert/strict';
import {textPalettePair,textPaletteCSS,paletteProjection} from '../src/properties/textPalette.ts';
import {paletteRGB} from '../src/scene/palette.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint,invalidateTextPaletteProjection} from '../src/core/appearance.ts';
const palette={mode:'nodes',colors:['#ff0000','#0000ff','#00ff00']};
test('every interpolated hue stays full brightness with quarter-saturation ink and fully saturated glow',()=>{
 for(let i=0;i<=100;i++){const pair=textPalettePair(palette,i/100),ink=paletteRGB(pair.color),glow=paletteRGB(pair.glowColor);assert.equal(Math.max(...ink),255);assert.equal(Math.max(...glow),255);assert.equal(Math.min(...glow),0);for(let c=0;c<3;c++)assert.ok(Math.abs(ink[c]-(255*.75+glow[c]*.25))<=1);}
 assert.deepEqual(textPalettePair(palette,0),{color:'#ffbfbf',glowColor:'#ff0000'});assert.equal(textPalettePair(palette,.5).glowColor,'#0000ff');assert.equal(textPalettePair(palette,1).glowColor,'#00ff00');assert.match(textPaletteCSS(palette),/in hsl shorter hue/);
});
test('across-node paint samples the widest spatial axis and leaves authored values unchanged',()=>{
 const world=emptyWorld(),a=addStructure(world,[0,0,0],1),b=addStructure(world,[0,5,0],2),c=addStructure(world,[0,10,0],3);writePaint(world,'text',[],{color:'#ffbfbf',glowColor:'#ff0000',palette});const before=JSON.stringify(world);
 assert.equal(readPaint(world,'nodeText',a.origin).glowColor,'#ff0000');assert.equal(readPaint(world,'nodeText',b.origin).glowColor,'#0000ff');assert.equal(readPaint(world,'nodeText',c.origin).glowColor,'#00ff00');assert.equal(JSON.stringify(world),before);validateWorld(JSON.parse(before));
 c.position[1]=20;invalidateTextPaletteProjection(world);assert.notEqual(readPaint(world,'nodeText',b.origin).glowColor,'#0000ff');
 const p=paletteProjection([]);assert.equal(p([0,0,0]),0);
});
test('manual node colors override inherited palette after save/load while within-text mode preserves the palette',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);writePaint(world,'text',[],{color:'#ffbfbf',glowColor:'#ff0000',palette:{...palette,mode:'text'}});assert.equal(readPaint(world,'nodeText',node.origin).palette.mode,'text');writePaint(world,'nodeText',[node.origin],{color:'#112233'});const saved=JSON.parse(JSON.stringify(world));validateWorld(saved);assert.equal(readPaint(saved,'nodeText',node.origin).palette,undefined);assert.equal(readPaint(saved,'nodeText',node.origin).color,'#112233');
});
test('palette schema bounds mode, stop count and colors',async()=>{const {validatePaint}=await import('../src/properties/visual.ts');for(const p of [{mode:'bad',colors:['#ff0000']},{mode:'text',colors:[]},{mode:'nodes',colors:Array(9).fill('#ff0000')},{mode:'text',colors:['red']}])assert.throws(()=>validatePaint({palette:p},true));assert.throws(()=>validatePaint({palette},false));});
