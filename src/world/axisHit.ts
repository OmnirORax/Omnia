import * as T from 'three';
type Point={x:number;y:number};
/** Match the drawn segment in screen pixels, independent of zoom/world scale. */
export function pickAxisSegment(point:Point,objects:readonly T.Object3D[],camera:T.Camera,rect:{left:number;top:number;width:number;height:number},tolerance=6){
 let best:{axis:string;axisIndex:number}|undefined,distance=tolerance*tolerance;
 for(const object of objects){
  if(!object.visible||!(object instanceof T.Line)||object.userData.axisIndex===undefined)continue;
  object.updateWorldMatrix(true,false);
  const positions=object.geometry.getAttribute('position');
  const a=new T.Vector3().fromBufferAttribute(positions,0).applyMatrix4(object.matrixWorld).project(camera),b=new T.Vector3().fromBufferAttribute(positions,1).applyMatrix4(object.matrixWorld).project(camera);
  if(a.z< -1||a.z>1||b.z< -1||b.z>1)continue;
  const ax=rect.left+(a.x+1)*rect.width/2,ay=rect.top+(1-a.y)*rect.height/2,bx=rect.left+(b.x+1)*rect.width/2,by=rect.top+(1-b.y)*rect.height/2,dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
  if(length<4)continue;
  const t=Math.max(0,Math.min(1,((point.x-ax)*dx+(point.y-ay)*dy)/length)),d=(point.x-ax-t*dx)**2+(point.y-ay-t*dy)**2;
  if(d<distance){distance=d;best={axis:object.userData.axis,axisIndex:object.userData.axisIndex};}
 }
 return best;
}
