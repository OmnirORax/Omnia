import {attachMaterialCoverage} from './materialCoverage.ts';
import {translucentOpacity} from './properties/translucency.ts';
import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1,translucency=.82,glow=1){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:atomicCarrierOpacity(opacity,translucency),depthWrite:false});
 material.userData.translucency={value:translucency};
 material.userData.edgeGlow={value:glow};
 attachMaterialCoverage(material,target=>{
  target.onBeforeCompile=shader=>{
   shader.uniforms.carrierTranslucency=material.userData.translucency;shader.uniforms.carrierGlow=material.userData.edgeGlow;
   shader.vertexShader='varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 carrierNormal = normal;
#ifdef USE_INSTANCING
carrierNormal = mat3(instanceMatrix) * carrierNormal;
#endif
carrierViewNormal = normalize(normalMatrix * carrierNormal);`).replace('#include <project_vertex>','#include <project_vertex>\ncarrierViewPosition = -mvPosition.xyz;');
   shader.fragmentShader='uniform float carrierTranslucency; uniform float carrierGlow; varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`float carrierEdge = pow(1.0-clamp(abs(dot(normalize(carrierViewNormal),normalize(carrierViewPosition))),0.0,1.0),3.0);
float carrierProfile = mix(pow(1.0-carrierTranslucency,2.15),1.0,carrierEdge);
float carrierGain = 1.0 + 2.0 * carrierGlow * carrierEdge;
diffuseColor.a *= min(carrierProfile * carrierGain,1.0/max(1.0-carrierTranslucency,0.0001));
${target===material?'outgoingLight *= 1.0 + carrierGlow * carrierEdge;':''}
#include <opaque_fragment>`);
  };
  target.customProgramCacheKey=()=> 'atomic-configured-edge-glow-v1';
 });return material;
}
export const atomicCarrierOpacity=(opacity:number,translucency=.82)=>translucentOpacity(opacity,translucency);
export function updateAtomicCarrier(material:THREE.Material,opacity:number,translucency=.82,glow=1){material.userData.edgeGlow.value=glow;material.opacity=atomicCarrierOpacity(opacity,translucency);material.userData.translucency.value=translucency;}
