import * as THREE from 'three';
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
