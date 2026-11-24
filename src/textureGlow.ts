import * as T from 'three';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
import {gradientPixels,GRADIENT_SAMPLES,TEXT_KEYLINE,type TextGradient} from './properties/textGradient.ts';
export const TEXT_STEM_PIXELS=3;
/** One existing RGBA texture stores clean coverage and authored halo coverage.
 * Opaque storage avoids canvas premultiplication corrupting the data channels. */
export function packGlowCoverage(clean:Uint8ClampedArray,halo:Uint8ClampedArray,width=0){
 if(clean.length!==halo.length||clean.length%4)throw Error('Mismatched glow coverage');
 // Blue stores a one-texel keyline in the same allocation. Read the complete
 // clean mask before writing because zero-glow callers may lend the same array.
 const source=width&&clean===halo?clean.slice():clean;
 for(let i=0;i<halo.length;i+=4){const shadow=halo[i+3],alpha=source[i+3],x=i/4%width;
  halo[i]=alpha;halo[i+1]=shadow;halo[i+2]=width?Math.max(alpha,x>0?source[i-1]:0,x<width-1?source[i+7]:0,source[i-width*4+3]??0,source[i+width*4+3]??0):0;halo[i+3]=255;
 }
}
const palettes=new Map<string,{texture:T.DataTexture;refs:number}>();
const sizes=new WeakMap<T.Material,{detail:{value:number};color:{value:T.Color};gradient:{value:T.DataTexture|null};enabled:{value:number};key?:string}>();
export function updateTextureGradient(material:T.Material,gradient:TextGradient|null){
 const state=sizes.get(material);if(!state)return;const key=gradient?JSON.stringify(gradient):undefined;if(key===state.key)return;
 if(state.key){const entry=palettes.get(state.key)!;if(--entry.refs===0){entry.texture.dispose();palettes.delete(state.key);}}
 state.key=key;state.enabled.value=gradient?1:0;state.gradient.value=null;
 if(key&&gradient){let entry=palettes.get(key);if(!entry){const texture=new T.DataTexture(gradientPixels(gradient),GRADIENT_SAMPLES,2,T.RGBAFormat);texture.colorSpace=T.SRGBColorSpace;texture.minFilter=texture.magFilter=T.LinearFilter;texture.needsUpdate=true;entry={texture,refs:0};palettes.set(key,entry);}entry.refs++;state.gradient.value=entry.texture;}
}
export function updateTextureGlowSize(material:T.MeshBasicMaterial){
 const state=sizes.get(material),image=material.map?.image as {width:number;height:number}|undefined;
 if(state&&image)state.detail.value=TEXT_STEM_PIXELS/Math.max(1,image.height);
}
export function updateTextureGlowColor(material:T.Material,color:T.ColorRepresentation){sizes.get(material)?.color.value.set(color);}
/** Monochrome text keeps its ink in material.color. Both base and emission
 * inherit the same coverage decoder. The authored halo follows filtered texture
 * coverage at every zoom, just as document shadows follow their text. */
export function packedTextureGlow(material:T.MeshBasicMaterial){
 const state={detail:{value:0},color:{value:material.color.clone()},gradient:{value:null as T.DataTexture|null},enabled:{value:0}};sizes.set(material,state);updateTextureGlowSize(material);declareGlowDetail(material,state.detail);
 material.addEventListener('dispose',()=>{updateTextureGradient(material,null);sizes.delete(material);});
 attachMaterialCoverage(material,target=>{
  const before=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   before.call(target,shader,renderer);shader.uniforms.glowInkColor=state.color;shader.uniforms.textGradient=state.gradient;shader.uniforms.textGradientEnabled=state.enabled;
   const coverage=target===material?`
    float clean=coverage.r,halo=max(0.0,coverage.g-clean),total=clean+halo;
    diffuseColor.rgb=(diffuseColor.rgb*clean+glowInkColor*halo)/max(total,.00001);
    if(textGradientEnabled>.5){
     float x=(.5+clamp(vMapUv.x,0.,1.)*${(GRADIENT_SAMPLES-1).toFixed(1)})/${GRADIENT_SAMPLES.toFixed(1)};
     vec3 ink=texture2D(textGradient,vec2(x,.25)).rgb,glow=texture2D(textGradient,vec2(x,.75)).rgb;
     float keyline=max(0.,coverage.b-clean),visibleHalo=halo*(1.-clean-keyline);
     total=clean+keyline+visibleHalo;
     diffuseColor.rgb=(ink*clean+vec3(${new T.Color(TEXT_KEYLINE).toArray().join(',')})*keyline+glow*visibleHalo)/max(total,.00001);
    }
    diffuseColor.a*=total;
   `:'diffuseColor.a*=coverage.r;';
   shader.fragmentShader='uniform vec3 glowInkColor; uniform sampler2D textGradient; uniform float textGradientEnabled;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
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
