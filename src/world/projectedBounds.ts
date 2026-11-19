import * as T from 'three';
import type {PopupRect} from '../composer/runtime/ui/popupPlacement.ts';
/** Project a world bounding box once when opening its contextual editor. */
export function projectedBounds(bounds:T.Box3,camera:T.Camera,viewport:PopupRect):PopupRect{
 camera.updateMatrixWorld();const points:T.Vector3[]=[];
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){const p=new T.Vector3(x,y,z).project(camera);if(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.z>=-1&&p.z<=1)points.push(p);}
 if(!points.length)return {x:viewport.x+viewport.width/2,y:viewport.y+viewport.height/2,width:0,height:0};
 const xs=points.map(p=>viewport.x+(p.x+1)*viewport.width/2),ys=points.map(p=>viewport.y+(1-p.y)*viewport.height/2),x=Math.min(...xs),y=Math.min(...ys);return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
