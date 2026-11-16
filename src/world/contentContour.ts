import * as T from 'three';
import {attachMaterialCoverage,pixelCoverageGLSL} from '../materialCoverage.ts';
import {inkEnvelope,convexHull,type Point2} from './contentEnvelope.ts';
/** Local ink only: geometry, texture masks and their cache stay with each visual. */
export function collectContentHull(root:T.Object3D){
 const points:Point2[]=[];
 const visit=(object:T.Object3D,matrix:T.Matrix4)=>{
  if(!object.visible)return;object.updateMatrix();const local=matrix.clone().multiply(object.matrix),read=object.userData.contentHull as (()=>readonly Point2[])|undefined;
  if(read){for(const p of read()){const q=new T.Vector3(p.x,p.y,0).applyMatrix4(local);points.push({x:q.x,y:q.y});}return;}
  if(object instanceof T.Mesh){object.geometry.computeBoundingBox();const box=object.geometry.boundingBox;if(box)for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const p=new T.Vector3(x,y,z).applyMatrix4(local);points.push({x:p.x,y:p.y});}}
  for(const child of object.children)visit(child,local);
 };
 visit(root,new T.Matrix4());return convexHull(points);
}
export function createContentContour(){
 const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide});
 const stroke={value:.016};
 attachMaterialCoverage(material,target=>{
  const previous=target.onBeforeCompile;target.onBeforeCompile=(shader,renderer)=>{
   previous.call(target,shader,renderer);
   shader.uniforms.contourHalf=stroke;
   shader.vertexShader='attribute float contourDistance;varying float contourEdge;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncontourEdge=contourDistance;');
   shader.fragmentShader=pixelCoverageGLSL+'uniform float contourHalf;varying float contourEdge;\n'+shader.fragmentShader.replace('#include <alphatest_fragment>',`diffuseColor.a*=pixelCoverage(contourHalf-abs(contourEdge),dFdx(contourEdge),dFdy(contourEdge));\n#include <alphatest_fragment>`);
  };target.customProgramCacheKey=()=> 'omnium.content-contour.v1';
 });
 const outline=new T.Mesh(new T.BufferGeometry(),material),hit=new T.Mesh(new T.BufferGeometry(),new T.MeshBasicMaterial({visible:false,side:T.DoubleSide}));
 outline.renderOrder=20;outline.visible=hit.visible=false;let polygon:Point2[]=[];
 return {outline,hit,get points(){return polygon;},
  update(points:readonly Point2[],unit:number){
   const padding=unit*.12,width=unit*.032,fringe=width*2;stroke.value=width/2;
   polygon=inkEnvelope(points,padding+width/2);
   const inner=inkEnvelope(points,padding-fringe),outer=inkEnvelope(points,padding+fringe),vertices:number[]=[],distance:number[]=[],indices:number[]=[];
   for(let n=0;n<outer.length;n++){vertices.push(inner[n].x,inner[n].y,0,outer[n].x,outer[n].y,0);distance.push(-fringe,fringe);const next=(n+1)%outer.length;indices.push(n*2,n*2+1,next*2,n*2+1,next*2+1,next*2);}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('contourDistance',new T.Float32BufferAttribute(distance,1));geometry.setIndex(indices);geometry.computeBoundingSphere();outline.geometry.dispose();outline.geometry=geometry;
   const pick=new T.BufferGeometry(),faces:number[]=[];pick.setAttribute('position',new T.Float32BufferAttribute(polygon.flatMap(p=>[p.x,p.y,0]),3));for(let n=1;n+1<polygon.length;n++)faces.push(0,n,n+1);pick.setIndex(faces);pick.computeBoundingSphere();hit.geometry.dispose();hit.geometry=pick;
   outline.visible=hit.visible=polygon.length>=3;
  },
  dispose(){outline.geometry.dispose();material.dispose();hit.geometry.dispose();hit.material.dispose();},
 };
}
