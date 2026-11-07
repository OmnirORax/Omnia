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
/** Bounded display sampling across the viewport's intersection with the same
 * fixed lattice slice used for creation. No world cells or nodes are allocated. */
export const LATTICE_FIELD_CAPACITY=16384;
export function createLatticeField(doc:Document,size?:number,scale?:number){
 const index=prepareLattice(doc,size),pitch=index.unit*latticeScale(scale);
 const geometry=new THREE.RingGeometry(.4,.5,24),material=new THREE.MeshBasicMaterial({color:0x78c9d4,transparent:true,opacity:.2,side:THREE.DoubleSide,depthWrite:false});
 const object=new THREE.InstancedMesh(geometry,material,LATTICE_FIELD_CAPACITY);object.frustumCulled=false;object.count=0;
 const matrix=new THREE.Matrix4(),extent=new THREE.Vector3(pitch,pitch,pitch);let stamp='';
 return {object,update(target:THREE.Vector3,camera:THREE.PerspectiveCamera,width=1024,height=width/camera.aspect,orientation?:THREE.Quaternion){
  if(!Number.isFinite(pitch)||pitch<=0){object.count=0;return;}
  let base;try{base=cellAt(target,pitch);}catch{object.count=0;return;}
  camera.updateMatrixWorld();
  const next=[...(orientation?.toArray()??[]),width,height,base.x,base.y,base.z,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(next===stamp)return;stamp=next;
  const frame=orientation??latticeFrame(camera.quaternion),a=new THREE.Vector3(1,0,0).applyQuaternion(frame),b=new THREE.Vector3(0,1,0).applyQuaternion(frame);
  if(!orientation){a.round();b.round();}
  const origin=new THREE.Vector3(base.x*pitch,base.y*pitch,base.z*pitch);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(a.clone().cross(b),origin);
  // Sample the visible screen, then resolve each sample to a real cell on the
  // creation slice. A far-away horizon cannot consume the nearby display budget.
  // Fine cells are sampled at overview density; large cells deduplicate naturally.
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){object.count=0;return;}
  const step=Math.max(8,Math.sqrt(width*height/LATTICE_FIELD_CAPACITY));
  let columns=Math.max(1,Math.floor(width/step)),rows=Math.max(1,Math.floor(height/step));
  while(columns*rows>LATTICE_FIELD_CAPACITY){if(columns>rows)columns--;else rows--;}
  const ray=new THREE.Raycaster(),screen=new THREE.Vector2(),hit=new THREE.Vector3(),seen=new Set<string>();
  let count=0;
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
   screen.set(2*(x+.5)/columns-1,1-2*(y+.5)/rows);ray.setFromCamera(screen,camera);
   if(!ray.ray.intersectPlane(plane,hit))continue;
   const projected=hit.clone().project(camera);if(projected.z< -1||projected.z>1)continue;
   let cell;try{cell=cellAt(hit,pitch);}catch{continue;}
   const key=`${cell.x},${cell.y},${cell.z}`;
   if(seen.has(key)||index.occupied.has(key))continue;seen.add(key);
   const point=cellPoint(cell,pitch),position=new THREE.Vector3(point.x,point.y,point.z);
   matrix.compose(position,camera.quaternion,extent);object.setMatrixAt(count++,matrix);
  }
  object.count=count;object.instanceMatrix.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();}};
}
