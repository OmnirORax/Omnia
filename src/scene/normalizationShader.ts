import * as THREE from 'three';
import type {Corrections} from './normalization.ts';
/** Preview the CPU correction on the original full-resolution texture. */
export function createSceneCorrection(){return {enabled:{value:0},exposure:{value:0},contrast:{value:1},saturation:{value:1},balance:{value:new THREE.Vector3(1,1,1)}};}
export function configureSceneCorrection(state:ReturnType<typeof createSceneCorrection>,value:Corrections|null){
 state.enabled.value=value&&(value.exposure!==0||value.contrast!==1||value.saturation!==1||value.balance.some(v=>v!==1))?1:0;
 state.exposure.value=(value?.exposure??0)*Math.LN2;state.contrast.value=value?.contrast??1;state.saturation.value=value?.saturation??1;state.balance.value.fromArray(value?.balance??[1,1,1]);
}
export const sceneCorrectionUniforms=(state:ReturnType<typeof createSceneCorrection>)=>({sceneCorrectionEnabled:state.enabled,sceneCorrectionExposure:state.exposure,sceneCorrectionContrast:state.contrast,sceneCorrectionSaturation:state.saturation,sceneCorrectionBalance:state.balance});
export const sceneCorrectionGLSL=`
uniform float sceneCorrectionEnabled,sceneCorrectionExposure,sceneCorrectionContrast,sceneCorrectionSaturation;
uniform vec3 sceneCorrectionBalance;
vec3 sceneCorrectionEncode(vec3 c){return mix(c*12.92,1.055*pow(max(c,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),c));}
vec3 sceneCorrectionDecode(vec3 c){return mix(c/12.92,pow((c+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),c));}
float sceneCorrectionGamut(float c,float y){return c>0.0?(1.0-y)/c:c<0.0?-y/c:1.0;}
vec3 correctSceneImage(vec3 source){
 if(sceneCorrectionEnabled<0.5)return source;
 // Match source-byte interpretation, tone/chroma equations and quantization of the CPU output.
 vec3 source8=floor(sceneCorrectionEncode(clamp(source,0.0,1.0))*255.0+0.5);
 vec3 rgb=sceneCorrectionDecode(source8/255.0),weights=vec3(0.2126,0.7152,0.0722);
 float y=dot(rgb,weights);vec3 balanced=rgb*sceneCorrectionBalance;float by=dot(balanced,weights);
 balanced*=by>0.0?y/by:0.0;
 float safe=clamp(y,0.00000001,0.99999999);
 float mapped=y<=0.0?0.0:y>=1.0?1.0:1.0/(1.0+exp(-(log(safe/(1.0-safe))*sceneCorrectionContrast+sceneCorrectionExposure)));
 vec3 chroma=(balanced-y)*(y>0.0?mapped/y:0.0)*sceneCorrectionSaturation;
 float gamut=min(1.0,min(sceneCorrectionGamut(chroma.r,mapped),min(sceneCorrectionGamut(chroma.g,mapped),sceneCorrectionGamut(chroma.b,mapped))));
 vec3 output8=floor(sceneCorrectionEncode(clamp(mapped+chroma*gamut,0.0,1.0))*255.0+0.5);
 output8=clamp(output8,step(vec3(0.5),source8),vec3(254.0)+step(vec3(254.5),source8));
 return sceneCorrectionDecode(output8/255.0);
}`;
