import * as T from 'three';
import {nearestPaletteTrait,paletteColorTraits,paletteRGB,PALETTE_DARK_THRESHOLD,PALETTE_CHROMA_THRESHOLD} from '../scene/palette.ts';
import type {TextPalette} from './textPalette.ts';

const HUES=360;
const TONES=256;
const WIDTH=HUES+TONES;
const keyFor=(p:TextPalette)=>JSON.stringify([p.pixelSources??p.colors,p.colors]);
export type ImagePixelInk={key:string;texture:T.DataTexture;release:()=>void};
const textures=new Map<string,{texture:T.DataTexture;uses:number}>();

/** Match the measured pixel to the original swatch before applying saturation or Pale ink. */
export function acquireImagePixelInk(p:TextPalette):ImagePixelInk{
 const key=keyFor(p);
 let entry=textures.get(key);
 if(!entry){
  const tones=(p.pixelSources??p.colors).map(color=>paletteColorTraits(paletteRGB(color)));
  const colors=p.colors.map(paletteRGB);
  const data=new Uint8Array(WIDTH*4);
  for(let slot=0;slot<WIDTH;slot++){
   const chromatic=slot<HUES;
   const nearest=nearestPaletteTrait({chromatic,hue:slot+.5,value:chromatic?1:(slot-HUES)/255},tones);
   data.set(colors[nearest],slot*4);data[slot*4+3]=255;
  }
  const texture=new T.DataTexture(data,WIDTH,1);
  texture.needsUpdate=true;
  entry={texture,uses:0};textures.set(key,entry);
 }
 entry.uses++;
 const owned=entry;
 return {key,texture:owned.texture,release(){if(!--owned.uses){owned.texture.dispose();textures.delete(key);}}};
}

export const imagePixelInkGLSL=`
 uniform sampler2D imagePixelInk;
 vec3 mapImagePixel(vec3 rgb){
  rgb=clamp(rgb,0.0,1.0);
  float high=max(rgb.r,max(rgb.g,rgb.b)),low=min(rgb.r,min(rgb.g,rgb.b));
  float delta=high-low;
  float slot=${HUES}.0+floor(high*255.0+.5);
  if(high>=${PALETTE_DARK_THRESHOLD}.0/255.0&&delta>=high*${PALETTE_CHROMA_THRESHOLD}){
   float hue=high==rgb.r?(rgb.g-rgb.b)/delta:high==rgb.g?2.0+(rgb.b-rgb.r)/delta:4.0+(rgb.r-rgb.g)/delta;
   slot=min(${HUES - 1}.0,floor(mod(hue*60.0+360.0,360.0)));
  }
  return texelFetch(imagePixelInk,ivec2(int(slot),0),0).rgb;
 }
`;
