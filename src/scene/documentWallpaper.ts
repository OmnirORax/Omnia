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

/** Publish a bounded, color-corrected viewport image when an open document needs one. */
export function createDocumentWallpaper(renderer:THREE.WebGLRenderer,uniforms:WallpaperSampleUniforms){
 let width=1,height=1,revision=0,timer:ReturnType<typeof setTimeout>|undefined,running=false,closed=false,url:string|undefined;
 let quad:FullScreenQuad|undefined,material:THREE.ShaderMaterial|undefined;
 const clear=()=>{
  const style=document.documentElement.style;
  style.removeProperty('--scene-text-frame');
  style.removeProperty('--scene-text-frame-size');
  if(url)URL.revokeObjectURL(url);
  url=undefined;
 };
 const schedule=()=>{
  clearTimeout(timer);
  if(!closed&&!running&&consumers.size&&uniforms.image.value)timer=setTimeout(()=>void capture(),120);
 };
 const refresh=()=>{revision++;schedule();};
 const demand=()=>{if(!consumers.size)clear();refresh();};
 listeners.add(demand);
 async function capture(){
  const captured=revision;
  if(closed||!consumers.size||!uniforms.image.value)return;
  running=true;
  const scale=Math.min(1,Math.sqrt(2_073_600/(width*height)));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const target=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});
  try{
   if(!quad){
    material=new THREE.ShaderMaterial({
     uniforms,depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     // Write display RGB explicitly and flip rows for ImageData.
     fragmentShader:`${wallpaperSampleGLSL}
      varying vec2 screenUV;
      void main(){gl_FragColor=vec4(displayColour(sampleWallpaper(vec2(screenUV.x,1.0-screenUV.y))),1.0);}`,
    });
    quad=new FullScreenQuad(material);
   }
   const previous=renderer.getRenderTarget();
   try{renderer.setRenderTarget(target);quad.render(renderer);}finally{renderer.setRenderTarget(previous);}
   const bytes=new Uint8ClampedArray(w*h*4);
   await renderer.readRenderTargetPixelsAsync(target,0,0,w,h,new Uint8Array(bytes.buffer));
   if(closed||captured!==revision||!consumers.size)return;
   const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
   const context=canvas.getContext('2d');if(!context)return;
   context.putImageData(new ImageData(bytes,w,h),0,0);
   const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!blob||closed||captured!==revision||!consumers.size)return;
   const next=URL.createObjectURL(blob);
   const style=document.documentElement.style;
   style.setProperty('--scene-text-frame',`url(${JSON.stringify(next)})`);
   style.setProperty('--scene-text-frame-size','100% 100%');
   if(url)URL.revokeObjectURL(url);
   url=next;
  }catch{/* The original image is available while display-color capture is unavailable. */}
  finally{target.dispose();running=false;if(captured!==revision)schedule();}
 }
 return {
  refresh,
  reset(){clear();refresh();},
  resize(w:number,h:number){if(w!==width||h!==height){width=w;height=h;clear();refresh();}},
  dispose(){closed=true;listeners.delete(demand);clearTimeout(timer);clear();quad?.dispose();material?.dispose();},
 };
}
