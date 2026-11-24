import * as T from 'three';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
export const TEXT_STEM_PIXELS=3;
/** One existing RGBA texture stores clean coverage and authored halo coverage.
 * Opaque storage avoids canvas premultiplication corrupting the data channels. */
export function packGlowCoverage(clean:Uint8ClampedArray,halo:Uint8ClampedArray){
 if(clean.length!==halo.length||clean.length%4)throw Error('Mismatched glow coverage');
 for(let i=0;i<halo.length;i+=4){const shadow=halo[i+3];halo[i]=clean[i+3];halo[i+1]=shadow;halo[i+2]=0;halo[i+3]=255;}
}
const sizes=new WeakMap<T.Material,{detail:{value:number};color:{value:T.Color}}>();
export function updateTextureGlowSize(material:T.MeshBasicMaterial){
 const state=sizes.get(material),image=material.map?.image as {width:number;height:number}|undefined;
 if(state&&image)state.detail.value=TEXT_STEM_PIXELS/Math.max(1,image.height);
}
export function updateTextureGlowColor(material:T.Material,color:T.ColorRepresentation){sizes.get(material)?.color.value.set(color);}
/** Monochrome text keeps its ink in material.color. Both base and emission
 * inherit the same coverage decoder. The authored halo follows filtered texture
 * coverage at every zoom, just as document shadows follow their text. */
export function packedTextureGlow(material:T.MeshBasicMaterial){
 const state={detail:{value:0},color:{value:material.color.clone()}};sizes.set(material,state);updateTextureGlowSize(material);declareGlowDetail(material,state.detail);
 attachMaterialCoverage(material,target=>{
  const before=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   before.call(target,shader,renderer);shader.uniforms.glowInkColor=state.color;
   const coverage=target===material?`
    float clean=coverage.r,halo=max(0.0,coverage.g-clean),total=clean+halo;
    diffuseColor.rgb=(diffuseColor.rgb*clean+glowInkColor*halo)/max(total,.00001);
    diffuseColor.a*=total;
   `:'diffuseColor.a*=coverage.r;';
   shader.fragmentShader='uniform vec3 glowInkColor;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
    vec4 coverage=texture2D(map,vMapUv);
    ${coverage}
    #endif
   `);
  };target.customProgramCacheKey=()=>target===material?'omnium.packed-text-glow.base.v3':'omnium.packed-text-glow.mask.v2';
 });
}
