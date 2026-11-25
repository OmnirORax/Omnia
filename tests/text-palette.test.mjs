import test from 'node:test';import assert from 'node:assert/strict';
import {textPalettePair,textPaletteCSS,textPaletteStops,PALETTE_STOP_LIMIT,validTextPalette} from '../src/properties/textPalette.ts';
import {paletteRGB} from '../src/scene/palette.ts';
import {emptyWorld,addStructure,validateWorld} from '../src/core/model.ts';
import {readPaint,writePaint} from '../src/core/appearance.ts';
const palette={mode:'text',colors:['#0080ff','#ff8000'],weights:[.9,.1]};
test('blue/orange gradients retain brightness and linked ink without inventing green hues',()=>{
 for(let i=0;i<=1000;i++){const pair=textPalettePair(palette,i/1000),ink=paletteRGB(pair.color),glow=paletteRGB(pair.glowColor);assert.equal(Math.max(...ink),255);assert.equal(Math.max(...glow),255);assert.ok(!(glow[1]>glow[0]+1&&glow[1]>glow[2]+1));for(let c=0;c<3;c++)assert.ok(Math.abs(ink[c]-(255*.75+glow[c]*.25))<=1);}
 assert.equal(textPalettePair(palette,.8).glowColor,'#0080ff');assert.equal(textPalettePair(palette,1).glowColor,'#ff8000');assert.match(textPaletteCSS(palette),/in srgb/);
});
test('band widths follow measured weights and every layout uses a bounded cached stop table',()=>{
 const p={...palette,pattern:'bands'},stops=textPaletteStops(p);assert.equal(stops[1].at,.9);assert.equal(stops[2].at,.9);assert.equal(textPalettePair(p,.89).glowColor,'#0080ff');assert.equal(textPalettePair(p,.91).glowColor,'#ff8000');
 for(const pattern of ['smooth','bands','generated']){const q={mode:'text',colors:Array(8).fill('#ff0000'),pattern};assert.ok(textPaletteStops(q).length<=PALETTE_STOP_LIMIT);assert.equal(textPaletteStops(q),textPaletteStops(q));}
 assert.match(textPaletteCSS({...palette,layout:'radial',spread:'repeat'}),/^repeating-radial-gradient/);assert.match(textPaletteCSS({...palette,layout:'vertical'}),/180deg/);assert.match(textPaletteCSS({...palette,layout:'diagonal'}),/135deg/);
});
test('manual node colors override inherited palette after save/load',()=>{
 const world=emptyWorld(),node=addStructure(world,[0,0,0],1);writePaint(world,'text',[],{color:'#ffbfbf',glowColor:'#ff0000',palette});writePaint(world,'nodeText',[node.origin],{color:'#112233'});const saved=JSON.parse(JSON.stringify(world));validateWorld(saved);assert.equal(readPaint(saved,'nodeText',node.origin).palette,undefined);assert.equal(readPaint(saved,'nodeText',node.origin).color,'#112233');
});
test('palette validation bounds settings, weights and colors; old across-node saves become within-text',async()=>{
 const {validatePaint}=await import('../src/properties/visual.ts');for(const p of [{...palette,motifOverrides:{h0:'yes'}},{...palette,balance:0},{...palette,softness:1},{...palette,saturation:2},{...palette,saturation:NaN},{...palette,darkSupport:'yes'},{...palette,layout:'bad'},{...palette,pattern:'bad'},{...palette,spread:'bad'},{...palette,weights:[1]},{...palette,weights:[1,0]},{...palette,seed:NaN},{mode:'text',colors:[]},{mode:'text',colors:Array(257).fill('#ff0000')},{mode:'text',colors:['red']}])assert.throws(()=>validatePaint({palette:p},true));assert.throws(()=>validatePaint({palette},false));const world=emptyWorld(),node=addStructure(world,[0,0,0],1);world.appearance={text:{palette:{...palette,mode:'nodes'}},imageColors:{default:{enabled:true,manual:[],mode:'nodes'}}};node.textAppearance={palette:{...palette,mode:'nodes'}};validateWorld(world);assert.equal(world.appearance.text.palette.mode,'text');assert.equal(node.textAppearance.palette.mode,'text');assert.equal(world.appearance.imageColors.default.mode,'text');
});

test('pale amount changes the shared ink mix and leaves colored ink unchanged',async()=>{
 const {paletteInk,validPaletteSettings}=await import('../src/properties/textPalette.ts');
 const p={mode:'text',ink:'pale',colors:['#ff0000']};
 assert.equal(paletteInk(p),.25);
 assert.equal(paletteInk({...p,paleAmount:.5}),.5);
 assert.equal(paletteInk({...p,paleAmount:0}),1);
 assert.equal(textPalettePair({...p,paleAmount:.5},0).color,'#ff8080');
 assert.equal(paletteInk({...p,ink:'color',paleAmount:.99}),1);
 for(const paleAmount of [0,.75,.99])assert.ok(validPaletteSettings({paleAmount}));
 for(const paleAmount of [-.1,1,NaN])assert.ok(!validPaletteSettings({paleAmount}));
});

test('Image pixels permits fractional scale and the exposed maximum pale amount survives validation',()=>{
 const p={mode:'text',colors:['#ff0000'],distribution:'pixels',scale:.05,paleAmount:.99,strength:.01};
 assert.ok(validTextPalette(p));
 assert.ok(!validTextPalette({...p,scale:.049}));
 assert.ok(validTextPalette({...p,distribution:'balanced'}),'switching distribution retains the fractional scale');
});
