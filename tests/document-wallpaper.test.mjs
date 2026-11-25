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
 const palette={mode:'text',distribution:'pixels',ink:'color',colors:['#12347b']};
 const published=()=>new Promise(resolve=>{publish=resolve;});
 globalThis.document={documentElement:{style:{setProperty(name,value){style.set(name,value);},removeProperty(name){style.delete(name);}}}};
 globalThis.Image=class{async decode(){assert.match(this.src,/^blob:/);}};
 const renderer={
  getRenderTarget:()=>target,setRenderTarget(next){target=next;},
  render(mesh){
   draws++;captured=target;ink=Math.round(123*mesh.material.uniforms.imagePixelSaturation.value);
   assert.match(mesh.material.fragmentShader,/mapImagePixel\(displayColour\(sampleWallpaper\(screenUV\)\)\)/);
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
