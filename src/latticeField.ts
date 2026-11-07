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
 return {object,update(target:THREE.Vector3,camera:THREE.PerspectiveCamera){
  if(!Number.isFinite(pitch)||pitch<=0){object.count=0;return;}
  let base;try{base=cellAt(target,pitch);}catch{object.count=0;return;}
  camera.updateMatrixWorld();
  const next=[base.x,base.y,base.z,...camera.matrixWorld.elements,...camera.projectionMatrix.elements].join(',');
  if(next===stamp)return;stamp=next;
  const frame=latticeFrame(camera.quaternion),a=new THREE.Vector3(1,0,0).applyQuaternion(frame).round(),b=new THREE.Vector3(0,1,0).applyQuaternion(frame).round();
  const origin=new THREE.Vector3(base.x*pitch,base.y*pitch,base.z*pitch);
  const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(a.clone().cross(b),origin);
  const corners:THREE.Vector3[]=[];
  for(const z of [-1,1])for(const y of [-1,1])for(const x of [-1,1])corners.push(new THREE.Vector3(x,y,z).unproject(camera));
  const points:THREE.Vector3[]=[];
  // Clip the slice to all twelve frustum edges, including tilted/horizon views.
  for(let i=0;i<8;i++)for(const bit of [1,2,4]){const j=i^bit;if(j<i)continue;const hit=plane.intersectLine(new THREE.Line3(corners[i],corners[j]),new THREE.Vector3());if(hit)points.push(hit);}
  if(!points.length){object.count=0;return;}
  const xs=points.map(p=>p.clone().sub(origin).dot(a)/pitch),ys=points.map(p=>p.clone().sub(origin).dot(b)/pitch);
  const minX=Math.floor(Math.min(...xs))-1,maxX=Math.ceil(Math.max(...xs))+1,minY=Math.floor(Math.min(...ys))-1,maxY=Math.ceil(Math.max(...ys))+1;
  if(![minX,maxX,minY,maxY].every(Number.isSafeInteger)){object.count=0;return;}
  // At overview density sample real cells uniformly across the entire span,
  // never crop a fixed central patch or enlarge the underlying cell diameter.
  let stride=1;
  const countFor=(step:number)=>(Math.ceil((maxX-minX+1)/step)+1)*(Math.ceil((maxY-minY+1)/step)+1);
  while(countFor(stride)>LATTICE_FIELD_CAPACITY)stride*=2;
  // World-anchored sampling remains stable while panning across cell boundaries.
  const offsetX=base.x*a.x+base.y*a.y+base.z*a.z,offsetY=base.x*b.x+base.y*b.y+base.z*b.z;
  const firstX=Math.ceil((minX+offsetX)/stride)*stride-offsetX,firstY=Math.ceil((minY+offsetY)/stride)*stride-offsetY;
  let count=0;
  for(let x=firstX;x<=maxX;x+=stride)for(let y=firstY;y<=maxY;y+=stride){
   const cell={x:base.x+a.x*x+b.x*y,y:base.y+a.y*x+b.y*y,z:base.z+a.z*x+b.z*y};
   if(!Object.values(cell).every(Number.isSafeInteger)||index.occupied.has(`${cell.x},${cell.y},${cell.z}`))continue;
   const point=cellPoint(cell,pitch),position=new THREE.Vector3(point.x,point.y,point.z),screen=position.clone().project(camera);
   if(screen.z< -1||screen.z>1)continue;
   matrix.compose(position,camera.quaternion,extent);object.setMatrixAt(count++,matrix);
  }
  object.count=count;object.instanceMatrix.needsUpdate=true;
 },dispose(){geometry.dispose();material.dispose();}};
}
