import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createDocumentWallpaper,useDocumentWallpaper} from '../src/scene/documentWallpaper.ts';
import {createWallpaperSampling} from '../src/scene/wallpaperSample.ts';

test('open image-pixel documents get display RGB at viewport coordinates from a bounded capture',{timeout:3000},async()=>{
 const previousDocument=globalThis.document,previousImageData=globalThis.ImageData;
 const style=new Map(),host={};let target=null,captures=0,captured;
 let publish;
 const published=new Promise(resolve=>{publish=resolve;});
 globalThis.document={
  documentElement:{style:{
   setProperty(name,value){style.set(name,value);if(name==='--scene-text-frame-size')publish();},
   removeProperty(name){style.delete(name);},
  }},
  createElement:()=>({
   getContext:()=>({putImageData(data){assert.equal(data.bytes[0],123);}}),
   toBlob:callback=>callback(new Blob(['canvas'],{type:'image/png'})),
  }),
 };
 globalThis.ImageData=class{constructor(bytes){this.bytes=bytes;}};
 const renderer={
  getRenderTarget:()=>target,
  setRenderTarget(next){target=next;},
  render(mesh){captured=target;assert.match(mesh.material.fragmentShader,/displayColour\(sampleWallpaper\(vec2\(screenUV.x,1.0-screenUV.y\)\)\)/);},
  async readRenderTargetPixelsAsync(read,_x,_y,w,h,bytes){
   captures++;assert.equal(target,null);assert.equal(read,captured);assert.equal(w,1920);assert.equal(h,1080);bytes[0]=123;
  },
 };
 const {uniforms}=createWallpaperSampling(),image=new T.Texture();
 uniforms.image.value=image;
 const wallpaper=createDocumentWallpaper(renderer,uniforms);
 try{
  wallpaper.resize(3840,2160);assert.equal(captures,0);
  useDocumentWallpaper(host,true);
  await published;
  assert.equal(captures,1);assert.match(style.get('--scene-text-frame'),/^url\("blob:/);
  assert.equal(style.get('--scene-text-frame-size'),'100% 100%');
  useDocumentWallpaper(host,false);
  assert.equal(style.size,0);
 }finally{
  useDocumentWallpaper(host,false);wallpaper.dispose();image.dispose();
  globalThis.document=previousDocument;globalThis.ImageData=previousImageData;
 }
});
