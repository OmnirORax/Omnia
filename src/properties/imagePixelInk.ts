import * as T from 'three';
import {nearestPaletteTrait,paletteColorTraits,paletteHueFamily,paletteFamily,paletteRGB,PALETTE_FAMILIES,PALETTE_DARK_THRESHOLD,PALETTE_CHROMA_THRESHOLD} from '../scene/palette.ts';
import type {TextPalette} from './textPalette.ts';

const HUES=360,TONES=256,WIDTH=HUES+TONES;
const MOTIF_REPLACEMENT_ROW=4,MOTIF_FIELD_ROW=6;
export type ImagePixelInk={key:string;texture:T.DataTexture;saturation:number;release:()=>void};
const inkLookup=(p:TextPalette)=>[p.pixelSources??p.colors,p.colors,!!p.inverseOccupation,p.inverseOccupation?p.weights:undefined,p.pixelMotifs?.owners,p.pixelMotifs?.fill];
export const imagePixelInkKey=(p:TextPalette)=>JSON.stringify([...inkLookup(p),p.saturation??1]);
const textures=new Map<string,{texture:T.DataTexture;uses:number}>();

/** Resolve ink once per palette; retain the source beside it for continuous pixel detail. */
export function acquireImagePixelInk(p:TextPalette):ImagePixelInk{
 const sources=p.pixelSources??p.colors,saturation=p.saturation??1;
 const owners=p.pixelMotifs?.owners,fill=p.pixelMotifs?.fill?.families;
 const textureKey=JSON.stringify(inkLookup(p)),key=imagePixelInkKey(p);
 let entry=textures.get(textureKey);
 if(!entry){
  const rgb=sources.map(paletteRGB),traits=rgb.map(paletteColorTraits),colors=p.colors.map(paletteRGB);
  const enabled=new Set(traits.filter(swatch=>swatch.chromatic).map(swatch=>paletteHueFamily(swatch.hue)));
  const order=rgb.map((_,i)=>i).sort((a,b)=>(p.weights?.[b]??1)-(p.weights?.[a]??1));
  const destinations=rgb.map((_,i)=>p.inverseOccupation?order[order.length-1-order.indexOf(i)]:i);
  const rowBytes=WIDTH*4,height=owners?MOTIF_FIELD_ROW+Math.ceil((fill?.length??1)/rowBytes):2;
  const data=new Uint8Array(rowBytes*height);
  if(owners){
   const defaultFamily=owners.length;
   for(let family=0;family<=defaultFamily;family++){
    const owner=family===defaultFamily?0:owners[family];
    if(owner<0)continue;
    const destination=destinations[owner];
    data.set([...colors[destination],255],MOTIF_REPLACEMENT_ROW*rowBytes+family*4);
    data.set([...rgb[owner],destination!==owner?255:0],(MOTIF_REPLACEMENT_ROW+1)*rowBytes+family*4);
   }
   // One byte per source cell, packed four per texel after the ink lookup.
   if(fill)for(let i=0;i<fill.length;i++)data[MOTIF_FIELD_ROW*rowBytes+i]=parseInt(fill[i],16);
   else data[MOTIF_FIELD_ROW*rowBytes]=defaultFamily;
  }
  for(let slot=0;slot<WIDTH;slot++){
   const chromatic=slot<HUES,hue=slot+.5,tone=slot-HUES;
   if(owners){
    const family=chromatic?paletteHueFamily(hue):PALETTE_FAMILIES.indexOf(paletteFamily([tone,tone,tone]));
    const owner=owners[family];
    if(owner>=0){
     const destination=destinations[owner];
     data.set([...colors[destination],255],(WIDTH*2+slot)*4);
     data.set([...rgb[owner],destination!==owner?255:0],(WIDTH*3+slot)*4);
    }
   }
   const nearest=nearestPaletteTrait({chromatic,hue,value:chromatic?1:tone/255},traits);
   const destination=destinations[nearest];
   if(!chromatic&&tone<PALETTE_DARK_THRESHOLD&&traits[nearest].chromatic&&destination===nearest){
    // Without an enabled neutral, keep shadow tones neutral instead of borrowing a vivid hue.
    data.set([tone,tone,tone,255],slot*4);
    continue;
   }
   data.set([...colors[destination],255],slot*4);
   // An excluded hue inherits its selected source's hue before carrying shade detail.
   data.set([...rgb[nearest],p.inverseOccupation&&destination!==nearest?255:traits[nearest].chromatic&&(!chromatic||!enabled.has(paletteHueFamily(hue)))?128:0],(WIDTH+slot)*4);
  }
  const texture=new T.DataTexture(data,WIDTH,height);
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
 int imagePixelSlot(vec3 rgb){
  float high=max(rgb.r,max(rgb.g,rgb.b)),low=min(rgb.r,min(rgb.g,rgb.b));
  float delta=high-low;
  float slot=${HUES}.0+floor(high*255.0+.5);
  if(high>=${PALETTE_DARK_THRESHOLD}.0/255.0&&delta>=high*${PALETTE_CHROMA_THRESHOLD}){
   float hue=high==rgb.r?(rgb.g-rgb.b)/delta:high==rgb.g?2.0+(rgb.b-rgb.r)/delta:4.0+(rgb.r-rgb.g)/delta;
   slot=min(${HUES - 1}.0,floor(mod(hue*60.0+360.0,360.0)));
  }
  return int(slot);
 }
 vec3 resolveImagePixel(vec3 rgb,vec4 mapped,vec4 source){
  float high=max(rgb.r,max(rgb.g,rgb.b)),low=min(rgb.r,min(rgb.g,rgb.b));
  float delta=high-low;
  vec3 ink=mapped.rgb;
  float sourceHigh=max(source.r,max(source.g,source.b)),sourceLow=min(source.r,min(source.g,source.b));
  float sourceDelta=sourceHigh-sourceLow;
  float inkHigh=max(ink.r,max(ink.g,ink.b)),inkLow=min(ink.r,min(ink.g,ink.b));
  vec3 hue=source.a>.75?(ink.rgb-vec3(inkLow))/max(inkHigh-inkLow,.00001):source.a>.25?(source.rgb-vec3(sourceLow))/max(sourceDelta,.00001):(rgb-vec3(low))/max(delta,.00001);
  float saturation=inkHigh>inkLow?min(delta/max(high,.00001)*imagePixelSaturation,1.0):0.0;
  return inkHigh*mix(vec3(1.0),hue,saturation);
 }
 vec3 mapImagePixel(vec3 rgb){
  rgb=clamp(rgb,0.0,1.0);
  int slot=imagePixelSlot(rgb);
  return resolveImagePixel(rgb,texelFetch(imagePixelInk,ivec2(slot,0),0),texelFetch(imagePixelInk,ivec2(slot,1),0));
 }
 vec3 mapMotifPixel(vec4 original,vec3 corrected,vec2 uv,vec2 gridSize){
  int slot=imagePixelSlot(clamp(original.rgb,0.0,1.0));
  vec4 mapped=texelFetch(imagePixelInk,ivec2(slot,2),0);
  if(original.a>=.05&&mapped.a>0.0)return resolveImagePixel(clamp(corrected,0.0,1.0),mapped,texelFetch(imagePixelInk,ivec2(slot,3),0));
  ivec2 cell=ivec2(clamp(floor(uv*gridSize),vec2(0.0),gridSize-1.0));
  int index=cell.y*int(gridSize.x)+cell.x,texel=index/4;
  vec4 encoded=texelFetch(imagePixelInk,ivec2(texel%${WIDTH},${MOTIF_FIELD_ROW}+texel/${WIDTH}),0);
  int family=int(floor(encoded[index%4]*255.0+.5));
  vec4 source=texelFetch(imagePixelInk,ivec2(family,${MOTIF_REPLACEMENT_ROW+1}),0);
  return resolveImagePixel(source.rgb,texelFetch(imagePixelInk,ivec2(family,${MOTIF_REPLACEMENT_ROW}),0),source);
 }
`;
