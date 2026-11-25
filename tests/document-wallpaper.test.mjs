import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDocumentWallpaper,useDocumentWallpaper} from '../src/scene/documentWallpaper.ts';
import {createDocumentPixelPainter} from '../src/text/imagePixelPresentation.ts';
import {createWallpaperSampling} from '../src/scene/wallpaperSample.ts';

test('open image-pixel documents get display RGB at viewport coordinates from a bounded capture',{timeout:3000},async()=>{
 const previousDocument=globalThis.document,previousImage=globalThis.Image;
 const style=new Map(),attributes=new Set(),host={toggleAttribute(name,on){if(on)attributes.add(name);else attributes.delete(name);},style:{
  setProperty(name,value){style.set(name,value);if(name==='--document-image-frame')publish();},
  removeProperty(name){style.delete(name);},
 }};
 let target=null,captures=0,captured,ink;
 const palette={mode:'text',distribution:'pixels',ink:'color',colors:['#12347b']};
 let publish;
 const published=()=>new Promise(resolve=>{publish=resolve;});
 globalThis.document={
  documentElement:{toggleAttribute(name,on){if(on)attributes.add(name);else attributes.delete(name);},style:{
   setProperty(name,value){style.set(name,value);},
   removeProperty(name){style.delete(name);},
  }},
 };
 globalThis.Image=class{async decode(){assert.match(this.src,/^blob:/);}};
 const renderer={
  getRenderTarget:()=>target,
  setRenderTarget(next){target=next;},
  render(mesh){
   captured=target;ink=Math.round(123*mesh.material.uniforms.imagePixelSaturation.value);
   assert.match(mesh.material.fragmentShader,/mapImagePixel\(displayColour\(sampleWallpaper\(screenUV\)\)\)/);
  },
  async readRenderTargetPixelsAsync(read,_x,_y,w,h,bytes){
   captures++;assert.equal(target,null);assert.equal(read,captured);assert.equal(w,captures===2?960:1920);assert.equal(h,captures===2?540:1080);bytes[0]=ink;
  },
 };
 const {uniforms}=createWallpaperSampling(),image=new T.Texture();
 uniforms.image.value=image;
 const wallpaper=createDocumentWallpaper(renderer,uniforms);
 try{
  wallpaper.resize(3840,2160);assert.equal(captures,0);
  const first=published();
  useDocumentWallpaper(host,palette);
  await first;
  assert.equal(captures,1);assert.match(style.get('--document-image-frame'),/^url\("blob:/);
  assert.equal(style.get('--scene-text-frame-size'),'3840px 2160px');
  assert.ok(attributes.has('data-scene-text-frame'));
  const bitmap=async(key='--document-image-frame')=>{
   const fileUrl=JSON.parse(style.get(key).slice(4,-1));
   const response=await fetch(fileUrl);
   assert.equal(response.headers.get('content-type'),'image/bmp');
   return new DataView(await response.arrayBuffer());
  };
  const still=await bitmap();
  assert.equal(still.getUint16(0,true),0x4D42);
  assert.equal(still.getInt32(18,true),1920);
  assert.equal(still.getUint8(54),123);
  const next=published();
  uniforms.bounce.value=1.05;
  wallpaper.updateMotion();
  await next;
  const motion=await bitmap();
  assert.equal(motion.getInt32(18,true),960);
  assert.equal(motion.getUint8(54),123);
  await published();
  assert.equal((await bitmap()).getInt32(18,true),1920);
  assert.equal(captures,3);
  const pale=published();
  useDocumentWallpaper(host,{...palette,ink:'pale',saturation:.5});
  await pale;
  assert.ok(attributes.has('data-scene-text-frame'));
  assert.equal((await bitmap()).getUint8(54),62);
  useDocumentWallpaper(host);
  assert.equal(style.size,0);assert.equal(attributes.size,0);
 }finally{
  useDocumentWallpaper(host);wallpaper.dispose();image.dispose();
  globalThis.document=previousDocument;globalThis.Image=previousImage;
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
