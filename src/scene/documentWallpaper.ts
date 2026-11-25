import {vividImagePixelGLSL} from '../properties/imagePixelInk.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';

type DocumentInk='color'|'pale';
const consumers={color:new Set<HTMLElement>(),pale:new Set<HTMLElement>()};
const inks=['color','pale'] as const;
const listeners=new Set<()=>void>();
const demandedInks=()=>inks.filter(ink=>consumers[ink].size>0);
const frameKey={color:'scene-text-frame',pale:'scene-text-pale-frame'} as const;

export function useDocumentWallpaper(host:HTMLElement,enabled:boolean,pale=false){
 const prior=demandedInks().join(',');
 for(const ink of inks)consumers[ink].delete(host);
 if(enabled)consumers[pale?'pale':'color'].add(host);
 if(prior!==demandedInks().join(','))for(const listener of listeners)listener();
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
 const urls=new Map<DocumentInk,string>(),paleFrame={value:0};
 let quad:FullScreenQuad|undefined,material:THREE.ShaderMaterial|undefined,target:THREE.WebGLRenderTarget|undefined;
 let lastMotion=-Infinity,lastCapture=-Infinity,scheduledAt=Infinity,pending=false;
 const available=()=>!closed&&(consumers.color.size>0||consumers.pale.size>0)&&!!uniforms.image.value;
 const inMotion=(now:number)=>now-lastMotion<MOTION_IDLE;
 const releaseTarget=()=>{target?.dispose();target=undefined;};
 const clearFrame=(ink:DocumentInk)=>{
  const url=urls.get(ink);
  if(!url)return;
  const root=document.documentElement;
  root.style.removeProperty(`--${frameKey[ink]}`);
  root.toggleAttribute(`data-${frameKey[ink]}`,false);
  URL.revokeObjectURL(url);
  urls.delete(ink);
 };
 const clear=()=>{
  for(const ink of inks)clearFrame(ink);
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
  for(const ink of inks)if(!consumers[ink].size)clearFrame(ink);
  if(!consumers.color.size&&!consumers.pale.size){clear();if(!running)releaseTarget();}
  refresh();
 };
 listeners.add(demand);
 async function capture(moving:boolean){
  const captured=revision;
  if(!available())return;
  running=true;pending=false;lastCapture=performance.now();
  let nextUrl:string|undefined;
  const requested=demandedInks();
  const scale=Math.min(1,Math.sqrt((moving?MOTION_PIXELS:STATIC_PIXELS)/(width*height*requested.length)));
  const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
  try{
   target??=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});
   target.setSize(w,h);
   if(!quad){
    material=new THREE.ShaderMaterial({
     uniforms:{...uniforms,paleFrame},depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     // Write display-space bytes in the order required by BMP.
     fragmentShader:`${wallpaperSampleGLSL}${vividImagePixelGLSL}
      uniform float paleFrame; varying vec2 screenUV;
      void main(){
       vec3 rgb=displayColour(sampleWallpaper(screenUV));
       if(paleFrame>.5)rgb=vividImagePixel(rgb);
       gl_FragColor=vec4(rgb.bgr,1.0);
      }`,
    });
    quad=new FullScreenQuad(material);
   }
   for(const ink of requested){
    paleFrame.value=Number(ink==='pale');
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
    const root=document.documentElement;
    root.style.setProperty(`--${frameKey[ink]}`,`url(${JSON.stringify(nextUrl)})`);
    root.style.setProperty('--scene-text-frame-size',`${width}px ${height}px`);
    root.toggleAttribute(`data-${frameKey[ink]}`,true);
    const previousUrl=urls.get(ink);
    if(previousUrl)URL.revokeObjectURL(previousUrl);
    urls.set(ink,nextUrl);nextUrl=undefined;
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
