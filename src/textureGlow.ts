import {paletteStop,type TextPalette} from './properties/textPalette.ts';
import * as T from 'three';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
export const TEXT_STEM_PIXELS=3;
/** One existing RGBA texture stores clean coverage and authored halo coverage.
 * Opaque storage avoids canvas premultiplication corrupting the data channels. */
export function packGlowCoverage(clean:Uint8ClampedArray,halo:Uint8ClampedArray){
 if(clean.length!==halo.length||clean.length%4)throw Error('Mismatched glow coverage');
 for(let i=0;i<halo.length;i+=4){const shadow=halo[i+3];halo[i]=clean[i+3];halo[i+1]=shadow;halo[i+2]=0;halo[i+3]=255;}
}
const sizes=new WeakMap<T.Material,{detail:{value:number};color:{value:T.Color};count:{value:number};stops:{value:T.Vector2[]};paletteKey?:string}>();
export function updateTextureGlowSize(material:T.MeshBasicMaterial){
 const state=sizes.get(material),image=material.map?.image as {width:number;height:number}|undefined;
 if(state&&image)state.detail.value=TEXT_STEM_PIXELS/Math.max(1,image.height);
}
export function updateTextureGlowColor(material:T.Material,color:T.ColorRepresentation){sizes.get(material)?.color.value.set(color);}
const emptyPaletteStops=Array.from({length:8},()=>new T.Vector2()),paletteData=new WeakMap<TextPalette,{key:string;stops:ReturnType<typeof paletteStop>[]}>();
export function updateTextureTextPalette(material:T.Material,palette?:TextPalette){
 const state=sizes.get(material);if(!state)return;let data=palette&&paletteData.get(palette);if(palette&&!data){data={key:JSON.stringify(palette),stops:palette.colors.map(paletteStop)};paletteData.set(palette,data);}const key=data?.key??'';if(state.paletteKey===key)return;state.paletteKey=key;
 const stops=palette?.mode==='text'?data?.stops??[]:[];state.count.value=stops.length;if(!stops.length){state.stops.value=emptyPaletteStops;return;}if(state.stops.value===emptyPaletteStops)state.stops.value=Array.from({length:8},()=>new T.Vector2());for(let i=0;i<8;i++){const stop=stops[i]??stops.at(-1)!;state.stops.value[i].set(stop.hue,stop.saturation);}
}
const paletteShader=`
uniform int textPaletteCount;
uniform vec2 textPaletteStops[8];
vec3 paletteLinear(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 paletteGlow(float x){
 float position=clamp(x,0.0,1.0)*float(textPaletteCount-1);vec2 stop=textPaletteStops[0];
 for(int i=0;i<7;i++){if(i<textPaletteCount-1&&float(i)<=position){vec2 a=textPaletteStops[i],b=textPaletteStops[i+1];float t=clamp(position-float(i),0.0,1.0),delta=b.x-a.x;if(delta>0.5)delta-=1.0;if(delta< -0.5)delta+=1.0;stop=vec2(fract(a.x+delta*t),mix(a.y,b.y,t));}}
 vec3 p=abs(fract(stop.x+vec3(0.0,0.666666667,0.333333333))*6.0-3.0);return mix(vec3(1.0),clamp(p-1.0,0.0,1.0),stop.y);
}
`;
/** Monochrome text keeps its ink in material.color. Both base and emission
 * inherit the same coverage decoder. The authored halo follows filtered texture
 * coverage at every zoom, just as document shadows follow their text. */
export function packedTextureGlow(material:T.MeshBasicMaterial){
 const state={detail:{value:0},color:{value:material.color.clone()},count:{value:0},stops:{value:emptyPaletteStops}};sizes.set(material,state);updateTextureGlowSize(material);declareGlowDetail(material,state.detail);
 attachMaterialCoverage(material,target=>{
  const before=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   before.call(target,shader,renderer);shader.uniforms.glowInkColor=state.color;shader.uniforms.textPaletteCount=state.count;shader.uniforms.textPaletteStops=state.stops;
   const coverage=target===material?`
    float clean=coverage.r,halo=max(0.0,coverage.g-clean),total=clean+halo;
    vec3 ink=diffuseColor.rgb,glow=glowInkColor;
    if(textPaletteCount>1&&total>0.0){vec3 hue=paletteGlow(vMapUv.x);ink=paletteLinear(mix(vec3(1.0),hue,0.25));glow=paletteLinear(hue);}
    diffuseColor.rgb=(ink*clean+glow*halo)/max(total,.00001);
    diffuseColor.a*=total;
   `:'diffuseColor.a*=coverage.r;';
   shader.fragmentShader=paletteShader+'uniform vec3 glowInkColor;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
    // Keep text's fine strokes instead of blending too early into a coarser
    // mip. Half a level retains minification filtering without enlarging the
    // texture, adding taps or sharpening the authored coverage itself.
    vec4 coverage=texture2D(map,vMapUv,${target===material?'-0.5':'0.0'});
    ${coverage}
    #endif
   `);
  };target.customProgramCacheKey=()=>target===material?'omnium.packed-text-glow.base.v5':'omnium.packed-text-glow.mask.v3';
 });
}
