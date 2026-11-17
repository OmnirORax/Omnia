import * as T from 'three';
import {nodeCenter} from './nodeBoundary.ts';
type Point={x:number;y:number};type Viewport={left:number;top:number;width:number;height:number};
export function polygonOverlapsBox(points:readonly Point[],start:Point,end:Point){
 return convexOverlapsBounds(points.map(p=>[p.x,p.y]),[Math.min(start.x,end.x),Math.min(start.y,end.y)],[Math.max(start.x,end.x),Math.max(start.y,end.y)]);
}
/** Cache projected shape bounds until geometry, placement or camera changes. */
export function createNodeOverlap(){const cache=new WeakMap<object,{stamp:string;points:Point[];coordinates:number[][]}>();return(v:Parameters<typeof nodeCenter>[0],camera:T.PerspectiveCamera,rect:Viewport,start:Point,end:Point,scale:number,mode:'line'|'box'='box')=>{
 const mesh=v.contour.hit.visible?v.contour.hit:v.body;mesh.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
 const placement=v.contour.hit.visible?mesh.matrixWorld:mesh.parent?.matrixWorld??mesh.matrixWorld;const stamp=[mesh.geometry.uuid,...placement.elements,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,rect.left,rect.top,rect.width,rect.height,scale].join(',');let saved=cache.get(v);
 if(saved?.stamp!==stamp){const center=nodeCenter(v),world:T.Vector3[]=[];
 if(v.contour.hit.visible)for(const p of v.contour.points)world.push(new T.Vector3(p.x,p.y,0).applyMatrix4(mesh.matrixWorld));
 else{const toward=camera.position.clone().sub(center),d=toward.length(),radius=scale*.5;if(d<=radius)return true;toward.normalize();const tangentCenter=center.clone().addScaledVector(toward,radius*radius/d),tangentRadius=radius*Math.sqrt(1-radius*radius/(d*d)),right=new T.Vector3(0,1,0).cross(toward);if(right.lengthSq()<1e-8)right.set(1,0,0);right.normalize();const up=toward.clone().cross(right);for(let i=0;i<24;i++){const angle=i*Math.PI/12;world.push(tangentCenter.clone().addScaledVector(right,Math.cos(angle)*tangentRadius).addScaledVector(up,Math.sin(angle)*tangentRadius));}}
 const points:Point[]=[];for(const point of world){point.project(camera);if(point.z>=-1&&point.z<=1)points.push({x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2});}saved={stamp,points,coordinates:points.map(p=>[p.x,p.y])};cache.set(v,saved);}
 return mode==='line'?polygonOverlapsLine(saved.points,start,end):convexOverlapsBounds(saved.coordinates,[Math.min(start.x,end.x),Math.min(start.y,end.y)],[Math.max(start.x,end.x),Math.max(start.y,end.y)]);
 };}

/** Shared convex clipping for screen shapes and content inside a depth box. */
export function convexOverlapsBounds(points:readonly (readonly number[])[],low:readonly number[],high:readonly number[]){
 if(!points.length)return false;let contained=true;
 for(let axis=0;axis<low.length;axis++){let min=Infinity,max=-Infinity;for(const p of points){min=Math.min(min,p[axis]);max=Math.max(max,p[axis]);}if(max<low[axis]||min>high[axis])return false;if(min<low[axis]||max>high[axis])contained=false;}if(contained)return true;
 let polygon=points.map(p=>[...p]);for(let axis=0;axis<low.length;axis++)for(const side of [-1,1]){const boundary=side<0?low[axis]:high[axis],next:number[][]=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=side*(a[axis]-boundary)<=1e-9,insideB=side*(b[axis]-boundary)<=1e-9;if(insideA)next.push(a);if(insideA!==insideB){const t=(boundary-a[axis])/(b[axis]-a[axis]);next.push(a.map((n,j)=>n+t*(b[j]-n)));}}polygon=next;if(!polygon.length)return false;}return true;
}
export function polygonOverlapsLine(points:readonly Point[],start:Point,end:Point,tolerance=6){const dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy),x=length?dx/length:1,y=length?dy/length:0;return convexOverlapsBounds(points.map(p=>[(p.x-start.x)*x+(p.y-start.y)*y,-(p.x-start.x)*y+(p.y-start.y)*x]),[-tolerance,-tolerance],[length+tolerance,tolerance]);}
type Volume={center:[number,number,number];right:[number,number,number];up:[number,number,number];forward:[number,number,number];a:[number,number,number];b:[number,number,number]};
export function createNodeVolumeOverlap(){const cache=new WeakMap<object,{stamp:string;points:number[][]}>();return(v:Parameters<typeof nodeCenter>[0],volume:Volume,depth:number,scale:number)=>{
 const low=[Math.min(volume.a[0],volume.b[0]),Math.min(volume.a[1],volume.b[1]),-depth/2],high=[Math.max(volume.a[0],volume.b[0]),Math.max(volume.a[1],volume.b[1]),depth/2],basis=[volume.right,volume.up,volume.forward];
 const project=(p:T.Vector3)=>{const d=p.divideScalar(scale).sub(new T.Vector3(...volume.center));return basis.map(v=>d.x*v[0]+d.y*v[1]+d.z*v[2]);};
 if(!v.contour.hit.visible){const center=project(nodeCenter(v));return center.reduce((sum,n,i)=>sum+Math.max(low[i]-n,0,n-high[i])**2,0)<=.25+1e-9;}
 const mesh=v.contour.hit;mesh.updateWorldMatrix(true,false);const stamp=[mesh.geometry.uuid,...mesh.matrixWorld.elements,...volume.center,...basis.flat(),scale].join(',');let saved=cache.get(v);if(saved?.stamp!==stamp){saved={stamp,points:v.contour.points.map(p=>project(new T.Vector3(p.x,p.y,0).applyMatrix4(mesh.matrixWorld)))};cache.set(v,saved);}return convexOverlapsBounds(saved.points,low,high);
 };}
