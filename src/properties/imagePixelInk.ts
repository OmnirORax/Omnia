import * as T from 'three';
import {nearestPaletteTrait,paletteColorTraits,paletteHueFamily,paletteRGB,PALETTE_CHROMA_THRESHOLD} from '../scene/palette.ts';
import type {TextPalette} from './textPalette.ts';

const HUES=360,TONES=256,WIDTH=HUES+TONES;
export type ImagePixelInk={key:string;texture:T.DataTexture;saturation:number;release:()=>void};
export const imagePixelInkKey=(p:TextPalette)=>JSON.stringify([p.pixelSources??p.colors,p.colors,p.saturation??-1,!!p.inverseOccupation,p.inverseOccupation?p.weights:undefined]);
const textures=new Map<string,{texture:T.DataTexture;uses:number}>();

/** Resolve ink once per palette; retain the source beside it for continuous pixel detail. */
export function acquireImagePixelInk(p:TextPalette):ImagePixelInk{
 const sources=p.pixelSources??p.colors,saturation=p.saturation??-1;
 const textureKey=JSON.stringify([sources,p.colors,!!p.inverseOccupation,p.inverseOccupation?p.weights:undefined]),key=imagePixelInkKey(p);
 let entry=textures.get(textureKey);
 if(!entry){
  const rgb=sources.map(paletteRGB),traits=rgb.map(paletteColorTraits),colors=p.colors.map(paletteRGB);
  const enabled=new Set(traits.filter(swatch=>swatch.chromatic).map(swatch=>paletteHueFamily(swatch.hue)));
  const order=rgb.map((_,i)=>i).sort((a,b)=>(p.weights?.[b]??1)-(p.weights?.[a]??1));
  const destinations=rgb.map((_,i)=>p.inverseOccupation?order[order.length-1-order.indexOf(i)]:i);
  const data=new Uint8Array(WIDTH*2*4);
  for(let slot=0;slot<WIDTH;slot++){
   const chromatic=slot<HUES,hue=slot+.5;
   const nearest=nearestPaletteTrait({chromatic,hue,value:chromatic?1:(slot-HUES)/255},traits);
   data.set([...colors[destinations[nearest]],255],slot*4);
   // An excluded hue inherits its selected source's hue before carrying shade detail.
   data.set([...rgb[nearest],p.inverseOccupation&&destinations[nearest]!==nearest?255:traits[nearest].chromatic&&(!chromatic||!enabled.has(paletteHueFamily(hue)))?128:0],(WIDTH+slot)*4);
  }
  const texture=new T.DataTexture(data,WIDTH,2);
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
  float slot=${HUES}.0+floor(high*255.0+.5);
  if(high>0.0&&delta>=high*${PALETTE_CHROMA_THRESHOLD}){
   float hue=high==rgb.r?(rgb.g-rgb.b)/delta:high==rgb.g?2.0+(rgb.b-rgb.r)/delta:4.0+(rgb.r-rgb.g)/delta;
   slot=min(${HUES - 1}.0,floor(mod(hue*60.0+360.0,360.0)));
  }
  vec3 ink=texelFetch(imagePixelInk,ivec2(int(slot),0),0).rgb;
  vec4 source=texelFetch(imagePixelInk,ivec2(int(slot),1),0);
  float sourceHigh=max(source.r,max(source.g,source.b)),sourceLow=min(source.r,min(source.g,source.b));
  float sourceDelta=sourceHigh-sourceLow;
  float inkHigh=max(ink.r,max(ink.g,ink.b)),inkLow=min(ink.r,min(ink.g,ink.b));
  vec3 hue=source.a>.75?(ink.rgb-vec3(inkLow))/max(inkHigh-inkLow,.00001):source.a>.25?(source.rgb-vec3(sourceLow))/max(sourceDelta,.00001):(rgb-vec3(low))/max(delta,.00001);
  float saturation=(inkHigh-inkLow)/max(inkHigh,.00001);
  if(saturation>0.0&&imagePixelSaturation>=0.0)saturation=imagePixelSaturation;
  return inkHigh*mix(vec3(1.0),hue,saturation);
 }
`;
