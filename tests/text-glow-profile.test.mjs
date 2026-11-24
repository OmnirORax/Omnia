import test from 'node:test';
import assert from 'node:assert/strict';
import {textGlowLayers,textGlowShadow} from '../src/properties/textGlow.ts';
import {textStyle} from '../src/ui/appearance.ts';

test('neon strength increases halo coverage independently of spread with a bounded layer count',()=>{
 const low=textGlowLayers(.25,6),normal=textGlowLayers(1,6),high=textGlowLayers(2,6),wide=textGlowLayers(2,10);
 assert.equal(high.length,3);
 for(let i=0;i<high.length;i++){
  assert.equal(low[i].blur,high[i].blur);assert.equal(normal[i].blur,high[i].blur);
  assert.ok(low[i].opacity<normal[i].opacity);assert.ok(normal[i].opacity<=high[i].opacity);
  assert.ok(high[i].opacity<=1);assert.ok(wide[i].blur>high[i].blur);assert.equal(wide[i].opacity,high[i].opacity);
 }
 assert.ok(high.some((layer,i)=>layer.opacity>normal[i].opacity));
 assert.deepEqual(textGlowLayers(0,10),[]);assert.deepEqual(textGlowLayers(2,0),[]);assert.equal(textGlowShadow(0,'red'),'none');
});
test('neon changes halo strength without whitening ink; retired text alpha is ignored',()=>{
 const paint={color:'#ff6600',glowColor:'#00aaff',opacity:.4,translucency:.5};
 const low=textStyle({...paint,glow:.25}),high=textStyle({...paint,glow:2});
 assert.equal(low.color,high.color);assert.equal(high.color,'#ff6600ff');assert.notEqual(low.textShadow,high.textShadow);
 assert.equal(high.textShadow.match(/#00aaffff/g).length,3);
 assert.equal(textStyle({...paint,glow:2,opacity:0}).textShadow.match(/#00aaffff/g).length,3);
});
test('black ink keeps its color but has no blurred black light halo',()=>{
 for(const color of ['#000000','#000000ff','#000','black','rgba(0, 0, 0, 1)','rgb(0 0 0 / 50%)'])assert.equal(textGlowShadow(2,color,6),'none');const paint=textStyle({color:'#000000',glowColor:'#000000',glow:2});assert.equal(paint.color,'#000000ff');assert.equal(paint.textShadow,'none');assert.notEqual(textGlowShadow(2,'#ff0000',6),'none');assert.notEqual(textStyle({color:'#000000',glowColor:'#00ffff',glow:2}).textShadow,'none');
});
