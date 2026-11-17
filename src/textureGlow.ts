import * as T from 'three';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
import {glowScaleGLSL} from './glowScale.ts';
export const TEXT_STEM_PIXELS=3;
/** One existing RGBA texture stores clean coverage and authored halo coverage.
 * Opaque storage avoids canvas premultiplication corrupting the data channels. */
export function packGlowCoverage(clean:Uint8ClampedArray,halo:Uint8ClampedArray){
 if(clean.length!==halo.length||clean.length%4)throw Error('Mismatched glow coverage');
 for(let i=0;i<halo.length;i+=4){const shadow=halo[i+3];halo[i]=clean[i+3];halo[i+1]=shadow;halo[i+2]=0;halo[i+3]=255;}
}
const sizes=new WeakMap<T.Material,{size:{value:T.Vector2};detail:{value:number}}>();
export function updateTextureGlowSize(material:T.MeshBasicMaterial){
 const state=sizes.get(material),image=material.map?.image as {width:number;height:number}|undefined;
 if(state&&image){state.size.value.set(image.width,image.height);state.detail.value=TEXT_STEM_PIXELS/Math.max(1,image.height);}
}
/** Monochrome text keeps its ink in material.color. Both base and emission
 * inherit the same coverage decoder and the shared zoom-fade policy. */
export function packedTextureGlow(material:T.MeshBasicMaterial){
 const state={size:{value:new T.Vector2(1,1)},detail:{value:0}};sizes.set(material,state);updateTextureGlowSize(material);declareGlowDetail(material,state.detail);
 attachMaterialCoverage(material,target=>{
  const before=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   before.call(target,shader,renderer);shader.uniforms.glowTextureSize=state.size;
   const coverage=target===material?`
    vec2 sourceDx=dFdx(vMapUv*glowTextureSize),sourceDy=dFdy(vMapUv*glowTextureSize);
    float sourcePixels=max(length(sourceDx),length(sourceDy));
    float fade=zoomGlowScale(${TEXT_STEM_PIXELS.toFixed(1)}/max(sourcePixels,.00001));
    diffuseColor.a*=mix(coverage.r,coverage.g,fade);
   `:'diffuseColor.a*=coverage.r;';
   shader.fragmentShader='uniform vec2 glowTextureSize;\n'+glowScaleGLSL+'\n'+shader.fragmentShader.replace('#include <map_fragment>',`
    #ifdef USE_MAP
    vec4 coverage=texture2D(map,vMapUv);
    ${coverage}
    #endif
   `);
  };target.customProgramCacheKey=()=>target===material?'omnium.packed-text-glow.base.v1':'omnium.packed-text-glow.mask.v1';
 });
}
