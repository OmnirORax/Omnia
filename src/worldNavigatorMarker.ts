import * as THREE from 'three';
import {analyticSelectionRing} from './materialCoverage.ts';
/** A non-pickable navigator, with a camera-facing ring and a single end-to-end orientation
 * compass. It is deliberately excluded from all graph hit inventories. */
export function createWorldNavigatorMarker(){
 const object=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0x40dcff,transparent:true,opacity:.85,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
 analyticSelectionRing(material);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.835,1.125,64),material);object.add(ring);
 const ink=new THREE.LineBasicMaterial({color:0x40dcff,transparent:true,opacity:.9,depthWrite:false,depthTest:false});
 const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0)]);
 const diameter=new THREE.LineSegments(geometry,ink);object.add(diameter);
 let compassOrientation:THREE.Quaternion|undefined;
 const projectCompass=(orientation:THREE.Quaternion)=>{
  if(compassOrientation?.equals(orientation))return;
  compassOrientation=orientation.clone();const inverse=orientation.clone().invert(),attribute=geometry.getAttribute('position') as THREE.BufferAttribute;
  const direction=new THREE.Vector3(1,0,0).applyQuaternion(inverse);direction.z=0;
  // Keep a full diameter. An exactly end-on axis retains its last direction.
  if(direction.lengthSq()<1e-12)return;direction.normalize();
  attribute.setXYZ(0,-direction.x,-direction.y,0);attribute.setXYZ(1,direction.x,direction.y,0);
  attribute.needsUpdate=true;geometry.computeBoundingSphere();
 };
 const center=new THREE.Mesh(new THREE.CircleGeometry(.09,24),new THREE.MeshBasicMaterial({color:0x40dcff,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));object.add(center);
 object.traverse(item=>{item.renderOrder=1000;});object.visible=false;
 return {object,update(position:THREE.Vector3,orientation:THREE.Quaternion,pitch:number,visible:boolean,valid=true,style={color:"#40dcff",opacity:.85,glow:0}){const color=valid?style.color:"#e46868";material.color.set(color);ink.color.set(color);center.material.color.set(color);projectCompass(orientation);material.opacity=style.opacity;ink.opacity=style.opacity;center.material.transparent=true;center.material.opacity=style.opacity;for(const item of [ring,diameter,center])item.userData.glowIntensity=style.glow;object.position.copy(position);object.quaternion.copy(orientation);object.scale.setScalar(pitch/2);object.visible=visible;},dispose(){object.removeFromParent();ring.geometry.dispose();material.dispose();diameter.geometry.dispose();ink.dispose();center.geometry.dispose();center.material.dispose();}};
}
