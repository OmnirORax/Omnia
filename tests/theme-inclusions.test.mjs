import test from 'node:test';import assert from 'node:assert/strict';
import {setThemeInclusions,themeSettings,varyTheme} from '../src/scene/themeControls.ts';
import {createAutoColors} from '../src/scene/autoColors.ts';
import {createStore} from '../src/core/store.ts';
import {readPaint} from '../src/core/appearance.ts';
import {validateWorld} from '../src/core/model.ts';
import {textPalettePair} from '../src/properties/textPalette.ts';
import {generatedTextPalette} from '../src/properties/generatedTextPalette.ts';
import {colorHue,paletteRGB} from '../src/scene/palette.ts';
const matches=color=>{const rgb=typeof color==='string'?paletteRGB(color):color,span=Math.max(...rgb)-Math.min(...rgb);if(span<2)return true;const h=colorHue(rgb);return Math.min(h,360-h)<3||Math.abs(h-120)<3;};
function fixture(){const store=createStore({getItem:()=>null,setItem(){}});let samples=0;const auto=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async()=>{samples++;return new Uint8ClampedArray([0,0,255,255,20,20,20,255]);},error:error=>{throw error;}});store.subscribe(auto.update);return {store,auto,samples:()=>samples};}
test('included hue families constrain shared macro, micro and generated output, including transitions',async()=>{
 const {store,auto,samples}=fixture();store.change(world=>setThemeInclusions(world,undefined,['#FF0000','#00ff00','#ff0000']));await auto.settle();assert.deepEqual(themeSettings(store.world).included,['#ff0000','#00ff00']);
 for(const kind of ['macro','micro','generate'])for(let i=0;i<12;i++){store.change(world=>varyTheme(world,undefined,kind));await auto.settle();const p=readPaint(store.world,'text').palette;assert.deepEqual(p.included,['#ff0000','#00ff00']);assert.ok(p.colors.every(matches));for(let x=0;x<=100;x++)assert.ok(matches(textPalettePair(p,x/100).glowColor));if(kind==='generate'){const data=generatedTextPalette(p).glow;for(let at=0;at<data.length;at+=4)assert.ok(matches([data[at],data[at+1],data[at+2]]));}}
 assert.equal(samples(),1);validateWorld(JSON.parse(JSON.stringify(store.world)));auto.dispose();
});
test('removing inclusions resumes the source palette and undo restores the stored selection',async()=>{
 const f=fixture();f.store.change(w=>setThemeInclusions(w,undefined,['#ff0000','#00ff00']));await f.auto.settle();f.store.change(w=>setThemeInclusions(w,undefined,['#ff0000']));await f.auto.settle();assert.deepEqual(themeSettings(f.store.world).included,['#ff0000']);f.store.undo();f.store.undo();await f.auto.settle();assert.deepEqual(themeSettings(f.store.world).included,['#ff0000','#00ff00']);f.store.change(w=>setThemeInclusions(w,undefined,[]));await f.auto.settle();assert.equal(themeSettings(f.store.world).included,undefined);assert.ok(readPaint(f.store.world,'text').palette.colors.some(c=>{const rgb=paletteRGB(c);return rgb[2]>rgb[0]&&rgb[2]>rgb[1];}));f.auto.dispose();
});
test('explicit inclusions also work with no assigned image and validate their storage bounds',async()=>{
 const f=fixture();f.store.change(w=>{w.scene.image=null;setThemeInclusions(w,undefined,['#ff0000']);});await f.auto.settle();assert.equal(f.samples(),0);assert.ok(readPaint(f.store.world,'text').palette.colors.every(matches));assert.throws(()=>f.store.change(w=>setThemeInclusions(w,undefined,['red'])));f.auto.dispose();
});
