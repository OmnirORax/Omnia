import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1,translucency=.82){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:atomicCarrierOpacity(opacity,translucency),depthWrite:false});
 material.userData.translucency={value:translucency};
 material.onBeforeCompile=shader=>{shader.uniforms.carrierTranslucency=material.userData.translucency;shader.fragmentShader="uniform float carrierTranslucency;\n"+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= mix(pow(1.0-carrierTranslucency, 2.15), 1.0, pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0));\n#include <opaque_fragment>');};
 material.customProgramCacheKey=()=> 'atomic-bubble-v2';return material;
}
export const atomicCarrierOpacity=(opacity:number,translucency=.82)=>opacity*(1-translucency);
export function updateAtomicCarrier(material:THREE.Material,opacity:number,translucency=.82){material.opacity=atomicCarrierOpacity(opacity,translucency);material.userData.translucency.value=translucency;}
