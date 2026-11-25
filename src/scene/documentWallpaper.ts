import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';

const consumers=new Set<HTMLElement>();
const listeners=new Set<()=>void>();

export function useDocumentWallpaper(host:HTMLElement,enabled:boolean){
 const active=consumers.size>0;
 if(enabled)consumers.add(host);else consumers.delete(host);
 if(active!==(consumers.size>0))for(const listener of listeners)listener();
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
 let width=1,height=1,revision=0,timer:ReturnType<typeof setTimeout>|undefined,running=false,closed=false,url:string|undefined;
 let quad:FullScreenQuad|undefined,material:THREE.ShaderMaterial|undefined,target:THREE.WebGLRenderTarget|undefined;
 let lastMotion=-Infinity,lastCapture=-Infinity,scheduledAt=Infinity,pending=false;
 const available=()=>!closed&&consumers.size>0&&!!uniforms.image.value;
 const inMotion=(now:number)=>now-lastMotion<MOTION_IDLE;
 const releaseTarget=()=>{target?.dispose();target=undefined;};
 const clear=()=>{
  const style=document.documentElement.style;
  style.removeProperty('--scene-text-frame');
  style.removeProperty('--scene-text-frame-size');
  document.documentElement.toggleAttribute('data-scene-text-frame',false);
  if(url)URL.revokeObjectURL(url);
  url=undefined;
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
  if(!consumers.size){clear();if(!running)releaseTarget();}
  refresh();
 };
 listeners.add(demand);
 async function capture(moving:boolean){
  const captured=revision;
  if(!available())return;
  running=true;pending=false;lastCapture=performance.now();
  let nextUrl:string|undefined;
  const scale=Math.min(1,Math.sqrt((moving?MOTION_PIXELS:STATIC_PIXELS)/(width*height)));
  const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
  try{
   target??=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});
   target.setSize(w,h);
   if(!quad){
    material=new THREE.ShaderMaterial({
     uniforms,depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     // Write display-space bytes in the order required by BMP.
     fragmentShader:`${wallpaperSampleGLSL}
      varying vec2 screenUV;
      void main(){gl_FragColor=vec4(displayColour(sampleWallpaper(screenUV)).bgr,1.0);}`,
    });
    quad=new FullScreenQuad(material);
   }
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
   const style=document.documentElement.style;
   style.setProperty('--scene-text-frame',`url(${JSON.stringify(nextUrl)})`);
   style.setProperty('--scene-text-frame-size',`${width}px ${height}px`);
   document.documentElement.toggleAttribute('data-scene-text-frame',true);
   if(url)URL.revokeObjectURL(url);
   url=nextUrl;nextUrl=undefined;
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
