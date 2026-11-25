import {glowScaleGLSL} from './glowScale.ts';
import {SPHERE_VISUAL_DEFAULTS} from './properties/sphereVisualDefaults.ts';
import {attachMaterialCoverage,declareGlowDetail} from './materialCoverage.ts';
import {boundaryTransmissionGLSL,translucentOpacity} from './properties/translucency.ts';
import * as THREE from 'three';
/** One carrier appearance for saved nodes and creation previews. Nearly clear
 * at the centre, with a translucent rim from the actual sphere surface normal. */
export function atomicCarrierGeometry(diameter=1){return new THREE.SphereGeometry(diameter/2,24,16);}
export function atomicCarrierMaterial(color:THREE.ColorRepresentation,opacity=1,translucency:number=SPHERE_VISUAL_DEFAULTS.translucency,glow:number=SPHERE_VISUAL_DEFAULTS.glow,translucencyRadius:number=SPHERE_VISUAL_DEFAULTS.translucencyRadius){
 const material=new THREE.MeshPhongMaterial({color,transparent:true,opacity:atomicCarrierOpacity(opacity,translucency),depthWrite:false});
 // A plain sphere has one rim, not a tightly packed pattern. Its detail is
 // the whole diameter; rim thickness alone must not extinguish a large node.
 declareGlowDetail(material,1);
 material.userData.translucency={value:translucency};
 material.userData.edgeGlow={value:glow};
 material.userData.authoredOpacity={value:opacity};
 material.userData.translucencyRadius={value:translucencyRadius};
 attachMaterialCoverage(material,target=>{
  target.onBeforeCompile=shader=>{
   shader.uniforms.carrierTranslucency=material.userData.translucency;shader.uniforms.carrierGlow=material.userData.edgeGlow;
   shader.uniforms.carrierAuthoredOpacity=material.userData.authoredOpacity;shader.uniforms.carrierTranslucencyRadius=material.userData.translucencyRadius;
   shader.vertexShader='varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec3 carrierNormal = normal;
#ifdef USE_INSTANCING
carrierNormal = mat3(instanceMatrix) * carrierNormal;
#endif
carrierViewNormal = normalize(normalMatrix * carrierNormal);`).replace('#include <project_vertex>','#include <project_vertex>\ncarrierViewPosition = -mvPosition.xyz;');
   shader.fragmentShader=glowScaleGLSL+boundaryTransmissionGLSL+'\n'+'uniform float carrierTranslucency; uniform float carrierTranslucencyRadius; uniform float carrierAuthoredOpacity; uniform float carrierGlow; varying vec3 carrierViewNormal; varying vec3 carrierViewPosition;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`// Projected radial fraction derived from the actual sphere normal, independent of zoom.
float carrierFacing = clamp(abs(dot(normalize(carrierViewNormal),normalize(carrierViewPosition))),0.0,1.0);
float carrierEdge = boundaryEdge(carrierFacing);
float carrierRadius = sqrt(max(0.0,1.0-carrierFacing*carrierFacing));
float carrierClearRadius = clamp(carrierTranslucencyRadius,0.0,1.0);
float carrierPixelSpan=max(abs(dFdx(carrierRadius)),abs(dFdy(carrierRadius)));
float carrierVisibleGlow=carrierGlow*zoomGlowScale(2.0/max(carrierPixelSpan,.00001));
float carrierGain = 1.0 + 2.0 * carrierVisibleGlow * carrierEdge;
diffuseColor.a = carrierAuthoredOpacity * min(boundaryTransmission(carrierTranslucency,carrierClearRadius,carrierRadius,carrierEdge) * carrierGain,1.0);
${target===material?'outgoingLight *= 1.0 + carrierVisibleGlow * carrierEdge;':''}
#include <opaque_fragment>`);
  };
  target.customProgramCacheKey=()=> 'atomic-radial-translucency-v5';
 });return material;
}
export const atomicCarrierOpacity=(opacity:number,translucency:number=SPHERE_VISUAL_DEFAULTS.translucency)=>translucentOpacity(opacity,translucency);
export function updateAtomicCarrier(material:THREE.Material,opacity:number,translucency:number=SPHERE_VISUAL_DEFAULTS.translucency,glow:number=SPHERE_VISUAL_DEFAULTS.glow,translucencyRadius:number=SPHERE_VISUAL_DEFAULTS.translucencyRadius){
 material.userData.edgeGlow.value=glow;material.opacity=atomicCarrierOpacity(opacity,translucency);material.userData.translucency.value=translucency;
 material.userData.authoredOpacity.value=opacity;material.userData.translucencyRadius.value=translucencyRadius;
}
