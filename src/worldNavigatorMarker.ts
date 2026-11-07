import * as THREE from 'three';
import {analyticSelectionRing} from './materialCoverage.ts';
/** A non-pickable navigator, with a local-XY ring, centre/diameter and corner
 * orientation mark. It is deliberately excluded from all graph hit inventories. */
export function createWorldNavigatorMarker(){
 const object=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0x40dcff,transparent:true,opacity:.85,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
 analyticSelectionRing(material);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.835,1.125,64),material);object.add(ring);
 const ink=new THREE.LineBasicMaterial({color:0x40dcff,transparent:true,opacity:.9,depthWrite:false,depthTest:false});
 const axes=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-1,0,0),new THREE.Vector3(1,0,0),
  new THREE.Vector3(.7,.9,0),new THREE.Vector3(.7,1.3,0),
  new THREE.Vector3(.7,.9,0),new THREE.Vector3(1.05,.9,0),
 ]),ink);object.add(axes);
 const center=new THREE.Mesh(new THREE.CircleGeometry(.09,24),new THREE.MeshBasicMaterial({color:0x40dcff,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));object.add(center);
 object.traverse(item=>{item.renderOrder=1000;});object.visible=false;
 return {object,update(position:THREE.Vector3,orientation:THREE.Quaternion,pitch:number,visible:boolean,valid=true,style={color:"#40dcff",opacity:.85,glow:0}){const color=valid?style.color:"#e46868";material.color.set(color);ink.color.set(color);center.material.color.set(color);material.opacity=style.opacity;ink.opacity=style.opacity;center.material.transparent=true;center.material.opacity=style.opacity;for(const item of [ring,axes,center])item.userData.glowIntensity=style.glow;object.position.copy(position);object.quaternion.copy(orientation);object.scale.setScalar(pitch/2);object.visible=visible;},dispose(){object.removeFromParent();ring.geometry.dispose();material.dispose();axes.geometry.dispose();ink.dispose();center.geometry.dispose();center.material.dispose();}};
}
