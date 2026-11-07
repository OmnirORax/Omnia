import {sphereBackgroundGLSL,sphereBackgroundUniforms,adaptiveBlendGLSL,type SphereBackground} from './scene/sphereBlend.ts';
import {attachMaterialCoverage} from './materialCoverage.ts';
import {translucentOpacity} from './properties/translucency.ts';
import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1,translucency=.82,glow=1,background?:SphereBackground,translucencyRadius=1){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:atomicCarrierOpacity(opacity,translucency),depthWrite:false});
 material.userData.translucency={value:translucency};
 material.userData.edgeGlow={value:glow};
 material.userData.authoredOpacity={value:opacity};
 material.userData.translucencyRadius={value:translucencyRadius};
 attachMaterialCoverage(material,target=>{
  target.onBeforeCompile=shader=>{
   if(target===material&&background)Object.assign(shader.uniforms,sphereBackgroundUniforms(background));
   shader.uniforms.carrierTranslucency=material.userData.translucency;shader.uniforms.carrierGlow=material.userData.edgeGlow;
   shader.uniforms.carrierAuthoredOpacity=material.userData.authoredOpacity;shader.uniforms.carrierTranslucencyRadius=material.userData.translucencyRadius;
   shader.vertexShader='varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 carrierNormal = normal;
#ifdef USE_INSTANCING
carrierNormal = mat3(instanceMatrix) * carrierNormal;
#endif
carrierViewNormal = normalize(normalMatrix * carrierNormal);`).replace('#include <project_vertex>','#include <project_vertex>\ncarrierViewPosition = -mvPosition.xyz;');
   if(target===material&&background)shader.fragmentShader=sphereBackgroundGLSL+adaptiveBlendGLSL+'\n'+shader.fragmentShader;
   shader.fragmentShader='uniform float carrierTranslucency; uniform float carrierTranslucencyRadius; uniform float carrierAuthoredOpacity; uniform float carrierGlow; varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// Projected radial fraction derived from the actual sphere normal, independent of zoom.
float carrierFacing = clamp(abs(dot(normalize(carrierViewNormal),normalize(carrierViewPosition))),0.0,1.0);
float carrierEdge = pow(1.0-carrierFacing,3.0);
float carrierRadius = sqrt(max(0.0,1.0-carrierFacing*carrierFacing));
float carrierClearRadius = clamp(carrierTranslucencyRadius,0.0,1.0);
// Radius 1 preserves the historical all-surface transmission exactly.
float carrierShell = carrierClearRadius>=1.0?0.0:smoothstep(carrierClearRadius,1.0,carrierRadius);
float carrierLocalTranslucency = carrierTranslucency*(1.0-carrierShell);
float carrierProfile = mix(pow(1.0-carrierLocalTranslucency,2.15),1.0,carrierEdge);
float carrierGain = 1.0 + 2.0 * carrierGlow * carrierEdge;
diffuseColor.a = carrierAuthoredOpacity * min((1.0-carrierLocalTranslucency)*carrierProfile * carrierGain,1.0);
${target===material?'outgoingLight *= 1.0 + carrierGlow * carrierEdge;':''}
${target===material&&background?'adaptiveSphere(outgoingLight,diffuseColor.a,carrierAuthoredOpacity,carrierLocalTranslucency);':''}
#include <opaque_fragment>`);
  };
  target.customProgramCacheKey=()=> `atomic-radial-translucency-v2${target===material&&background?'-adaptive-live-modes-v2':''}`;
 });return material;
}
export const atomicCarrierOpacity=(opacity:number,translucency=.82)=>translucentOpacity(opacity,translucency);
export function updateAtomicCarrier(material:THREE.Material,opacity:number,translucency=.82,glow=1,translucencyRadius=1){
 material.userData.edgeGlow.value=glow;material.opacity=atomicCarrierOpacity(opacity,translucency);material.userData.translucency.value=translucency;
 material.userData.authoredOpacity.value=opacity;material.userData.translucencyRadius.value=translucencyRadius;
}
