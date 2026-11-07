import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:opacity*.18,depthWrite:false});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a *= mix(0.025, 1.0, pow(1.0 - clamp(abs(dot(normalize(normal), normalize(vViewPosition))), 0.0, 1.0), 3.0));\n#include <opaque_fragment>');};
 material.customProgramCacheKey=()=> 'atomic-bubble-v1';return material;
}
export const atomicCarrierOpacity=(opacity:number)=>opacity*.18;
