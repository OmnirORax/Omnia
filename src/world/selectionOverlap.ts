import * as T from 'three';
import {nodeCenter} from './nodeBoundary.ts';
type Point={x:number;y:number};type Viewport={left:number;top:number;width:number;height:number};
export function polygonOverlapsBox(points:readonly Point[],start:Point,end:Point){
 if(!points.length)return false;const l=Math.min(start.x,end.x),r=Math.max(start.x,end.x),t=Math.min(start.y,end.y),b=Math.max(start.y,end.y);
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}if(maxX<l||minX>r||maxY<t||minY>b)return false;
 if(points.some(p=>p.x>=l&&p.x<=r&&p.y>=t&&p.y<=b))return true;
 let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],q=points[j];if((a.y>t)!==(q.y>t)&&l<(q.x-a.x)*(t-a.y)/(q.y-a.y)+a.x)inside=!inside;}if(inside)return true;
 for(let i=0;i<points.length;i++){const a=points[i],q=points[(i+1)%points.length],dx=q.x-a.x,dy=q.y-a.y;let lo=0,hi=1;for(const [p,v]of [[-dx,a.x-l],[dx,r-a.x],[-dy,a.y-t],[dy,b-a.y]]){if(!p){if(v<0){hi=-1;break;}}else if(p<0)lo=Math.max(lo,v/p);else hi=Math.min(hi,v/p);}if(lo<=hi)return true;}return false;
}
/** Cache projected shape bounds until geometry, placement or camera changes. */
export function createNodeOverlap(){const cache=new WeakMap<object,{stamp:string;points:Point[]}>();return(v:Parameters<typeof nodeCenter>[0],camera:T.PerspectiveCamera,rect:Viewport,start:Point,end:Point,scale:number)=>{
 const mesh=v.contour.hit.visible?v.contour.hit:v.body;mesh.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);
 const placement=v.contour.hit.visible?mesh.matrixWorld:mesh.parent?.matrixWorld??mesh.matrixWorld;const stamp=[mesh.geometry.uuid,...placement.elements,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,rect.left,rect.top,rect.width,rect.height,scale].join(',');let saved=cache.get(v);
 if(saved?.stamp!==stamp){const center=nodeCenter(v),world:T.Vector3[]=[];
 if(v.contour.hit.visible)for(const p of v.contour.points)world.push(new T.Vector3(p.x,p.y,0).applyMatrix4(mesh.matrixWorld));
 else{const toward=camera.position.clone().sub(center),d=toward.length(),radius=scale*.5;if(d<=radius)return true;toward.normalize();const tangentCenter=center.clone().addScaledVector(toward,radius*radius/d),tangentRadius=radius*Math.sqrt(1-radius*radius/(d*d)),right=new T.Vector3(0,1,0).cross(toward);if(right.lengthSq()<1e-8)right.set(1,0,0);right.normalize();const up=toward.clone().cross(right);for(let i=0;i<24;i++){const angle=i*Math.PI/12;world.push(tangentCenter.clone().addScaledVector(right,Math.cos(angle)*tangentRadius).addScaledVector(up,Math.sin(angle)*tangentRadius));}}
 const points:Point[]=[];for(const point of world){point.project(camera);if(point.z>=-1&&point.z<=1)points.push({x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2});}saved={stamp,points};cache.set(v,saved);}
 return polygonOverlapsBox(saved.points,start,end);
 };}
