import * as T from 'three';
import {SVGRenderer} from 'three/addons/renderers/SVGRenderer.js';
import {createOriginGizmo,orientOriginGizmo,disposeOriginGizmo} from './originGizmo.ts';
import {pickAxisSegment} from './axisHit.ts';
import type {OriginDirections} from '../core/originDirections.ts';
export const ORIGIN_CONTROL_SIZE=144;
/** The shared origin geometry in a fixed, evenly separated view. */
export function createOriginControl(enabled:readonly number[],directions:OriginDirections){
 const camera=new T.OrthographicCamera(-.5,.5,.5,-.5,.1,10),gizmo=createOriginGizmo(1,true,enabled,directions.mode==='axis'?directions:undefined,{directionControls:true});
 camera.position.set(2,2,2);camera.lookAt(0,0,0);camera.updateMatrixWorld();orientOriginGizmo(gizmo,camera,{height:ORIGIN_CONTROL_SIZE});
 return {camera,gizmo};
}
/** DOM input reuses the scene's pixel-distance picker, without SVG hit shapes. */
export function mountOriginAxisControl(host:HTMLElement,enabled:readonly number[],directions:OriginDirections,activate:(target:{axis:number}|{key:string})=>void){
 const {camera,gizmo}=createOriginControl(enabled,directions),scene=new T.Scene(),renderer=new SVGRenderer();scene.add(gizmo);
 renderer.setSize(ORIGIN_CONTROL_SIZE,ORIGIN_CONTROL_SIZE);renderer.setPrecision(3);renderer.render(scene,camera);
 const svg=renderer.domElement;svg.style.background='transparent';svg.style.fill='none';svg.style.stroke='none';svg.setAttribute('aria-hidden','true');host.append(svg);
 const objects=gizmo.children.filter(child=>child.visible&&child.userData.axisIndex!==undefined);
 const pick=(event:PointerEvent)=>pickAxisSegment({x:event.clientX,y:event.clientY},objects,camera,host.getBoundingClientRect(),8);
 const down=(event:PointerEvent)=>{if(event.button!==0)return;const hit=pick(event);if(!hit)return;event.preventDefault();event.stopPropagation();const object=objects.find(child=>child.userData.axisIndex===hit.axisIndex);activate(object?.userData.directionKey?{key:object.userData.directionKey}:{axis:hit.axisIndex});};
 host.addEventListener('pointerdown',down);
 return()=>{host.removeEventListener('pointerdown',down);svg.remove();disposeOriginGizmo(gizmo);};
}
