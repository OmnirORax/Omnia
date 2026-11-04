import * as THREE from 'three';
import {attachMaterialCoverage,pixelCoverageGLSL} from './materialCoverage.ts';
import type {GlyphVectorPlan} from './omnic/vectorPlan.ts';
/** One instanced draw per eligible glyph; topology/attributes are prepared once.
 * Current SVG viewport is square with xMidYMid meet. Picking stays with its owner. */
export function vectorGlyph(plan:GlyphVectorPlan,initial:{color?:string;opacity?:number;brightness?:number}){
 const base=new THREE.PlaneGeometry(1,1),geometry=new THREE.InstancedBufferGeometry();
 geometry.index=base.index;geometry.attributes=base.attributes;geometry.instanceCount=plan.nodes.length;
 const rect:number[]=[],ends:number[]=[],shape:number[]=[],colors:number[]=[];
 const cx=plan.bounds.x+plan.bounds.width/2,cy=plan.bounds.y+plan.bounds.height/2,span=Math.max(plan.bounds.width,plan.bounds.height);
 for(const n of plan.nodes){
  const radius=n.kind==='line'?0:n.radius,half=n.thickness/2;
  const pad=Math.max(4,(n.kind==='line'?Math.hypot((n.x2??n.x)-n.x,(n.y2??n.y)-n.y):radius)*.125);
  const x2=n.kind==='line'?n.x2??n.x:n.x,y2=n.kind==='line'?n.y2??n.y:n.y;
  rect.push(Math.min(n.x-radius,x2)-half-pad,Math.min(n.y-radius,y2)-half-pad,Math.max(n.x+radius,x2)+half+pad,Math.max(n.y+radius,y2)+half+pad);
  ends.push(n.x,n.y,x2,y2);shape.push(radius,half,n.kind==='line'?(n.cap==='butt'?3:2):n.fill?0:1,n.opacity);
  colors.push(1,1,1);
 }
 for(let i=0;i<rect.length;i++)rect[i]=(rect[i]-(i%2?cy:cx))/span;
 for(let i=0;i<ends.length;i++)ends[i]=(ends[i]-(i%2?cy:cx))/span;
 for(let i=0;i<shape.length;i+=4){shape[i]/=span;shape[i+1]/=span;}
 geometry.setAttribute('glyphRect',new THREE.InstancedBufferAttribute(new Float32Array(rect),4));
 geometry.setAttribute('glyphEnds',new THREE.InstancedBufferAttribute(new Float32Array(ends),4));
 geometry.setAttribute('glyphShape',new THREE.InstancedBufferAttribute(new Float32Array(shape),4));
 const colorAttribute=new THREE.InstancedBufferAttribute(new Float32Array(colors),3);geometry.setAttribute('glyphColor',colorAttribute);
 geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),Math.SQRT1_2);
 const material=new THREE.MeshBasicMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide});
 attachMaterialCoverage(material,target=>{
  const previous=target.onBeforeCompile;
  target.onBeforeCompile=(shader,renderer)=>{
   previous.call(target,shader,renderer);
   shader.vertexShader=`attribute vec4 glyphRect;attribute vec4 glyphEnds;attribute vec4 glyphShape;attribute vec3 glyphColor;
    varying vec2 glyphPoint;varying vec4 glyphLine;varying vec4 glyphParams;varying vec3 glyphInk;varying vec2 glyphViewport;\n`+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    glyphPoint=mix(glyphRect.xy,glyphRect.zw,position.xy+0.5);
    glyphLine=glyphEnds;glyphParams=glyphShape;glyphInk=glyphColor;
    glyphViewport=glyphPoint;
    transformed=vec3(glyphViewport.x,-glyphViewport.y,0.0);`);
   shader.fragmentShader=pixelCoverageGLSL+`varying vec2 glyphPoint;varying vec4 glyphLine;varying vec4 glyphParams;varying vec3 glyphInk;varying vec2 glyphViewport;\n`+shader.fragmentShader.replace('#include <alphatest_fragment>',`
    if(abs(glyphViewport.x)>.5||abs(glyphViewport.y)>.5)discard;
    vec2 gx=dFdx(glyphPoint),gy=dFdy(glyphPoint);
    float coverage;
    if(glyphParams.z<1.5){
      float radius=length(glyphPoint-glyphLine.xy);
      vec2 normal=(glyphPoint-glyphLine.xy)/max(radius,.0000001);
      float dx=dot(normal,gx),dy=dot(normal,gy);
      float outer=pixelCoverage(glyphParams.x+glyphParams.y-radius,dx,dy);
      float inner=glyphParams.z<.5||glyphParams.x<=glyphParams.y?0.:pixelCoverage(glyphParams.x-glyphParams.y-radius,dx,dy);
      coverage=max(0.,outer-inner);
    }else{
      vec2 delta=glyphLine.zw-glyphLine.xy;float len=length(delta);vec2 axis=len>.00001?delta/len:vec2(1.,0.);
      vec2 normal=vec2(-axis.y,axis.x),local=glyphPoint-(glyphLine.xy+glyphLine.zw)*.5;
      float along=dot(local,axis),across=dot(local,normal);
      float nx=dot(normal,gx),ny=dot(normal,gy);
      float sides=pixelCoverage(glyphParams.y-across,nx,ny)-pixelCoverage(-glyphParams.y-across,nx,ny);
      if(glyphParams.z>2.5){
        float ax=dot(axis,gx),ay=dot(axis,gy);
        float caps=pixelCoverage(len*.5-along,ax,ay)-pixelCoverage(-len*.5-along,ax,ay);
        coverage=len<.00001?0.:sides*caps;
      }else if(abs(along)<=len*.5&&len>.00001){
        coverage=sides;
      }else{
        vec2 offset=local-axis*clamp(along,-len*.5,len*.5);
        float radius=length(offset);vec2 capNormal=offset/max(radius,.0000001);
        coverage=pixelCoverage(glyphParams.y-radius,dot(capNormal,gx),dot(capNormal,gy));
      }
      if(glyphParams.y<=0.)coverage=0.;
    }
    diffuseColor.rgb*=glyphInk;diffuseColor.a*=coverage*glyphParams.w;
    #include <alphatest_fragment>`);
  };
  target.customProgramCacheKey=()=> 'omnium.vector-glyph.coverage.v2';
 });
 const mesh=new THREE.Mesh(geometry,material),group=new THREE.Group();group.add(mesh);
 group.userData.vectorGlyph=true;group.userData.primitiveCount=plan.nodes.length;
 group.userData.setAppearance=(appearance:typeof initial)=>{
  const ink=new THREE.Color();plan.nodes.forEach((node,index)=>{ink.set(appearance.color??node.color);colorAttribute.setXYZ(index,ink.r,ink.g,ink.b);});
  colorAttribute.needsUpdate=true;material.color.setRGB(1,1,1).multiplyScalar(appearance.brightness??1);material.opacity=appearance.opacity??1;
 };
 group.userData.setAppearance(initial);return group;
}
