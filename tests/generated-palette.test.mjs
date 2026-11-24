import test from 'node:test';import assert from 'node:assert/strict';
import {generatedTextPalette,GENERATED_PALETTE_SIZE} from '../src/properties/generatedTextPalette.ts';
const palette={mode:'text',pattern:'generated',seed:42,colors:['#ff0000','#000000'],weights:[.75,.25],ink:'color'};
test('generated fields are stable, bounded, genuinely spatial and keep the matched motif',()=>{
 const a=generatedTextPalette(palette),b=generatedTextPalette({...palette});assert.equal(a,b);assert.equal(a.glow.length,GENERATED_PALETTE_SIZE**2*4);assert.notDeepEqual(a.glow,generatedTextPalette({...palette,seed:43}).glow);assert.notDeepEqual(a.glow.slice(0,64*4),a.glow.slice(64*4,128*4));for(let i=0;i<a.glow.length;i+=4){assert.equal(a.glow[i+1],0);assert.equal(a.glow[i+2],0);assert.equal(a.glow[i+3],255);}assert.deepEqual(a.ink,a.glow);
 const pale=generatedTextPalette({...palette,ink:'pale'});assert.deepEqual(pale.glow,a.glow);for(let i=0;i<a.glow.length;i+=4)for(let c=0;c<3;c++)assert.ok(Math.abs(pale.ink[i+c]-(191.25+a.glow[i+c]*.25))<=1);
});
test('document pattern encoding is lazy and cached across identical paint refreshes',async()=>{
 const {generatedTextPaletteCSS}=await import('../src/properties/generatedTextPalette.ts'),old=globalThis.document;let encodes=0,uploads=0;globalThis.document={createElement:()=>({getContext:()=>({createImageData:()=>({data:new Uint8ClampedArray(64*64*4)}),putImageData:()=>uploads++}),toDataURL:()=>{encodes++;return 'data:image/png;base64,AA==';}})};
 try{const p={...palette,seed:95723};assert.match(generatedTextPaletteCSS(p),/^url/);generatedTextPaletteCSS({...p});assert.equal(encodes,1);assert.equal(uploads,1);}finally{globalThis.document=old;}
});
