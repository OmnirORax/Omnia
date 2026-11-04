import type * as THREE from 'three';
/** Runtime shape coverage is shared by the base material and derived glow masks.
 * Shape adapters attach once; no saved metadata, textures or per-frame discovery. */
const coverage=new WeakMap<THREE.Material,(target:THREE.Material)=>void>();
export function attachMaterialCoverage(material:THREE.Material,apply:(target:THREE.Material)=>void){apply(material);coverage.set(material,apply);}
export function inheritMaterialCoverage(source:THREE.Material,target:THREE.Material){coverage.get(source)?.(target);}

/** Nominal radii are unchanged. The mesh supplies a conservative annular fringe;
 * the circle, stroke and subpixel opacity are evaluated analytically in screen space. */
export function analyticSelectionRing(material:THREE.MeshBasicMaterial){
 attachMaterialCoverage(material,target=>{
  const previous=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   previous.call(target,shader,renderer);
   shader.vertexShader='varying vec2 selectionRingPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nselectionRingPoint=position.xy;');
   shader.fragmentShader='varying vec2 selectionRingPoint;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
     float ringRadius=length(selectionRingPoint);
     float ringPixel=max(length(vec2(dFdx(ringRadius),dFdy(ringRadius))),0.00001);
     float ringOuter=clamp((1.0-ringRadius)/ringPixel+0.5,0.0,1.0);
     float ringInner=clamp((0.96-ringRadius)/ringPixel+0.5,0.0,1.0);
     diffuseColor.a*=max(0.0,ringOuter-ringInner);
     #include <alphatest_fragment>
   `);
  };
  target.customProgramCacheKey=()=> 'omnium.selection-ring.coverage.v1';
 });
}
