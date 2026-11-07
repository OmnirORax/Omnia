import * as THREE from 'three';
export type SphereBackground=ReturnType<typeof createSphereBackground>;
/** Per-view uniforms; never global and never saved as authored node appearance. */
export function createSphereBackground(){return {
 image:{value:null as THREE.Texture|null}, imageAspect:{value:1},viewportAspect:{value:1},hasImage:{value:0},pattern:{value:0},
 plain:{value:new THREE.Color('#030c15')},hue:{value:new THREE.Color('#0044ff')},resolution:{value:new THREE.Vector2(1,1)},
 enabled:{value:0},strength:{value:.65},
};}
export const sphereBackgroundGLSL=`
uniform sampler2D sphereBgImage; uniform float sphereBgImageAspect; uniform float sphereBgViewportAspect;
uniform float sphereBgHasImage; uniform float sphereBgPattern; uniform vec3 sphereBgPlain; uniform vec3 sphereBgHue;
vec3 sphereBackground(vec2 uv,float bias){
 if(sphereBgPattern>3.5){float stripe=0.5+0.5*sin(uv.x*31.0+sin(uv.y*19.0)*2.0);return mix(vec3(0.005),mix(vec3(0.9,0.3,0.02),vec3(0.2,0.04,0.8),uv.y),stripe);}
 if(sphereBgPattern>2.5)return sphereBgHue;
 if(sphereBgPattern>1.5)return vec3(0.85);
 if(sphereBgPattern>0.5)return vec3(0.002);
 if(sphereBgHasImage<0.5)return sphereBgPlain;
 vec2 coverUV=uv-0.5;
 if(sphereBgViewportAspect>sphereBgImageAspect)coverUV.y*=sphereBgImageAspect/sphereBgViewportAspect;
 else coverUV.x*=sphereBgViewportAspect/sphereBgImageAspect;
 return texture2D(sphereBgImage,coverUV+0.5,bias).rgb;
}`;
export function sphereBackgroundUniforms(state:SphereBackground){return {
 sphereBgImage:state.image,sphereBgImageAspect:state.imageAspect,sphereBgViewportAspect:state.viewportAspect,
 sphereBgHasImage:state.hasImage,sphereBgPattern:state.pattern,sphereBgPlain:state.plain,sphereBgHue:state.hue,
 sphereBlendResolution:state.resolution,sphereBlendEnabled:state.enabled,sphereBlendStrength:state.strength,
};}
/** Contrast candidates scale the chosen RGB uniformly: hue is not replaced.
 * Smooth contrast-score polarity trades some near-tie contrast for no abrupt switching. */
export function adaptiveSample(rgb:readonly number[],background:readonly number[],alpha:number,opacity:number,translucency:number,strength:number){
 const clamp=(n:number,a=0,b=1)=>Math.min(b,Math.max(a,n));strength=clamp(strength);
 if(strength===0||alpha<=0||opacity<=0||translucency>=1)return {rgb:[...rgb],alpha};
 const luminance=(c:readonly number[])=>c.reduce((sum,v,i)=>sum+clamp(v)*[.2126,.7152,.0722][i],0),smooth=(a:number,b:number,x:number)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
 const bg=luminance(background),src=luminance(rgb),brightGain=Math.min(6,1/Math.max(...rgb,.0001));
 const bright=luminance(rgb.map(v=>v*brightGain)),dark=luminance(rgb.map(v=>v*.15));
 const light=smooth(-.05,.05,Math.abs(bright-bg)-Math.abs(dark-bg)),gain=.15+(brightGain-.15)*light;
 const target=rgb.map(v=>v*gain),composite=bg+(src-bg)*clamp(alpha),lack=1-smooth(.08,.35,Math.abs(composite-bg)),amount=strength*lack;
 return {rgb:rgb.map((v,i)=>v+(target[i]-v)*amount),alpha:alpha+(Math.max(alpha,opacity*Math.min(.6,(1-translucency)*3)*strength)-alpha)*lack};
}
export const adaptiveBlendGLSL=`
uniform vec2 sphereBlendResolution; uniform float sphereBlendEnabled; uniform float sphereBlendStrength;
void adaptiveSphere(inout vec3 color,inout float alpha,float authoredOpacity,float translucency){
 if(sphereBlendEnabled<0.5||sphereBlendStrength<=0.0||alpha<=0.0||authoredOpacity<=0.0||translucency>=1.0)return;
 vec3 bg=sphereBackground(gl_FragCoord.xy/sphereBlendResolution,2.0);
 vec3 weights=vec3(0.2126,0.7152,0.0722);
 float backgroundLuma=dot(clamp(bg,0.0,1.0),weights),sourceLuma=dot(clamp(color,0.0,1.0),weights);
 float brightGain=min(6.0,1.0/max(max(max(color.r,color.g),color.b),0.0001));
 float brightLuma=dot(clamp(color*brightGain,0.0,1.0),weights),darkLuma=dot(clamp(color*0.15,0.0,1.0),weights);
 float light=smoothstep(-0.05,0.05,abs(brightLuma-backgroundLuma)-abs(darkLuma-backgroundLuma));
 float gain=mix(0.15,brightGain,light);
 float compositeLuma=mix(backgroundLuma,sourceLuma,clamp(alpha,0.0,1.0));
 float lack=1.0-smoothstep(0.08,0.35,abs(compositeLuma-backgroundLuma));
 float strength=clamp(sphereBlendStrength,0.0,1.0);
 color=mix(color,color*gain,strength*lack);
 float ceiling=max(alpha,authoredOpacity*min(0.6,(1.0-translucency)*3.0)*strength);
 alpha=mix(alpha,ceiling,lack);
}`;
