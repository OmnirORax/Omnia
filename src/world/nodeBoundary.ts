import * as T from 'three';
import type {Point2} from './contentEnvelope.ts';
type Boundary={body:T.Mesh;contour:{hit:T.Mesh;points:readonly Point2[]}};
export function nodeCenter(v:Boundary){const mesh=v.contour.hit.visible?v.contour.hit:v.body;mesh.updateWorldMatrix(true,false);const center=mesh.geometry.boundingSphere?.center??new T.Vector3();return center.clone().applyMatrix4(mesh.matrixWorld);}
export function nodeEdge(v:Boundary,toward:T.Vector3){const mesh=v.contour.hit.visible?v.contour.hit:v.body;mesh.updateWorldMatrix(true,false);const inverse=mesh.matrixWorld.clone().invert(),center=nodeCenter(v).applyMatrix4(inverse),direction=toward.clone().applyMatrix4(inverse).sub(center).normalize();let distance=Infinity;
 if(mesh===v.body){const radius=mesh.geometry.boundingSphere?.radius??.5;distance=radius;}
 else{const points=v.contour.points;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ex=b.x-a.x,ey=b.y-a.y,den=direction.x*ey-direction.y*ex;if(Math.abs(den)<1e-10)continue;const ax=a.x-center.x,ay=a.y-center.y,t=(ax*ey-ay*ex)/den,u=(ax*direction.y-ay*direction.x)/den;if(t>=0&&u>=0&&u<=1)distance=Math.min(distance,t);}}
 return center.addScaledVector(direction,Number.isFinite(distance)?distance:0).applyMatrix4(mesh.matrixWorld);
}
