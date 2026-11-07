import * as THREE from 'three';
import type { Document } from './graph/structural.ts';
import { prepareLattice, cellAt, cellPoint, latticeScale } from './graph/lattice.ts';
/** Camera-relative intent chooses distinct signed world axes; the lattice itself
 * never rotates with the camera. Prepared once at arrow gesture start. */
export function latticeFrame(camera:THREE.Quaternion):THREE.Quaternion {
 const right=new THREE.Vector3(1,0,0).applyQuaternion(camera),up=new THREE.Vector3(0,1,0).applyQuaternion(camera);
 const axes=['x','y','z'] as const;
 const x=axes.reduce((best,axis)=>Math.abs(right[axis])>Math.abs(right[best])?axis:best,'x');
 const remaining=axes.filter(axis=>axis!==x),y=remaining.reduce((best,axis)=>Math.abs(up[axis])>Math.abs(up[best])?axis:best,remaining[0]);
 const a=new THREE.Vector3(),b=new THREE.Vector3();a[x]=Math.sign(right[x])||1;b[y]=Math.sign(up[y])||1;
 return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(a,b,a.clone().cross(b)));
}
/** At most 625 empty O's in one instanced draw. This is a creation slice of the
 * infinite implicit 3D lattice, not persistent nodes or a dense world grid. */
export function createLatticeField(doc:Document,size?:number,scale?:number){
 const index=prepareLattice(doc,size),pitch=index.unit*latticeScale(scale),radius=12,capacity=(radius*2+1)**2;
 const geometry=new THREE.RingGeometry(.4,.5,24),material=new THREE.MeshBasicMaterial({color:0x78c9d4,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
 const object=new THREE.InstancedMesh(geometry,material,capacity);object.frustumCulled=false;object.count=0;
 const matrix=new THREE.Matrix4(),extent=new THREE.Vector3(pitch,pitch,pitch);let stamp='';
 return {object,update(target:THREE.Vector3,camera:THREE.Quaternion){
  if(!Number.isFinite(pitch)||pitch<=0){object.count=0;return;}
  let base;try{base=cellAt(target,pitch);}catch{object.count=0;return;}
  const frame=latticeFrame(camera),a=new THREE.Vector3(1,0,0).applyQuaternion(frame).round(),b=new THREE.Vector3(0,1,0).applyQuaternion(frame).round();
  const next=[base.x,base.y,base.z,...camera.toArray()].join(',');if(next===stamp)return;stamp=next;
  let count=0;
  for(let x=-radius;x<=radius;x++)for(let y=-radius;y<=radius;y++){
   const cell={x:base.x+a.x*x+b.x*y,y:base.y+a.y*x+b.y*y,z:base.z+a.z*x+b.z*y};
   if(index.occupied.has(`${cell.x},${cell.y},${cell.z}`))continue;
   const point=cellPoint(cell,pitch);matrix.compose(new THREE.Vector3(point.x,point.y,point.z),camera,extent);object.setMatrixAt(count++,matrix);
  }
  object.count=count;object.instanceMatrix.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();}};
}
