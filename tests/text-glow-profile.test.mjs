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
