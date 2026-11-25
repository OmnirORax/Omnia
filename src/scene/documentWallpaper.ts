import type {TextPalette} from '../properties/textPalette.ts';
import {acquireImagePixelInk,imagePixelInkGLSL,type ImagePixelInk} from '../properties/imagePixelInk.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';

const consumers=new Map<HTMLElement,ImagePixelInk>();
const listeners=new Set<()=>void>();
function setDocumentFrame(host:HTMLElement,url?:string){
 if(url)host.style.setProperty('--document-image-frame',`url(${JSON.stringify(url)})`);
 else host.style.removeProperty('--document-image-frame');
 host.toggleAttribute('data-scene-text-frame',!!url);
}
export function useDocumentWallpaper(host:HTMLElement,palette?:TextPalette){
 const previous=consumers.get(host),next=palette&&acquireImagePixelInk(palette);
 if(previous?.key===next?.key){next?.release();return;}
 if(next)consumers.set(host,next);else consumers.delete(host);
 previous?.release();
 if(previous)setDocumentFrame(host);
 for(const listener of listeners)listener();
}

const MOTION_INTERVAL=1000/15;
const MOTION_IDLE=180;
const STATIC_PIXELS=2_073_600;
const MOTION_PIXELS=518_400;

/** BMP stores the GPU's bottom-up BGRA bytes without a per-frame encoder. */
function wallpaperBitmap(width:number,height:number,bytes:Uint8Array<ArrayBuffer>){
 const header=new DataView(new ArrayBuffer(54));
 header.setUint16(0,0x4D42,true);
 header.setUint32(2,54+bytes.byteLength,true);
 header.setUint32(10,54,true);
 header.setUint32(14,40,true);
 header.setInt32(18,width,true);
 header.setInt32(22,height,true);
 header.setUint16(26,1,true);
 header.setUint16(28,32,true);
 return new Blob([header.buffer,bytes],{type:'image/bmp'});
}

/** Publish rendered wallpaper frames only while a document needs them. */
export function createDocumentWallpaper(renderer:THREE.WebGLRenderer,uniforms:WallpaperSampleUniforms){
 let width=1,height=1,revision=0,timer:ReturnType<typeof setTimeout>|undefined,running=false,closed=false;
 const urls=new Map<string,string>(),imagePixelInk={value:null as THREE.Texture|null};
 let quad:FullScreenQuad|undefined,material:THREE.ShaderMaterial|undefined,target:THREE.WebGLRenderTarget|undefined;
 let lastMotion=-Infinity,lastCapture=-Infinity,scheduledAt=Infinity,pending=false;
 const available=()=>!closed&&consumers.size>0&&!!uniforms.image.value;
 const inMotion=(now:number)=>now-lastMotion<MOTION_IDLE;
 const releaseTarget=()=>{target?.dispose();target=undefined;};
 const clear=()=>{
  for(const host of consumers.keys())setDocumentFrame(host);
  for(const url of urls.values())URL.revokeObjectURL(url);
  urls.clear();
  document.documentElement.style.removeProperty('--scene-text-frame-size');
 };
 const schedule=()=>{
  if(running||!available())return;
  const now=performance.now();
  const delay=pending?(inMotion(now)?Math.max(0,MOTION_INTERVAL-(now-lastCapture)):0):Math.max(0,MOTION_IDLE-(now-lastMotion));
  const due=now+delay;
  if(timer!==undefined&&scheduledAt<=due)return;
  clearTimeout(timer);
  scheduledAt=due;
  timer=setTimeout(()=>{
   timer=undefined;scheduledAt=Infinity;
   const moving=inMotion(performance.now());
   if(!pending&&moving){schedule();return;}
   void capture(moving);
  },Math.ceil(delay));
 };
 const refresh=()=>{revision++;pending=true;schedule();};
 const demand=()=>{
  const active=new Set([...consumers.values()].map(ink=>ink.key));
  for(const [key,url] of urls)if(!active.has(key)){URL.revokeObjectURL(url);urls.delete(key);}
  if(!consumers.size){clear();if(!running)releaseTarget();}
  for(const [host,ink] of consumers)setDocumentFrame(host,urls.get(ink.key));
  refresh();
 };
 listeners.add(demand);
 async function capture(moving:boolean){
  const captured=revision;
  if(!available())return;
  running=true;pending=false;lastCapture=performance.now();
  let nextUrl:string|undefined;
  const requested=new Map([...consumers.values()].map(ink=>[ink.key,ink.texture]));
  const scale=Math.min(1,Math.sqrt((moving?MOTION_PIXELS:STATIC_PIXELS)/(width*height*requested.size)));
  const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
  try{
   target??=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});
   target.setSize(w,h);
   if(!quad){
    material=new THREE.ShaderMaterial({
     uniforms:{...uniforms,imagePixelInk},depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     // Write display-space bytes in the order required by BMP.
     fragmentShader:`${wallpaperSampleGLSL}${imagePixelInkGLSL}
      varying vec2 screenUV;
      void main(){
       vec3 rgb=mapImagePixel(displayColour(sampleWallpaper(screenUV)));
       gl_FragColor=vec4(rgb.bgr,1.0);
      }`,
    });
    quad=new FullScreenQuad(material);
   }
   for(const [key,texture] of requested){
    imagePixelInk.value=texture;
    const previous=renderer.getRenderTarget();
    try{renderer.setRenderTarget(target);quad.render(renderer);}finally{renderer.setRenderTarget(previous);}
    const bytes=new Uint8Array(w*h*4);
    await renderer.readRenderTargetPixelsAsync(target,0,0,w,h,bytes);
    if(captured!==revision||!available())return;
    nextUrl=URL.createObjectURL(wallpaperBitmap(w,h,bytes));
    const frame=new Image();
    frame.src=nextUrl;
    await frame.decode();
    if(captured!==revision||!available())return;
    document.documentElement.style.setProperty('--scene-text-frame-size',`${width}px ${height}px`);
    for(const [host,ink] of consumers)if(ink.key===key)setDocumentFrame(host,nextUrl);
    const previousUrl=urls.get(key);
    if(previousUrl)URL.revokeObjectURL(previousUrl);
    urls.set(key,nextUrl);nextUrl=undefined;
   }
  }catch{/* Keep the document palette when display-color capture is unavailable. */}
  finally{
   if(nextUrl)URL.revokeObjectURL(nextUrl);
   running=false;
   if(!available())releaseTarget();
   else if(pending||captured!==revision||moving)schedule();
  }
 }
 return {
  refresh,
  updateMotion(){if(available()){lastMotion=performance.now();pending=true;schedule();}},
  reset(){clear();lastMotion=-Infinity;if(!running)releaseTarget();refresh();},
  resize(w:number,h:number){if(w!==width||h!==height){width=w;height=h;clear();refresh();}},
  dispose(){closed=true;listeners.delete(demand);clearTimeout(timer);clear();if(!running)releaseTarget();quad?.dispose();material?.dispose();},
 };
}
