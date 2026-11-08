import {createSceneCorrection,sceneCorrectionGLSL,sceneCorrectionUniforms} from './normalizationShader.ts';
import {sphereBlendModeIndex} from '../properties/sphereBlendModes.ts';
import * as THREE from 'three';
export type SphereBackground=ReturnType<typeof createSphereBackground>;
/** Per-world render uniforms, driven by the existing serialized appearance properties. */
export function createSphereBackground(){return {
 image:{value:null as THREE.Texture|null}, imageAspect:{value:1},viewportAspect:{value:1},hasImage:{value:0},
 plain:{value:new THREE.Color('#030c15')},resolution:{value:new THREE.Vector2(1,1)},
 correction:createSceneCorrection(),
 enabled:{value:0},strength:{value:.65},mode:{value:0},coverage:{value:1},
};}
export function configureSphereBlend(background:SphereBackground,values?:Record<string,unknown>){
 background.enabled.value=values?.adaptiveBlend===true?1:0;
 background.strength.value=Number(values?.adaptiveBlendStrength??.65);
 background.mode.value=sphereBlendModeIndex(values?.adaptiveBlendMode);
 background.coverage.value=Number(values?.adaptiveBlendCoverage??1);
}
export const sphereBackgroundGLSL=sceneCorrectionGLSL+`
uniform sampler2D sphereBgImage; uniform float sphereBgImageAspect; uniform float sphereBgViewportAspect;
uniform float sphereBgHasImage; uniform vec3 sphereBgPlain;
vec3 sphereBackground(vec2 uv,float bias){
 if(sphereBgHasImage<0.5)return sphereBgPlain;
 vec2 coverUV=uv-0.5;
 if(sphereBgViewportAspect>sphereBgImageAspect)coverUV.y*=sphereBgImageAspect/sphereBgViewportAspect;
 else coverUV.x*=sphereBgViewportAspect/sphereBgImageAspect;
 return correctSceneImage(texture2D(sphereBgImage,coverUV+0.5,bias).rgb);
}`;
export function sphereBackgroundUniforms(state:SphereBackground){return {...sceneCorrectionUniforms(state.correction),
 sphereBgImage:state.image,sphereBgImageAspect:state.imageAspect,sphereBgViewportAspect:state.viewportAspect,
 sphereBgHasImage:state.hasImage,sphereBgPlain:state.plain,
 sphereBlendResolution:state.resolution,sphereBlendEnabled:state.enabled,sphereBlendStrength:state.strength,sphereBlendMode:state.mode,sphereBlendCoverage:state.coverage,
};}
/** Contrast candidates scale the chosen RGB uniformly: hue is not replaced.
 * Smooth contrast-score polarity trades some near-tie contrast for no abrupt switching. */
export function adaptiveSample(rgb:readonly number[],background:readonly number[],alpha:number,opacity:number,translucency:number,strength:number,mode="contrast",coverage=1){
 const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));strength=clamp(strength);
 if(strength===0||alpha<=0||opacity<=0||translucency>=1)return {rgb:[...rgb],alpha};
 alpha=Math.max(alpha,opacity*(1-translucency)*clamp(coverage)*strength);
 if(mode==="normal")return {rgb:[...rgb],alpha};
 if(mode!=="contrast")return {rgb:rgb.map((v,i)=>v+(blendChannel(mode,clamp(v),clamp(background[i]))-v)*strength),alpha};
 const luminance=(c:readonly number[])=>c.reduce((sum,v,i)=>sum+clamp(v)*[.2126,.7152,.0722][i],0),smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const bg=luminance(background),src=luminance(rgb),brightGain=Math.min(6,1/Math.max(...rgb,.0001));
 const bright=luminance(rgb.map(v=>v*brightGain)),dark=luminance(rgb.map(v=>v*.15));
 const light=smooth(-.05,.05,Math.abs(bright-bg)-Math.abs(dark-bg)),gain=.15+(brightGain-.15)*light;
 const target=rgb.map(v=>v*gain),composite=bg+(src-bg)*clamp(alpha),lack=1-smooth(.08,.35,Math.abs(composite-bg)),amount=strength*lack;
 return {rgb:rgb.map((v,i)=>v+(target[i]-v)*amount),alpha};
}
/** Conventional blend colours; the renderer composites them using explicit body coverage. */
export function blendChannel(mode:string,s:number,b:number):number{
 if(mode==='screen')return 1-(1-b)*(1-s);
 if(mode==='multiply')return b*s;
 if(mode==='difference')return Math.abs(b-s);
 if(mode==='softLight'){const d=b<=.25?((16*b-12)*b+4)*b:Math.sqrt(b);return s<=.5?b-(1-2*s)*b*(1-b):b+(2*s-1)*(d-b);}
 return s;
}
export const adaptiveBlendGLSL=`
uniform vec2 sphereBlendResolution; uniform float sphereBlendEnabled; uniform float sphereBlendStrength; uniform float sphereBlendMode; uniform float sphereBlendCoverage;
vec3 sphereSoftLight(vec3 b,vec3 s){
 vec3 d=mix(((16.0*b-12.0)*b+4.0)*b,sqrt(max(b,vec3(0.0))),step(vec3(0.25),b));
 return mix(b-(1.0-2.0*s)*b*(1.0-b),b+(2.0*s-1.0)*(d-b),step(vec3(0.5),s));
}
void adaptiveSphere(inout vec3 color,inout float alpha,float authoredOpacity,float translucency){
 if(sphereBlendEnabled<0.5||sphereBlendStrength<=0.0||alpha<=0.0||authoredOpacity<=0.0||translucency>=1.0)return;
 float strength=clamp(sphereBlendStrength,0.0,1.0);
 // Explicit coverage fills the interior only up to existing authored transparency.
 alpha=max(alpha,authoredOpacity*(1.0-translucency)*clamp(sphereBlendCoverage,0.0,1.0)*strength);
 if(sphereBlendMode==${sphereBlendModeIndex('normal').toFixed(1)})return;
 vec3 bg=clamp(sphereBackground(gl_FragCoord.xy/sphereBlendResolution,2.0),0.0,1.0);
 vec3 source=clamp(color,0.0,1.0),candidate=source;
 if(sphereBlendMode==${sphereBlendModeIndex('softLight').toFixed(1)})candidate=sphereSoftLight(bg,source);
 else if(sphereBlendMode==${sphereBlendModeIndex('difference').toFixed(1)})candidate=abs(bg-source);
 else if(sphereBlendMode==${sphereBlendModeIndex('multiply').toFixed(1)})candidate=bg*source;
 else if(sphereBlendMode==${sphereBlendModeIndex('screen').toFixed(1)})candidate=1.0-(1.0-bg)*(1.0-source);
 else{
  vec3 weights=vec3(0.2126,0.7152,0.0722);
  float backgroundLuma=dot(bg,weights),sourceLuma=dot(source,weights);
  float brightGain=min(6.0,1.0/max(max(max(color.r,color.g),color.b),0.0001));
  float brightLuma=dot(clamp(color*brightGain,0.0,1.0),weights),darkLuma=dot(clamp(color*0.15,0.0,1.0),weights);
  float light=smoothstep(-0.05,0.05,abs(brightLuma-backgroundLuma)-abs(darkLuma-backgroundLuma));
  float gain=mix(0.15,brightGain,light);
  float compositeLuma=mix(backgroundLuma,sourceLuma,clamp(alpha,0.0,1.0));
  float lack=1.0-smoothstep(0.08,0.35,abs(compositeLuma-backgroundLuma));
  color=mix(color,color*gain,strength*lack);return;
 }
 color=mix(color,candidate,strength);
}`;
