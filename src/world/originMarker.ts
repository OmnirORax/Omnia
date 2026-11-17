import * as T from 'three';
import {atomicCarrierGeometry,atomicCarrierMaterial} from '../atomicCarrier.ts';
export const ORIGIN_RADIUS=.36;
export function originSegment(center:T.Vector3,direction:T.Vector3,scale:number){return [center.clone().addScaledVector(direction,-ORIGIN_RADIUS*scale),center.clone().addScaledVector(direction,ORIGIN_RADIUS*scale)];}
export function createOriginSphere(scale:number,_active:boolean){const material=atomicCarrierMaterial('#ffffff',.12,0,0,1);material.depthTest=false;const marker=new T.Mesh(atomicCarrierGeometry(ORIGIN_RADIUS*2),material);marker.scale.setScalar(scale);marker.userData.originMarker=true;return marker;}
