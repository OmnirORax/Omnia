import {spatialDirectionSlots,type OriginDirections} from '../core/originDirections.ts';
import * as T from 'three';
import {AXIS_COLORS} from './axisReadout.ts';
import {ORIGIN_RADIUS,createOriginSphere} from './originMarker.ts';
/** Shared origin shape for saved references, rotation previews and bindings. */
export function createOriginGizmo(scale=1,active=true,enabled:readonly number[]=[0,1],directions?:OriginDirections){
 const group=new T.Group();group.scale.setScalar(scale);group.add(createOriginSphere(1,active));
 for(let i=0;i<3;i++){
  const selected=active&&enabled.includes(i),color=new T.Color(active?AXIS_COLORS[i]:'#888888').multiplyScalar(selected?1:.65),material=new T.MeshBasicMaterial({color,transparent:true,opacity:selected?1:.6,depthTest:false,depthWrite:false}),direction=new T.Vector3().setComponent(i,1);
  const shaft=new T.Mesh(new T.CylinderGeometry(1,1,1,8),material);shaft.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction);shaft.userData={axisIndex:i,axisSegment:[[0,-.5,0],[0,.5,0]],originShaft:true};shaft.scale.set(.002,ORIGIN_RADIUS*2,.002);shaft.visible=active||i===0;shaft.renderOrder=45;group.add(shaft);
  const dot=new T.Mesh(new T.SphereGeometry(1,12,8),material);dot.userData={axisIndex:i,originAxisDot:true};dot.renderOrder=48;dot.visible=false;group.add(dot);
  const arrow=new T.Mesh(new T.ConeGeometry(ORIGIN_RADIUS*.075,ORIGIN_RADIUS*.22,8),material);arrow.position.copy(direction).multiplyScalar(ORIGIN_RADIUS*.9);arrow.quaternion.copy(shaft.quaternion);arrow.visible=active||i===2;arrow.renderOrder=46;arrow.userData={axisIndex:i,directionIndicator:true};group.add(arrow);
 }
 if(directions){const positions:number[]=[],colors:number[]=[];for(const slot of spatialDirectionSlots(directions,enabled)){const delta=new T.Vector3(...slot.direction).multiplyScalar(ORIGIN_RADIUS),color=new T.Color(0,0,0);slot.direction.forEach((weight,i)=>color.add(new T.Color(AXIS_COLORS[i]).multiplyScalar(Math.abs(weight))));color.multiplyScalar(1/(Math.abs(slot.direction[0])+Math.abs(slot.direction[1])+Math.abs(slot.direction[2])));positions.push(0,0,0,...delta.toArray());colors.push(...color.toArray(),...color.toArray());}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));const rays=new T.LineSegments(geometry,new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:active?.8:.3,depthTest:false,depthWrite:false}));rays.renderOrder=44;group.add(rays);}
 return group;
}
export function orientOriginGizmo(group:T.Group,camera:T.Camera,rect:{height:number}){
 group.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);
 const center=group.getWorldPosition(new T.Vector3()).applyMatrix4(camera.matrixWorldInverse),projection=camera.projectionMatrix.elements,worldScale=group.getWorldScale(new T.Vector3()).x,pixel=2*(camera instanceof T.PerspectiveCamera?Math.abs(center.z):1)/Math.abs(projection[5])/Math.max(1,rect.height)/worldScale;
 for(const child of group.children){
  if(child.userData.originShaft){child.scale.set(pixel,ORIGIN_RADIUS*2,pixel);child.updateWorldMatrix(true,false);const ends=(child.userData.axisSegment as number[][]).map(p=>new T.Vector3(...p as [number,number,number]).applyMatrix4(child.matrixWorld).project(camera));const dx=(ends[1].x-ends[0].x)*Math.abs(projection[5]/projection[0])*rect.height/2,dy=(ends[1].y-ends[0].y)*rect.height/2;const dot=group.children.find(other=>other.userData.originAxisDot&&other.userData.axisIndex===child.userData.axisIndex)!;dot.visible=child.visible&&dx*dx+dy*dy<36;dot.scale.setScalar(3*pixel);}
 }
}

export function disposeOriginGizmo(group:T.Object3D){const materials=new Set<T.Material>();group.traverse(object=>{if(object instanceof T.Mesh||object instanceof T.Line){object.geometry.dispose();if(Array.isArray(object.material))object.material.forEach(material=>materials.add(material));else materials.add(object.material);}});for(const material of materials)material.dispose();group.removeFromParent();}
