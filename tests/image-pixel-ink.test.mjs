import test from 'node:test';
import assert from 'node:assert/strict';
import {acquireImagePixelInk,imagePixelInkGLSL} from '../src/properties/imagePixelInk.ts';
import {paletteColorTraits,colorHue} from '../src/scene/palette.ts';

// Evaluate the shader's scalar transfer expressions against its real lookup texture.
// The controlled GPU probe separately exercises sampling, glyph clipping and compositing.
const expression=(pattern,values)=>{
 const source=imagePixelInkGLSL.match(pattern)?.[1];assert.ok(source);
 return Function(...Object.keys(values),'max','clamp',`return ${source};`)(...Object.values(values),Math.max,(v,a,b)=>Math.max(a,Math.min(b,v)));
};
function shade(ink,rgb){
 const {width,data}=ink.texture.image,traits=paletteColorTraits(rgb.map(c=>c*255));
 const high=Math.max(...rgb),low=Math.min(...rgb),delta=high-low;
 const slot=high>0&&delta>=high*.18?Math.floor(traits.hue):360+Math.floor(high*255+.5);
 const texel=row=>Array.from(data.slice((row*width+slot)*4,(row*width+slot)*4+4),c=>c/255);
 const target=texel(0),source=texel(1),sourceHigh=Math.max(...source.slice(0,3)),sourceLow=Math.min(...source.slice(0,3)),sourceDelta=sourceHigh-sourceLow;
 const inkHigh=Math.max(...target.slice(0,3)),inkLow=Math.min(...target.slice(0,3));
 let saturation=expression(/float saturation=([^;]+);/,{inkHigh,inkLow});
 if(saturation>0&&ink.saturation>=0)saturation=ink.saturation;
 const hue=source[3]>.75?target.slice(0,3).map(v=>(v-inkLow)/Math.max(inkHigh-inkLow,.00001)):source[3]>.25?source.slice(0,3).map(v=>(v-sourceLow)/Math.max(sourceDelta,.00001)):rgb.map(v=>(v-low)/Math.max(delta,.00001));
 return hue.map(v=>inkHigh*(1-saturation+v*saturation));
}
const palette={mode:'text',distribution:'pixels',ink:'color',saturation:1,pixelSources:['#10172b','#9c223f','#0b448b'],colors:['#5f87ff','#ff0044','#0080ff']};
test('dark live samples retain resolved ink brightness and continuous hue detail',()=>{
 const ink=acquireImagePixelInk(palette);
 try{
  const samples=[[11,18,45],[12,22,52],[71,15,28],[141,35,55],[9,65,139]].map(rgb=>rgb.map(c=>c/255));
  const output=samples.map(rgb=>shade(ink,rgb));
  for(const [index,rgb] of output.entries()){
   assert.ok(Math.max(...rgb)>.8,'raw wallpaper darkness must not bypass resolved ink');
   assert.ok(Math.abs(colorHue(rgb)-colorHue(samples[index]))<.0001,'enabled hues must not snap to a representative swatch');
  }
  assert.notDeepEqual(output[0],output[1]);
  assert.equal(Math.max(...output[2]),Math.max(...output[3]),'the red swatch supplies brightness across both shades');
 }finally{ink.release();}
});
test('a dark colored pixel does not become the black neutral swatch',()=>{
 const ink=acquireImagePixelInk({...palette,pixelSources:[...palette.pixelSources,'#000000'],colors:[...palette.colors,'#000000']});
 try{
  const dark=[3,6,15].map(c=>c/255),output=shade(ink,dark);
  assert.ok(Math.max(...output)>.8);
  assert.ok(Math.abs(colorHue(output)-colorHue(dark))<.0001);
  assert.deepEqual(shade(ink,[0,0,0]),[0,0,0]);
 }finally{ink.release();}
});
test('excluded families inherit an enabled hue and swatch brightness',()=>{
 const ink=acquireImagePixelInk({...palette,pixelSources:['#9c223f'],colors:['#ff0044']});
 try{
  const dark=shade(ink,[.05,.1,.3]),light=shade(ink,[.1,.2,.6]);
  assert.ok(Math.abs(colorHue(dark)-colorHue([156,34,63]))<.001);
  assert.ok(Math.abs(colorHue(light)-colorHue(dark))<.001);
  assert.deepEqual(light,dark);
 }finally{ink.release();}
});
test('resolved saturation and neutral membership do not reintroduce excluded chroma',()=>{
 for(const p of [
  {...palette,saturation:0,colors:['#ffffff','#ffffff','#ffffff']},
  {...palette,pixelSources:['#888888'],colors:['#ffffff']},
 ]){
  const ink=acquireImagePixelInk(p);
  try{
   for(const sample of [[.1,.2,.5],[.6,.1,.2],[0,0,0],[1,1,1]]){
    const rgb=shade(ink,sample);assert.equal(rgb[0],rgb[1]);assert.equal(rgb[1],rgb[2]);
    assert.ok(rgb.every(Number.isFinite));
   }
  }finally{ink.release();}
 }
});
test('resolved color edits invalidate ink; saturation-only edits reuse the source table and release safely',()=>{
 const a=acquireImagePixelInk(palette),b=acquireImagePixelInk({...palette,saturation:.5});
 const c=acquireImagePixelInk({...palette,colors:['#7faadd','#ff8888','#22aadd']});
 let disposed=0;a.texture.addEventListener('dispose',()=>disposed++);
 assert.equal(a.texture,b.texture);assert.notEqual(a.key,b.key);
 assert.notEqual(a.texture,c.texture);assert.notEqual(a.key,c.key);
 assert.notDeepEqual(shade(a,[.1,.2,.5]),shade(b,[.1,.2,.5]));
 assert.notDeepEqual(shade(a,[.1,.2,.5]),shade(c,[.1,.2,.5]));
 a.release();assert.equal(disposed,0);b.release();assert.equal(disposed,1);c.release();
});

test('occupation inverse reverses color ownership while keeping swatch brightness',()=>{
 const p={...palette,pixelSources:['#cc2211','#1144cc'],colors:['#ff2000','#0044ff'],weights:[.8,.2]};
 const regular=acquireImagePixelInk(p),inverse=acquireImagePixelInk({...p,inverseOccupation:true});
 try{
  assert.notEqual(regular.texture,inverse.texture);
  const red=[.8,.14,.07],blue=[.07,.27,.8];
  assert.ok(shade(regular,red)[0]>shade(regular,red)[2]);
  assert.ok(shade(inverse,red)[2]>shade(inverse,red)[0]);
  assert.ok(shade(inverse,blue)[0]>shade(inverse,blue)[2]);
  assert.deepEqual(shade(inverse,red),shade(inverse,[.65,.12,.06]));
 }finally{regular.release();inverse.release();}
});

test('dark wallpaper detail keeps bright ink and honors explicit saturation',()=>{
 const p={...palette,pixelSources:['#10cc55'],colors:['#66ff98']};
 const dark=[.02,.1,.04],light=[.08,.8,.25];
 for(const saturation of [0,.45,1]){
  const ink=acquireImagePixelInk({...p,saturation});
  try{
   const a=shade(ink,dark),b=shade(ink,light),peak=Math.max(...a);
   assert.equal(peak,1,'dark wallpaper cannot dim a bright palette anchor');
   assert.equal(peak,Math.max(...b));
   assert.ok(Math.abs(1-Math.min(...a)/peak-saturation)<1e-6);
  }finally{ink.release();}
 }
});
