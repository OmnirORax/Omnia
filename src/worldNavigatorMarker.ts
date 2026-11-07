import * as THREE from 'three';
import {WORLD_AXIS_COLORS} from './cameraGuideState.ts';
import {analyticSelectionRing} from './materialCoverage.ts';
/** A non-pickable navigator, with a camera-facing ring and an internal projected world-axis
 * compass. It is deliberately excluded from all graph hit inventories. */
export function createWorldNavigatorMarker(){
 const object=new THREE.Group(),material=new THREE.MeshBasicMaterial({color:0x40dcff,transparent:true,opacity:.85,depthWrite:false,depthTest:false,side:THREE.DoubleSide});
 analyticSelectionRing(material);
 const ring=new THREE.Mesh(new THREE.RingGeometry(.835,1.125,64),material);object.add(ring);
 const ink=new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.9,depthWrite:false,depthTest:false});
 const reference=[new THREE.Vector3(-.82,0,0),new THREE.Vector3(.82,0,0),new THREE.Vector3(0,0,0),new THREE.Vector3(0,.82,0),new THREE.Vector3(0,0,0),new THREE.Vector3(0,0,.82)];
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(18),3));
 const colors=['x','x','y','y','z','z'].flatMap(axis=>new THREE.Color(WORLD_AXIS_COLORS[axis as keyof typeof WORLD_AXIS_COLORS]).toArray());
 geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 const axes=new THREE.LineSegments(geometry,ink);object.add(axes);
 let compassOrientation:THREE.Quaternion|undefined;
 const projectCompass=(orientation:THREE.Quaternion)=>{
  if(compassOrientation?.equals(orientation))return;
  compassOrientation=orientation.clone();const inverse=orientation.clone().invert(),attribute=geometry.getAttribute('position') as THREE.BufferAttribute;
  for(let i=0;i<reference.length;i++){const p=reference[i].clone().applyQuaternion(inverse);attribute.setXYZ(i,p.x,p.y,0);}
  attribute.needsUpdate=true;geometry.computeBoundingSphere();
 };
 const center=new THREE.Mesh(new THREE.CircleGeometry(.09,24),new THREE.MeshBasicMaterial({color:0x40dcff,depthTest:false,depthWrite:false,side:THREE.DoubleSide}));object.add(center);
 object.traverse(item=>{item.renderOrder=1000;});object.visible=false;
 return {object,update(position:THREE.Vector3,orientation:THREE.Quaternion,pitch:number,visible:boolean,valid=true,style={color:"#40dcff",opacity:.85,glow:0}){const color=valid?style.color:"#e46868";material.color.set(color);center.material.color.set(color);projectCompass(orientation);material.opacity=style.opacity;ink.opacity=style.opacity;center.material.transparent=true;center.material.opacity=style.opacity;for(const item of [ring,axes,center])item.userData.glowIntensity=style.glow;object.position.copy(position);object.quaternion.copy(orientation);object.scale.setScalar(pitch/2);object.visible=visible;},dispose(){object.removeFromParent();ring.geometry.dispose();material.dispose();axes.geometry.dispose();ink.dispose();center.geometry.dispose();center.material.dispose();}};
}
