import * as T from 'three';
import {createOriginGizmo,orientOriginGizmo,disposeOriginGizmo} from './originGizmo.ts';
import {pickAxisSegment} from './axisHit.ts';
import {AXIS_COLORS} from './axisReadout.ts';
import type {OriginDirections} from '../core/originDirections.ts';
export const ORIGIN_CONTROL_SIZE=144;
/** The shared origin geometry in a fixed, evenly separated view. */
export function createOriginControl(enabled:readonly number[],directions:OriginDirections){
 const camera=new T.OrthographicCamera(-.5,.5,.5,-.5,.1,10),gizmo=createOriginGizmo(1,true,enabled,directions.mode==='axis'?directions:undefined,{directionControls:true});
 camera.position.set(2,2,2);camera.lookAt(0,0,0);camera.updateMatrixWorld();orientOriginGizmo(gizmo,camera,{height:ORIGIN_CONTROL_SIZE});
 return {camera,gizmo};
}
/** Project the existing fixed geometry for the composer's flat drawing. */
export function originControlRays(gizmo:T.Group,camera:T.Camera,enabled:readonly number[],directions:OriginDirections){
 gizmo.updateWorldMatrix(true,true);
 const project=(object:T.Object3D,point:number[])=>{const p=new T.Vector3(...point as [number,number,number]).applyMatrix4(object.matrixWorld).project(camera);return {x:p.x,y:-p.y};};
 return gizmo.children.flatMap(object=>{
  if(object.userData.originShaft){const segment=object.userData.axisSegment as number[][],axis=object.userData.axisIndex as number;return [{id:`axis:${axis}`,start:project(object,segment[0]),point:project(object,segment[1]),selected:enabled.includes(axis),color:AXIS_COLORS[axis] as string}];}
  if(object instanceof T.Line&&object.userData.directionKey){const positions=object.geometry.getAttribute('position'),key=object.userData.directionKey as string;return [{id:`direction:${object.userData.axisIndex}`,start:project(object,new T.Vector3().fromBufferAttribute(positions,0).toArray()),point:project(object,new T.Vector3().fromBufferAttribute(positions,1).toArray()),selected:!directions.disabled.includes(key),color:(object.material as T.LineBasicMaterial).color.getStyle()}];}
  return [];
 });
}
/** Input keeps the same scene picker and axis/direction setters. */
export function bindOriginAxisControl(host:HTMLElement,control:ReturnType<typeof createOriginControl>,activate:(target:{axis:number}|{key:string})=>void){
 const {camera,gizmo}=control,objects=gizmo.children.filter(child=>child.visible&&child.userData.axisIndex!==undefined);
 const down=(event:PointerEvent)=>{if(event.button!==0)return;const hit=pickAxisSegment({x:event.clientX,y:event.clientY},objects,camera,host.getBoundingClientRect(),8);if(!hit)return;event.preventDefault();event.stopPropagation();const object=objects.find(child=>child.userData.axisIndex===hit.axisIndex);activate(object?.userData.directionKey?{key:object.userData.directionKey}:{axis:hit.axisIndex});};
 host.addEventListener('pointerdown',down);
 return()=>{host.removeEventListener('pointerdown',down);disposeOriginGizmo(gizmo);};
}
