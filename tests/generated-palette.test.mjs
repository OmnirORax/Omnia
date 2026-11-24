import test from 'node:test';import assert from 'node:assert/strict';
import {generatedTextPalette,GENERATED_PALETTE_SIZE} from '../src/properties/generatedTextPalette.ts';
const palette={mode:'text',pattern:'generated',seed:42,colors:['#ff0000','#000000'],weights:[.75,.25],ink:'color'};
test('generated fields are stable, bounded, genuinely spatial and keep the matched motif',()=>{
 const a=generatedTextPalette(palette),b=generatedTextPalette({...palette});assert.equal(a,b);assert.equal(a.glow.length,GENERATED_PALETTE_SIZE**2*4);assert.notDeepEqual(a.glow,generatedTextPalette({...palette,seed:43}).glow);assert.ok(new Set(Array.from({length:64*64},(_,i)=>a.glow[i*4])).size>1);for(let i=0;i<a.glow.length;i+=4){assert.equal(a.glow[i+1],0);assert.equal(a.glow[i+2],0);assert.equal(a.glow[i+3],255);}assert.deepEqual(a.ink,a.glow);
 const pale=generatedTextPalette({...palette,ink:'pale'});assert.deepEqual(pale.glow,a.glow);for(let i=0;i<a.glow.length;i+=4)for(let c=0;c<3;c++)assert.ok(Math.abs(pale.ink[i+c]-(191.25+a.glow[i+c]*.25))<=1);
});
test('document pattern encoding is lazy and cached across identical paint refreshes',async()=>{
 const {generatedTextPaletteCSS}=await import('../src/properties/generatedTextPalette.ts'),old=globalThis.document;let encodes=0,uploads=0;globalThis.document={createElement:()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(64*64*4)}),putImageData:()=>uploads++}),toDataURL:()=>{encodes++;return 'data:image/png;base64,AA==';}})};
 try{const p={...palette,seed:95723};assert.match(generatedTextPaletteCSS(p),/^url/);generatedTextPaletteCSS({...p});assert.equal(encodes,1);assert.equal(uploads,1);}finally{globalThis.document=old;}
});
test('one hundred generations cover the palette instead of collapsing to white or horizontal glyph stripes',()=>{
 for(let seed=0;seed<100;seed++){const {ink}=generatedTextPalette({mode:'text',pattern:'generated',ink:'color',colors:['#ff0000','#00ff00','#0000ff'],weights:[.6,.25,.15],seed});let pure=0,horizontal=0,vertical=0;const counts=[0,0,0];for(let i=0;i<4096;i++){const at=i*4,rgb=Array.from(ink.slice(at,at+3)),max=Math.max(...rgb);assert.ok(Math.min(...rgb)<5);if(max>250&&rgb.filter(c=>c<5).length===2)pure++;counts[rgb.indexOf(max)]++;if(i%64)for(let c=0;c<3;c++)horizontal+=Math.abs(ink[at+c]-ink[at-4+c]);if(i>=64)for(let c=0;c<3;c++)vertical+=Math.abs(ink[at+c]-ink[at-256+c]);}assert.ok(pure/4096>.75);assert.ok(vertical/Math.max(horizontal,1)<.5);for(let i=0;i<3;i++)assert.ok(Math.abs(counts[i]/4096-[.6,.25,.15][i])<.06);}
});
