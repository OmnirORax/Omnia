import * as T from 'three';
export const ORIGIN_RADIUS=.18;
export function originSegment(center:T.Vector3,direction:T.Vector3,scale:number){return [center.clone().addScaledVector(direction,-ORIGIN_RADIUS*scale),center.clone().addScaledVector(direction,ORIGIN_RADIUS*scale)];}
export function createOriginSphere(scale:number,active:boolean){const marker=new T.Mesh(new T.SphereGeometry(ORIGIN_RADIUS,12,8),new T.MeshBasicMaterial({color:active?'#00d8ff':'#888888',transparent:true,opacity:.35,depthTest:false,depthWrite:false}));marker.scale.setScalar(scale);marker.userData.originMarker=true;return marker;}
