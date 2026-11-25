import {initializeTextureInkProgression,updateTextureInkProgression,inkProgressionShader} from './textureInkProgression.ts';
import {isFocusPalette,focusPattern,focusPeriod,focusPaletteAxis,isImageField,isFittedField,hasPalettePaint} from './properties/focusPalette.ts';
import {TEXT_EMISSION_THRESHOLD} from './properties/textGlow.ts';
import {generatedTextPalette,GENERATED_PALETTE_SIZE} from './properties/generatedTextPalette.ts';
import {textPaletteStops,paletteLayout,paletteSpread,paletteInk,PALETTE_STOP_LIMIT,type TextPalette} from './properties/textPalette.ts';
import * as T from 'three';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
export const TEXT_STEM_PIXELS=3;
export const textPixelRatio={value:1};
/** One existing RGBA texture stores clean coverage and authored halo coverage.
 * Opaque storage avoids canvas premultiplication corrupting the data channels. */
export function packGlowCoverage(clean:Uint8ClampedArray,halo:Uint8ClampedArray){
 if(clean.length!==halo.length||clean.length%4)throw Error('Mismatched glow coverage');
 for(let i=0;i<halo.length;i+=4){const shadow=halo[i+3];halo[i]=clean[i+3];halo[i+1]=shadow;halo[i+2]=0;halo[i+3]=255;}
}
const sizes=new WeakMap<T.Material,{fitted:{value:number};fieldSize:{value:T.Vector2};field:{value:number};scale:{value:number};debug:{value:number};detail:{value:number};color:{value:T.Color};count:{value:number};stops:{value:T.Vector4[]};layout:{value:number};spread:{value:number};strength:{value:number};generated:{value:number};focus:{value:number};axis:{value:number};period:{value:number};pattern:{value:T.Texture};releasePattern?:()=>void;paletteKey?:string}>();
export function updateTextureGlowSize(material:T.MeshBasicMaterial){
 const state=sizes.get(material),image=material.map?.image as {width:number;height:number}|undefined;
 if(state&&image)state.detail.value=TEXT_STEM_PIXELS/Math.max(1,image.height);
}
export function updateTextureGlowColor(material:T.Material,color:T.ColorRepresentation){sizes.get(material)?.color.value.set(color);}
const emptyPaletteStops=Array.from({length:PALETTE_STOP_LIMIT},()=>new T.Vector4()),paletteData=new WeakMap<TextPalette,{key:string;stops:ReturnType<typeof textPaletteStops>}>();
const emptyPattern=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);emptyPattern.needsUpdate=true;
const patternTextures=new Map<string,{texture:T.DataTexture;refs:number}>();
function acquirePattern(p:TextPalette){const focus=isFocusPalette(p),data=focus?focusPattern(p):generatedTextPalette(p);let entry=patternTextures.get(data.key);if(!entry){const pattern=focus?focusPattern(p):undefined;const texture=new T.DataTexture(data.glow,pattern?.width??GENERATED_PALETTE_SIZE,pattern?.height??GENERATED_PALETTE_SIZE);texture.minFilter=texture.magFilter=T.LinearFilter;texture.wrapS=texture.wrapT=isFittedField(p)?T.ClampToEdgeWrapping:T.RepeatWrapping;texture.needsUpdate=true;entry={texture,refs:0};patternTextures.set(data.key,entry);}entry.refs++;const owned=entry;return {texture:owned.texture,release(){if(!--owned.refs){owned.texture.dispose();patternTextures.delete(data.key);}}};}
export function updateTextureTextPalette(material:T.Material,palette?:TextPalette){
 const state=sizes.get(material);if(!state)return;let data=palette&&paletteData.get(palette);if(palette&&!data){data={key:JSON.stringify(palette),stops:textPaletteStops(palette)};paletteData.set(palette,data);}const key=data?.key??'';if(state.paletteKey===key)return;updateTextureInkProgression(material,palette);state.fitted.value=Number(isFittedField(palette));state.field.value=Number(isImageField(palette));state.scale.value=palette?.scale??1;if(isImageField(palette)){const f=focusPattern(palette!);state.fieldSize.value.set(f.width,f.height);}state.debug.value=Number(!!palette?.debugPattern);state.paletteKey=key;const release=state.releasePattern;state.releasePattern=undefined;state.pattern.value=emptyPattern;state.generated.value=0;state.focus.value=0;state.axis.value=palette?focusPaletteAxis(palette):0;state.strength.value=palette?paletteInk(palette):.25;if(palette&&(isFocusPalette(palette)||palette.pattern==='generated')&&hasPalettePaint(palette)){const pattern=acquirePattern(palette);state.pattern.value=pattern.texture;state.releasePattern=pattern.release;state.generated.value=isFocusPalette(palette)?0:1;state.focus.value=isFocusPalette(palette)?1:0;state.period.value=isFocusPalette(palette)?focusPeriod(palette):1;}
 release?.();const stops=data?.stops??[];state.count.value=stops.length;state.layout.value=palette?paletteLayout(palette):0;state.spread.value=palette?paletteSpread(palette):1;
 if(!stops.length){state.stops.value=emptyPaletteStops;return;}if(state.stops.value===emptyPaletteStops)state.stops.value=Array.from({length:PALETTE_STOP_LIMIT},()=>new T.Vector4());for(let i=0;i<PALETTE_STOP_LIMIT;i++){const stop=stops[i]??stops.at(-1)!;state.stops.value[i].set(...stop.rgb as [number,number,number],stop.at);}
}
const paletteShader=inkProgressionShader+`
uniform bool textPaletteFitted;
uniform bool textPaletteField;
uniform vec2 textFieldSize;
uniform float textFieldScale;
uniform bool textPatternDebug;
uniform int textPaletteCount;
uniform vec4 textPaletteStops[${PALETTE_STOP_LIMIT}];
uniform int textPaletteLayout;
uniform float textPaletteSpread;
uniform float textPaletteInk;
uniform bool textPaletteGenerated;
uniform bool textPaletteFocus;
uniform int textPaletteAxis;
uniform float textPalettePeriod;
uniform float textPixelRatio;
uniform sampler2D textPalettePattern;
vec3 paletteLinear(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
vec3 paletteGlow(vec2 uv,vec4 coverage){
 if(textPaletteFitted)return texture2D(textPalettePattern,clamp(nativeFieldPosition(uv)/textFieldBounds,vec2(0.0),vec2(1.0))).rgb;
 if(textPaletteField)return texture2D(textPalettePattern,fract(textFieldPosition(uv,textPixelRatio)/textFieldSize/textFieldScale)).rgb;
 if(textPaletteFocus){if(textStream)return texture2D(textPalettePattern,vec2(fract(textStreamPosition(uv)),0.5)).rgb;float along=textPaletteAxis==1?1.0-uv.y:uv.x;float pixel=along/max(length(vec2(dFdx(along),dFdy(along))),0.000001)/textPixelRatio;if(textInkScan)pixel=inkScanPosition(uv,coverage,textPixelRatio);return texture2D(textPalettePattern,vec2(fract(pixel/textPalettePeriod),0.5)).rgb;}
 if(textPaletteGenerated)return texture2D(textPalettePattern,vec2(uv.x,1.0-uv.y)).rgb;
 float x=uv.x;if(textPaletteLayout==1)x=1.0-uv.y;else if(textPaletteLayout==2)x=(uv.x+1.0-uv.y)*0.5;else if(textPaletteLayout==3)x=length((uv-0.5)*1.414213562);
 x=clamp(x,0.0,1.0);if(textPaletteSpread>1.0)x=fract(x*textPaletteSpread);
 vec4 a=textPaletteStops[0];vec3 color=a.rgb;
 for(int i=1;i<${PALETTE_STOP_LIMIT};i++){if(i>=textPaletteCount)break;vec4 b=textPaletteStops[i];if(x<b.a){float t=clamp((x-a.a)/max(0.000001,b.a-a.a),0.0,1.0);color=mix(a.rgb,b.rgb,t);break;}a=b;color=b.rgb;}
 return color;
}
`;
/** Monochrome text keeps its ink in material.color. Both base and emission
 * inherit the same coverage decoder. The authored halo follows filtered texture
 * coverage at every zoom, just as document shadows follow their text. */
export function packedTextureGlow(material:T.MeshBasicMaterial){
 const inkUniforms=initializeTextureInkProgression(material);
 const state={fitted:{value:0},field:{value:0},fieldSize:{value:new T.Vector2(1,1)},scale:{value:1},debug:{value:0},detail:{value:0},color:{value:material.color.clone()},count:{value:0},stops:{value:emptyPaletteStops},layout:{value:0},spread:{value:1},strength:{value:.25},generated:{value:0},focus:{value:0},axis:{value:0},period:{value:1},pattern:{value:emptyPattern},releasePattern:undefined as (()=>void)|undefined};material.addEventListener('dispose',()=>{state.releasePattern?.();state.releasePattern=undefined;});sizes.set(material,state);updateTextureGlowSize(material);declareGlowDetail(material,state.detail);
 attachMaterialCoverage(material,target=>{
  const before=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   before.call(target,shader,renderer);Object.assign(shader.uniforms,inkUniforms);shader.uniforms.textPaletteFitted=state.fitted;shader.uniforms.textPaletteField=state.field;shader.uniforms.textFieldSize=state.fieldSize;shader.uniforms.textFieldScale=state.scale;shader.uniforms.textPatternDebug=state.debug;shader.uniforms.glowInkColor=state.color;shader.uniforms.textPaletteCount=state.count;shader.uniforms.textPaletteStops=state.stops;shader.uniforms.textPaletteLayout=state.layout;shader.uniforms.textPaletteSpread=state.spread;shader.uniforms.textPaletteInk=state.strength;shader.uniforms.textPaletteGenerated=state.generated;shader.uniforms.textPaletteFocus=state.focus;shader.uniforms.textPaletteAxis=state.axis;shader.uniforms.textPalettePeriod=state.period;shader.uniforms.textPixelRatio=textPixelRatio;shader.uniforms.textPalettePattern=state.pattern;
   const coverage=target===material?`
    float clean=coverage.r,halo=max(0.0,coverage.g-clean),total=clean+halo;
    vec3 ink=diffuseColor.rgb,glow=glowInkColor;
    if(textPaletteCount>1&&total>0.0){vec3 hue=paletteGlow(vMapUv,coverage);ink=paletteLinear(mix(vec3(1.0),hue,textPaletteInk));glow=paletteLinear(hue);}
    halo*=step(${TEXT_EMISSION_THRESHOLD},max(glow.r,max(glow.g,glow.b)));total=clean+halo;
    diffuseColor.rgb=(ink*clean+glow*halo)/max(total,.00001);
    diffuseColor.a*=total;
    if(textPatternDebug&&textPaletteCount>1){diffuseColor.rgb=paletteLinear(paletteGlow(vMapUv,coverage));diffuseColor.a=max(diffuseColor.a,0.4*opacity);}
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
  };target.customProgramCacheKey=()=>target===material?'omnium.packed-text-glow.base.v17':'omnium.packed-text-glow.mask.v3';
 });
}
