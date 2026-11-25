import * as T from 'three';
import {nearestPaletteTrait,paletteColorTraits,paletteHueFamily,paletteRGB,PALETTE_DARK_THRESHOLD,PALETTE_CHROMA_THRESHOLD} from '../scene/palette.ts';
import type {TextPalette} from './textPalette.ts';

const HUES=360;
export type ImagePixelInk={key:string;texture:T.DataTexture;saturation:number;release:()=>void};
const textures=new Map<string,{texture:T.DataTexture;uses:number}>();

/** Enabled hue families pass through. The lookup only steers excluded hues. */
export function acquireImagePixelInk(p:TextPalette):ImagePixelInk{
 const sources=p.pixelSources??p.colors,saturation=p.saturation??1;
 const textureKey=JSON.stringify(sources),key=JSON.stringify([sources,saturation]);
 let entry=textures.get(textureKey);
 if(!entry){
  const rgb=sources.map(paletteRGB),traits=rgb.map(paletteColorTraits);
  const enabled=new Set(traits.filter(swatch=>swatch.chromatic).map(swatch=>paletteHueFamily(swatch.hue)));
  const data=new Uint8Array(HUES*4);
  for(let slot=0;slot<HUES;slot++){
   const hue=slot+.5,at=slot*4;
   if(enabled.has(paletteHueFamily(hue)))continue;
   // Alpha 0 keeps the pixel, 255 rotates its hue, and 128 removes its chroma.
   if(!enabled.size){data[at+3]=128;continue;}
   const swatch=rgb[nearestPaletteTrait({chromatic:true,hue,value:1},traits)];
   const low=Math.min(...swatch),span=Math.max(...swatch)-low;
   data.set(swatch.map(channel=>Math.round((channel-low)*255/span)),at);
   data[at+3]=255;
  }
  const texture=new T.DataTexture(data,HUES,1);
  texture.needsUpdate=true;
  entry={texture,uses:0};textures.set(textureKey,entry);
 }
 entry.uses++;
 const owned=entry;
 return {key,texture:owned.texture,saturation,release(){if(!--owned.uses){owned.texture.dispose();textures.delete(textureKey);}}};
}

export const imagePixelInkGLSL=`
 uniform sampler2D imagePixelInk;
 uniform float imagePixelSaturation;
 vec3 mapImagePixel(vec3 rgb){
  rgb=clamp(rgb,0.0,1.0);
  float high=max(rgb.r,max(rgb.g,rgb.b)),low=min(rgb.r,min(rgb.g,rgb.b));
  float delta=high-low;
  if(high>=${PALETTE_DARK_THRESHOLD}.0/255.0&&delta>=high*${PALETTE_CHROMA_THRESHOLD}){
   float hue=high==rgb.r?(rgb.g-rgb.b)/delta:high==rgb.g?2.0+(rgb.b-rgb.r)/delta:4.0+(rgb.r-rgb.g)/delta;
   float slot=min(${HUES - 1}.0,floor(mod(hue*60.0+360.0,360.0)));
   vec4 swatch=texelFetch(imagePixelInk,ivec2(int(slot),0),0);
   if(swatch.a>.75)rgb=vec3(low)+swatch.rgb*delta;
   else if(swatch.a>.25)rgb=vec3(high);
  }
  return mix(vec3(high),rgb,imagePixelSaturation);
 }
`;
