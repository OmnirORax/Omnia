import type * as THREE from 'three';
/** Runtime shape coverage is shared by the base material and derived glow masks.
 * Shape adapters attach once; no saved metadata, textures or per-frame discovery. */
const coverage=new WeakMap<THREE.Material,(target:THREE.Material)=>void>();
export function attachMaterialCoverage(material:THREE.Material,apply:(target:THREE.Material)=>void){apply(material);coverage.set(material,apply);}
export function inheritMaterialCoverage(source:THREE.Material,target:THREE.Material){coverage.get(source)?.(target);}

/** Area of a locally straight edge over a square pixel. Projecting a pixel onto
 * its normal produces a trapezoidal distribution, not an angle-independent ramp.
 * The piecewise form avoids subtracting nearly equal squared terms. */
export const pixelCoverageGLSL=`
float pixelCoverage(float distance, float dx, float dy){
 float a=max(max(abs(dx),abs(dy)),0.0000001);
 float b=min(abs(dx),abs(dy));
 if(b<a*0.001)return clamp(0.5+distance/a,0.0,1.0);
 float t=abs(distance),h=(a+b)*0.5;
 float tail=t<(a-b)*0.5?0.5-t/a:pow(max(h-t,0.0),2.0)/(2.0*a*b);
 return distance<0.0?tail:1.0-tail;
}
`;

/** Nominal radii are unchanged. The mesh supplies a conservative annular fringe;
 * the circle, stroke and subpixel opacity are evaluated analytically in screen space. */
export function analyticSelectionRing(material:THREE.MeshBasicMaterial){
 attachMaterialCoverage(material,target=>{
  const previous=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   previous.call(target,shader,renderer);
   shader.vertexShader='varying vec2 selectionRingPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nselectionRingPoint=position.xy;');
   shader.fragmentShader=pixelCoverageGLSL+'varying vec2 selectionRingPoint;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`
     float ringRadius=length(selectionRingPoint);
     vec2 normal=selectionRingPoint/max(ringRadius,0.0000001);
     float dx=dot(normal,dFdx(selectionRingPoint)),dy=dot(normal,dFdy(selectionRingPoint));
     float ringOuter=pixelCoverage(1.0-ringRadius,dx,dy);
     float ringInner=pixelCoverage(0.96-ringRadius,dx,dy);
     diffuseColor.a*=max(0.0,ringOuter-ringInner);
     #include <alphatest_fragment>
   `);
  };
  target.customProgramCacheKey=()=> 'omnium.selection-ring.coverage.v2';
 });
}
