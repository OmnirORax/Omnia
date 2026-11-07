import {translucentOpacity} from './properties/translucency.ts';
import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1,translucency=.82){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:atomicCarrierOpacity(opacity,translucency),depthWrite:false});
 material.userData.translucency={value:translucency};
 material.onBeforeCompile=shader=>{shader.uniforms.carrierTranslucency=material.userData.translucency;shader.fragmentShader="uniform float carrierTranslucency;\n"+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float carrierFacing = clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0);
float carrierDistance = 1.0 - sqrt(max(0.0, 1.0 - carrierFacing * carrierFacing));
float carrierPixel = clamp(fwidth(carrierDistance), 0.0001, 0.04);
float carrierLight = 1.0 - smoothstep(0.8 * carrierPixel, 1.5 * carrierPixel, carrierDistance);
float carrierRim = 1.0 - smoothstep(2.5 * carrierPixel, 3.5 * carrierPixel, carrierDistance);
outgoingLight = mix(outgoingLight, mix(vec3(0.012), vec3(1.0), carrierLight), carrierRim);
float carrierSurface = mix(pow(1.0-carrierTranslucency, 2.15), 1.0, pow(1.0 - carrierFacing, 3.0));
diffuseColor.a = clamp(diffuseColor.a * mix(carrierSurface, 4.5, carrierRim), 0.0, 1.0);
#include <opaque_fragment>`);};
 material.customProgramCacheKey=()=> 'atomic-bubble-contrast-v3';return material;
}
export const atomicCarrierOpacity=(opacity:number,translucency=.82)=>translucentOpacity(opacity,translucency);
export function updateAtomicCarrier(material:THREE.Material,opacity:number,translucency=.82){material.opacity=atomicCarrierOpacity(opacity,translucency);material.userData.translucency.value=translucency;}
