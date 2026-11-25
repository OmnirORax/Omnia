import type {TextPalette} from '../properties/textPalette.ts';
import {acquireImagePixelInk,imagePixelInkGLSL,type ImagePixelInk} from '../properties/imagePixelInk.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';

type Frame={ink:ImagePixelInk;texture:{value:THREE.Texture|null};uses:number;revision?:number;target?:THREE.WebGLRenderTarget;url?:string};
const frames=new Map<string,Frame>(),consumers=new Map<HTMLElement,ReturnType<typeof acquireTextWallpaper>>();
const listeners=new Set<()=>void>();
/** Documents and world labels retain the same static, resolved image per palette. */
export function acquireTextWallpaper(palette:TextPalette){
 const ink=acquireImagePixelInk(palette);
 let frame=frames.get(ink.key);
 if(frame)ink.release();
 else{frame={ink,texture:{value:null},uses:0};frames.set(ink.key,frame);}
 frame.uses++;
 const owned=frame;
 if(owned.uses===1)for(const listener of listeners)listener();
 return {key:owned.ink.key,texture:owned.texture,release(){
  if(--owned.uses)return;
  frames.delete(owned.ink.key);owned.ink.release();owned.target?.dispose();
  if(owned.url)URL.revokeObjectURL(owned.url);
  for(const listener of listeners)listener();
 }};
}
function setDocumentFrame(host:HTMLElement,url?:string){
 if(url)host.style.setProperty('--document-image-frame',`url(${JSON.stringify(url)})`);
 else host.style.removeProperty('--document-image-frame');
 host.toggleAttribute('data-scene-text-frame',!!url);
}
export function useDocumentWallpaper(host:HTMLElement,palette?:TextPalette){
 const previous=consumers.get(host),next=palette&&acquireTextWallpaper(palette);
 if(previous?.key===next?.key){next?.release();return;}
 if(next)consumers.set(host,next);else consumers.delete(host);
 previous?.release();
 setDocumentFrame(host,next?frames.get(next.key)?.url:undefined);
 for(const listener of listeners)listener();
}

const STATIC_PIXELS=2_073_600;
/** BMP stores the GPU's bottom-up BGRA bytes without an image encoder. */
function wallpaperBitmap(width:number,height:number,bytes:Uint8Array<ArrayBuffer>){
 const header=new DataView(new ArrayBuffer(54));
 header.setUint16(0,0x4D42,true);header.setUint32(2,54+bytes.byteLength,true);header.setUint32(10,54,true);
 header.setUint32(14,40,true);header.setInt32(18,width,true);header.setInt32(22,height,true);
 header.setUint16(26,1,true);header.setUint16(28,32,true);
 return new Blob([header.buffer,bytes],{type:'image/bmp'});
}

/** Rebuild only after an image, authored color setting, viewport or palette change. */
export function createDocumentWallpaper(renderer:THREE.WebGLRenderer,uniforms:WallpaperSampleUniforms,requestPaint=()=>{}){
 let width=1,height=1,revision=0,sourceRevision=0,timer:ReturnType<typeof setTimeout>|undefined,running=false,closed=false,pending=false;
 const imagePixelInk={value:null as THREE.Texture|null},imagePixelSaturation={value:1};
 let quad:FullScreenQuad|undefined,material:THREE.ShaderMaterial|undefined;
 const available=()=>!closed&&frames.size>0&&!!uniforms.image.value;
 const clear=()=>{
  for(const host of consumers.keys())setDocumentFrame(host);
  for(const frame of frames.values()){
   frame.texture.value=null;frame.target?.dispose();frame.target=undefined;
   if(frame.url)URL.revokeObjectURL(frame.url);frame.url=undefined;
  }
  document.documentElement.style.removeProperty('--scene-text-frame-size');
 };
 const schedule=()=>{if(!running&&timer===undefined&&pending&&available())timer=setTimeout(()=>{timer=undefined;void capture();},0);};
 const invalidate=()=>{revision++;pending=true;schedule();};
 const refresh=()=>{sourceRevision++;invalidate();};
 const demand=()=>{
  const documents=new Set([...consumers.values()].map(ink=>ink.key));
  for(const [key,frame] of frames)if(frame.url&&!documents.has(key)){URL.revokeObjectURL(frame.url);frame.url=undefined;}
  if(!frames.size)document.documentElement.style.removeProperty('--scene-text-frame-size');
  invalidate();
 };
 listeners.add(demand);
 async function capture(){
  if(!available())return;
  const captured=revision;running=true;pending=false;
  const requested=[...frames.values()];
  const scale=Math.min(1,Math.sqrt(STATIC_PIXELS/(width*height*requested.length)));
  const w=Math.max(1,Math.floor(width*scale)),h=Math.max(1,Math.floor(height*scale));
  let nextUrl:string|undefined;
  try{
   if(!quad){
    material=new THREE.ShaderMaterial({
     // Animation and transient selection feedback never alter the applied text image.
     uniforms:{...uniforms,time:{value:0},bounce:{value:1},light:{value:0},waves:{value:0},feedbackStrength:{value:0},imagePixelInk,imagePixelSaturation},
     depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     fragmentShader:`${wallpaperSampleGLSL}${imagePixelInkGLSL}
      varying vec2 screenUV;
      void main(){gl_FragColor=vec4(mapImagePixel(displayColour(sampleWallpaper(screenUV))),1.0);}`,
    });
    quad=new FullScreenQuad(material);
   }
   for(const frame of requested){
    if(captured!==revision||!available())return;
    const rebuild=frame.revision!==sourceRevision||!frame.target||frame.target.width!==w||frame.target.height!==h;
    if(rebuild){
     frame.target??=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});frame.target.setSize(w,h);
     imagePixelInk.value=frame.ink.texture;imagePixelSaturation.value=frame.ink.saturation;
     const previous=renderer.getRenderTarget();
     try{renderer.setRenderTarget(frame.target);quad.render(renderer);}finally{renderer.setRenderTarget(previous);}
     frame.revision=sourceRevision;
    }
    const hosts=[...consumers].filter(([,ink])=>ink.key===frame.ink.key).map(([host])=>host);
    if(hosts.length&&(rebuild||!frame.url)){
     const bytes=new Uint8Array(w*h*4);
     await renderer.readRenderTargetPixelsAsync(frame.target!,0,0,w,h,bytes);
     if(captured!==revision||!available())return;
     for(let at=0;at<bytes.length;at+=4){const r=bytes[at];bytes[at]=bytes[at+2];bytes[at+2]=r;}
     nextUrl=URL.createObjectURL(wallpaperBitmap(w,h,bytes));
     const image=new Image();image.src=nextUrl;await image.decode();
     if(captured!==revision||!available())return;
     document.documentElement.style.setProperty('--scene-text-frame-size',`${width}px ${height}px`);
     for(const host of hosts)setDocumentFrame(host,nextUrl);
     if(frame.url)URL.revokeObjectURL(frame.url);frame.url=nextUrl;nextUrl=undefined;
    }
    frame.texture.value=frame.target!.texture;
   }
   requestPaint();
  }catch{/* Keep the resolved motif palette until a static capture is available. */}
  finally{if(nextUrl)URL.revokeObjectURL(nextUrl);running=false;if(pending)schedule();}
 }
 return {
  refresh,
  reset(){clear();refresh();},
  resize(w:number,h:number){if(w!==width||h!==height){width=w;height=h;clear();refresh();}},
  dispose(){closed=true;listeners.delete(demand);clearTimeout(timer);clear();quad?.dispose();material?.dispose();},
 };
}
