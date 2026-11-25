import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDocumentWallpaper,useDocumentWallpaper,acquireTextWallpaper} from '../src/scene/documentWallpaper.ts';
import {createDocumentPixelPainter} from '../src/text/imagePixelPresentation.ts';
import {createWallpaperSampling} from '../src/scene/wallpaperSample.ts';

test('documents and world labels share one static capture; only authored changes rebuild it',{timeout:3000},async()=>{
 const previousDocument=globalThis.document,previousImage=globalThis.Image;
 const style=new Map(),attributes=new Set(),host={toggleAttribute(name,on){if(on)attributes.add(name);else attributes.delete(name);},style:{
  setProperty(name,value){style.set(name,value);if(name==='--document-image-frame')publish();},removeProperty(name){style.delete(name);},
 }};
 let target=null,captures=0,draws=0,captured,ink,paints=0,publish;
 const palette={mode:'text',distribution:'pixels',ink:'color',saturation:1,colors:['#12347b']};
 const published=()=>new Promise(resolve=>{publish=resolve;});
 globalThis.document={documentElement:{style:{setProperty(name,value){style.set(name,value);},removeProperty(name){style.delete(name);}}}};
 globalThis.Image=class{async decode(){assert.match(this.src,/^blob:/);}};
 const renderer={
  getRenderTarget:()=>target,setRenderTarget(next){target=next;},
  render(mesh){
   draws++;captured=target;ink=Math.round(123*mesh.material.uniforms.imagePixelSaturation.value);
   assert.match(mesh.material.fragmentShader,/mapImagePixel\(displayColour\(sampleWallpaper\(pixelUV\)\)\)/);
   assert.equal(mesh.material.uniforms.imagePixelScale.value,1);
   for(const [name,value] of Object.entries({time:0,bounce:1,light:0,waves:0,feedbackStrength:0}))assert.equal(mesh.material.uniforms[name].value,value);
  },
  async readRenderTargetPixelsAsync(read,_x,_y,w,h,bytes){
   captures++;assert.equal(target,null);assert.equal(read,captured);assert.equal(w,1920);assert.equal(h,1080);bytes.set([123,52,ink,255]);
  },
 };
 const {uniforms}=createWallpaperSampling(),image=new T.Texture();uniforms.image.value=image;
 const wallpaper=createDocumentWallpaper(renderer,uniforms,()=>paints++);
 let world;
 try{
  wallpaper.resize(3840,2160);assert.equal(captures,0);
  const first=published();world=acquireTextWallpaper(palette);useDocumentWallpaper(host,palette);await first;
  assert.equal(captures,1);assert.equal(draws,1);assert.equal(world.texture.value,captured.texture);assert.equal(paints,1);
  assert.equal(style.get('--scene-text-frame-size'),'3840px 2160px');assert.ok(attributes.has('data-scene-text-frame'));
  const bitmap=async()=>new DataView(await (await fetch(JSON.parse(style.get('--document-image-frame').slice(4,-1)))).arrayBuffer());
  const still=await bitmap();assert.equal(still.getInt32(18,true),1920);assert.equal(still.getUint8(54),123);
  // Time, audio bounce, wave animation, feedback and repeated same-palette binding do not render/capture again.
  uniforms.bounce.value=1.4;uniforms.time.value=20;uniforms.light.value=.9;uniforms.waves.value=1;uniforms.feedbackStrength.value=1;
  useDocumentWallpaper(host,palette);await new Promise(resolve=>setTimeout(resolve,220));
  assert.equal(captures,1);assert.equal(draws,1);assert.equal(world.texture.value,captured.texture);
  world.release();world=undefined;
  const next=published();useDocumentWallpaper(host,{...palette,saturation:.5});await next;
  assert.equal(captures,2);assert.equal((await bitmap()).getUint8(54),62,'RGBA output is converted to BMP BGRA');
  const correction=published();wallpaper.refresh();await correction;assert.equal(captures,3);
  useDocumentWallpaper(host);assert.equal(style.size,0);assert.equal(attributes.size,0);
  // World-only users retain the same GPU image without any CPU readback or BMP.
  world=acquireTextWallpaper(palette);await new Promise(resolve=>setTimeout(resolve,30));
  assert.equal(draws,4);assert.equal(captures,3);assert.equal(world.texture.value,captured.texture);
  const reuse=published();useDocumentWallpaper(host,palette);await reuse;
  assert.equal(draws,4,'opening a document must reuse the already rendered world frame');assert.equal(captures,4);
  const worldFrame=world.texture;
  for(const progression of ['ink-serpentine','start-end']){
   const uri=style.get('--document-image-frame');
   useDocumentWallpaper(host,{...palette,progression,distributionAxis:'vertical'});
   assert.equal(style.get('--document-image-frame'),uri);
   const handle=acquireTextWallpaper({...palette,progression,distributionAxis:'vertical'});
   assert.equal(handle.texture,worldFrame);
   handle.release();
  }
  assert.equal(captures,4);

 }finally{
  world?.release();useDocumentWallpaper(host);wallpaper.dispose();image.dispose();globalThis.document=previousDocument;globalThis.Image=previousImage;
 }
});
test('document pixel offsets follow window motion and scrolling without measuring the text again',()=>{
 const previousWindow=globalThis.window,previousObserver=globalThis.MutationObserver;
 const styles=()=>({values:new Map(),setProperty(k,v){this.values.set(k,v);},removeProperty(k){this.values.delete(k);}});
 const standardEvents=()=>Object.assign(new EventTarget(),{style:styles()});
 const attrs=new Set(),element={style:styles(),setAttribute(name){attrs.add(name);},removeAttribute(name){attrs.delete(name);}};
 const scrollDOM=standardEvents(),panel={},contentDOM=standardEvents();
 let position={left:100,top:200},moved,reads=0,disconnected=false;
 contentDOM.getBoundingClientRect=()=>position;
 contentDOM.querySelectorAll=()=>[element];
 element.getClientRects=()=>{reads++;return [{left:112,top:264}];};
 globalThis.window=standardEvents();
 globalThis.MutationObserver=class{
  constructor(callback){moved=callback;}
  observe(element){assert.equal(element,panel);}
  disconnect(){disconnected=true;}
 };
 const view={dom:{closest:()=>panel},contentDOM,scrollDOM,requestMeasure({read,write}){write(read(this),this);}};
 const painter=createDocumentPixelPainter();
 const screen=(axis)=>parseFloat(contentDOM.style.values.get(`--document-image-${axis}`))+parseFloat(element.style.values.get(`--image-pixel-${axis}`));
 try{
  painter.watch(view);
  painter.render(view,painter.read(view));
  assert.equal(screen('x'),-112);assert.equal(screen('y'),-264);
  position={left:300,top:250};moved();
  assert.equal(screen('x'),-312);assert.equal(screen('y'),-314);
  position={left:300,top:180};scrollDOM.dispatchEvent(new Event('scroll'));
  assert.equal(screen('y'),-244);
  assert.equal(reads,1);
  painter.clear();
  assert.equal(attrs.size,0);assert.equal(contentDOM.style.values.size,0);assert.equal(element.style.values.size,0);assert.equal(disconnected,true);
 }finally{painter.clear();globalThis.window=previousWindow;globalThis.MutationObserver=previousObserver;}
});

test('Image pixels scale changes the shared centered crop while reusing the color lookup',{timeout:3000},async()=>{
 const previousDocument=globalThis.document;
 globalThis.document={documentElement:{style:{removeProperty(){}}}};
 const {uniforms}=createWallpaperSampling();uniforms.image.value=new T.Texture();
 const palette={mode:'text',distribution:'pixels',ink:'color',colors:['#ff0000','#0000ff']};
 const paints=[],lookups=[],modifiers=[];let current;
 const renderer={getRenderTarget:()=>current,setRenderTarget(target){current=target;},render(mesh){
  const u=mesh.material.uniforms;
  const expression=mesh.material.fragmentShader.match(/vec2 pixelUV=([^;]+);/)[1];
  const map=Function('screenUV','imagePixelScale',`return ${expression};`);
  paints.push({scale:u.imagePixelScale.value,uv:[0,.25,.5,.75,1].map(v=>map(v,u.imagePixelScale.value))});
  lookups.push(u.imagePixelInk.value);modifiers.push(u.imagePixelInverse.value);assert.equal(u.imagePixelAxis,undefined);
 }};
 let ready;const drawn=()=>new Promise(resolve=>{ready=resolve;});
 const wallpaper=createDocumentWallpaper(renderer,uniforms,()=>ready());wallpaper.resize(640,480);
 let a,b,same,vertical,directionOnly;
 try{
  const first=drawn();a=acquireTextWallpaper(palette);await first;
  assert.deepEqual(paints[0],{scale:1,uv:[0,.25,.5,.75,1]});
  const next=drawn();b=acquireTextWallpaper({...palette,scale:2});same=acquireTextWallpaper({...palette,scale:2});await next;
  assert.notEqual(a.key,b.key);assert.equal(b.texture,same.texture);assert.notEqual(a.texture.value,b.texture.value);
  assert.deepEqual(paints[1],{scale:2,uv:[.25,.375,.5,.625,.75]});
  assert.equal(lookups[0],lookups[1],'scaling must reuse the unchanged color transform');
  directionOnly=acquireTextWallpaper({...palette,scale:2,distributionAxis:'vertical'});
  assert.equal(directionOnly.key,b.key,'distribution direction must not alter the image frame');
  assert.equal(directionOnly.texture,b.texture,'documents and nodes share the same untransposed image');
  assert.equal(paints.length,2,'direction alone does not rebuild the image');
  const modified=drawn();vertical=acquireTextWallpaper({...palette,scale:.25,distributionAxis:'vertical',inverseDistribution:true});await modified;
  assert.notEqual(b.key,vertical.key);assert.equal(modifiers.at(-1),1);assert.equal(paints.at(-1).scale,.25);
  assert.equal(lookups[0],lookups.at(-1),'inverse and scale share the same color lookup');
 }finally{directionOnly?.release();vertical?.release();same?.release();b?.release();a?.release();wallpaper.dispose();uniforms.image.value.dispose();globalThis.document=previousDocument;}
});
