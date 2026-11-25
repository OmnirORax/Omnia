import type {TextPalette} from '../properties/textPalette.ts';
import {PIXEL_MOTIF_LIMIT,type PixelMotifs} from '../properties/pixelMotifs.ts';
import {acquireImagePixelInk,imagePixelInkGLSL,imagePixelInkKey,type ImagePixelInk} from '../properties/imagePixelInk.ts';
import * as THREE from 'three';
import {FullScreenQuad} from 'three/addons/postprocessing/Pass.js';
import {wallpaperSampleGLSL,type WallpaperSampleUniforms} from './wallpaperSample.ts';
import {visibleTextCenter} from '../text/visibleTextCenter.ts';

type Frame={key:string;scale:number;inverse:number;centered:boolean;ink:ImagePixelInk;motifs?:PixelMotifs;texture:{value:THREE.Texture|null};uses:number;revision?:number;target?:THREE.WebGLRenderTarget;url?:string};
const frames=new Map<string,Frame>(),consumers=new Map<HTMLElement,ReturnType<typeof acquireTextWallpaper>>();
const listeners=new Set<()=>void>();
const frameKey=(p:TextPalette)=>JSON.stringify([imagePixelInkKey(p),p.scale??1,!!p.inverseDistribution,!!p.centerImagePixels,p.pixelMotifs?.image,p.pixelMotifs?.size,p.pixelMotifs?.patches]);
function syncTextCenter(){visibleTextCenter.setEnabled([...frames.values()].some(frame=>frame.centered));}
/** Documents and world labels retain the same static, resolved image per palette. */
export function acquireTextWallpaper(palette:TextPalette){
 const ink=acquireImagePixelInk(palette),scale=palette.scale??1,key=frameKey(palette);
 let frame=frames.get(key);
 if(frame)ink.release();
 else{frame={key,scale,inverse:Number(!!palette.inverseDistribution),centered:!!palette.centerImagePixels,ink,motifs:palette.pixelMotifs,texture:{value:null},uses:0};frames.set(key,frame);if(frame.centered)syncTextCenter();}
 frame.uses++;
 const owned=frame;
 if(owned.uses===1)for(const listener of listeners)listener();
 return {key:owned.key,texture:owned.texture,centered:owned.centered,release(){
  if(--owned.uses)return;
  frames.delete(owned.key);owned.ink.release();owned.target?.dispose();
  if(owned.url)URL.revokeObjectURL(owned.url);
  if(owned.centered)syncTextCenter();
  for(const listener of listeners)listener();
 }};
}
function setDocumentFrame(host:HTMLElement,url?:string,centered=false){
 if(url)host.style.setProperty('--document-image-frame',`url(${JSON.stringify(url)})`);
 else host.style.removeProperty('--document-image-frame');
 host.toggleAttribute('data-scene-text-frame',!!url);
 host.toggleAttribute('data-scene-text-centered',!!url&&centered);
}
export function useDocumentWallpaper(host:HTMLElement,palette?:TextPalette){
 const previous=consumers.get(host),next=palette&&acquireTextWallpaper(palette);
 if(previous?.key===next?.key){next?.release();return;}
 if(next)consumers.set(host,next);else consumers.delete(host);
 previous?.release();
 setDocumentFrame(host,next?frames.get(next.key)?.url:undefined,next?.centered);
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
 let sourceImage:string|undefined;
 const imagePixelInk={value:null as THREE.Texture|null},imagePixelSaturation={value:1},imagePixelScale={value:1},imagePixelInverse={value:0};
 const imagePixelCentered={value:false};
 const motifCount={value:0},motifSize={value:new THREE.Vector2(1,1)},motifGridSize={value:new THREE.Vector2(1,1)};
 const motifSources={value:Array.from({length:PIXEL_MOTIF_LIMIT},()=>new THREE.Vector4())};
 const motifDestinations={value:Array.from({length:PIXEL_MOTIF_LIMIT},()=>new THREE.Vector2())};
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
  for(const [key,frame] of frames)if(!documents.has(key)){if(frame.url)URL.revokeObjectURL(frame.url);frame.url=undefined;}
  if(!frames.size)document.documentElement.style.removeProperty('--scene-text-frame-size');
  invalidate();
 };
 listeners.add(demand);
 const stopCenter=visibleTextCenter.onRepaint(requestPaint);
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
     uniforms:{...uniforms,time:{value:0},bounce:{value:1},light:{value:0},waves:{value:0},feedbackStrength:{value:0},imagePixelInk,imagePixelSaturation,imagePixelScale,imagePixelInverse,imagePixelCentered,motifCount,motifSize,motifGridSize,motifSources,motifDestinations},
     depthTest:false,depthWrite:false,toneMapped:false,
     vertexShader:'varying vec2 screenUV; void main(){screenUV=uv;gl_Position=vec4(position.xy,1.0,1.0);}',
     fragmentShader:`${wallpaperSampleGLSL}${imagePixelInkGLSL}
      uniform float imagePixelScale; uniform float imagePixelInverse;
      uniform bool imagePixelCentered;
      uniform int motifCount; uniform vec2 motifSize; uniform vec2 motifGridSize;
      uniform vec4 motifSources[${PIXEL_MOTIF_LIMIT}];
      uniform vec2 motifDestinations[${PIXEL_MOTIF_LIMIT}];
      varying vec2 screenUV;
      vec2 centeredUV(){
       vec2 point=(screenUV-.5)/imagePixelScale;
       if(imagePixelInverse>.5)point=-point;
       return clamp(point+.5,vec2(0.0),vec2(.999999));
      }
      vec3 sampleMotifs(){
       vec2 cover=wallpaperCover();
       vec2 tile=(vec2(screenUV.x,1.0-screenUV.y)-.5)*cover/imagePixelScale;
       if(imagePixelInverse>.5)tile=-tile;
       // Use the unwrapped footprint for filtering across tile and patch boundaries.
       vec2 dx=dFdx(vec2(tile.x,-tile.y)),dy=dFdy(vec2(tile.x,-tile.y));
       tile=mod(tile+motifSize*.5,motifSize);
       if(imagePixelCentered){
        vec2 point=centeredUV();
        tile=vec2(point.x,1.0-point.y)*motifSize;
        dx=dFdx(point*motifSize);dy=dFdy(point*motifSize);
       }
       vec2 uv=vec2(0.0);
       float nearest=1e30;
       for(int i=0;i<${PIXEL_MOTIF_LIMIT};i++){
        if(i>=motifCount)break;
        vec2 p=tile-motifDestinations[i];
        vec4 sourceRect=motifSources[i];
        if(all(greaterThanEqual(p,vec2(0.0)))&&all(lessThan(p,sourceRect.zw))){uv=sourceRect.xy+p;break;}
        // Extend the closest patch into the spaces left by packing irregular rectangles.
        vec2 edge=clamp(p,vec2(0.0),sourceRect.zw);
        vec2 offset=(p-edge)/cover;
        float distanceSquared=dot(offset,offset);
        if(distanceSquared<nearest){
         nearest=distanceSquared;
         uv=sourceRect.xy+min(edge,sourceRect.zw*.9999);
        }
       }
       vec4 texel=textureGrad(image,vec2(uv.x,1.0-uv.y),dx,dy);
       return mapMotifPixel(vec4(displayColour(texel.rgb),texel.a),displayColour(colourWallpaperPixel(texel.rgb)),uv,motifGridSize);
      }
      void main(){
       if(motifCount>0){gl_FragColor=vec4(sampleMotifs(),1.0);return;}
       if(imagePixelCentered){gl_FragColor=vec4(mapImagePixel(displayColour(sampleWallpaper(centeredUV()))),1.0);return;}
       vec2 pixelUV=(screenUV-.5)/imagePixelScale+.5;
       if(imagePixelInverse>.5)pixelUV=vec2(1.0)-pixelUV;
       pixelUV=fract(pixelUV);
       gl_FragColor=vec4(mapImagePixel(displayColour(sampleWallpaper(pixelUV))),1.0);
      }`,
    });
    quad=new FullScreenQuad(material);
   }
   for(const frame of requested){
    if(captured!==revision||!available())return;
    const rebuild=frame.revision!==sourceRevision||!frame.target||frame.target.width!==w||frame.target.height!==h;
    if(rebuild){
     frame.target??=new THREE.WebGLRenderTarget(w,h,{depthBuffer:false});frame.target.setSize(w,h);
     imagePixelInk.value=frame.ink.texture;imagePixelSaturation.value=frame.ink.saturation;imagePixelScale.value=frame.scale;imagePixelInverse.value=frame.inverse;
     imagePixelCentered.value=frame.centered;
     const motifs=frame.motifs?.image===undefined||frame.motifs.image===sourceImage?frame.motifs:undefined;
     motifCount.value=motifs?.patches.length??0;
     if(motifs){
      motifGridSize.value.set(motifs.fill?.width??1,motifs.fill?.height??1);
      motifSize.value.set(...motifs.size);
      motifs.patches.forEach(({source,x,y},index)=>{
       motifSources.value[index].set(...source);motifDestinations.value[index].set(x,y);
      });
     }
     const previous=renderer.getRenderTarget();
     try{renderer.setRenderTarget(frame.target);quad.render(renderer);}finally{renderer.setRenderTarget(previous);}
     frame.revision=sourceRevision;
    }
    const hosts=[...consumers].filter(([,ink])=>ink.key===frame.key).map(([host])=>host);
    if(hosts.length&&(rebuild||!frame.url)){
     const bytes=new Uint8Array(w*h*4);
     await renderer.readRenderTargetPixelsAsync(frame.target!,0,0,w,h,bytes);
     if(captured!==revision||!available())return;
     for(let at=0;at<bytes.length;at+=4){const r=bytes[at];bytes[at]=bytes[at+2];bytes[at+2]=r;}
     nextUrl=URL.createObjectURL(wallpaperBitmap(w,h,bytes));
     const image=new Image();image.src=nextUrl;await image.decode();
     if(captured!==revision||!available())return;
     document.documentElement.style.setProperty('--scene-text-frame-size',`${width}px ${height}px`);
     for(const host of hosts)setDocumentFrame(host,nextUrl,frame.centered);
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
  reset(image?:string){sourceImage=image;clear();refresh();},
  resize(w:number,h:number){if(w!==width||h!==height){width=w;height=h;clear();refresh();}},
  dispose(){closed=true;listeners.delete(demand);stopCenter();clearTimeout(timer);clear();quad?.dispose();material?.dispose();},
 };
}
