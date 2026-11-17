import * as T from 'three';
type Point={x:number;y:number};
/** Match the drawn segment in screen pixels, independent of zoom/world scale. */
export function pickAxisSegment(point:Point,objects:readonly T.Object3D[],camera:T.Camera,rect:{left:number;top:number;width:number;height:number},tolerance=6){
 let endOn=false;
 let best:{axis:string;axisIndex:number}|undefined,distance=tolerance*tolerance;
 for(const object of objects){
  if(!object.visible||object.userData.axisIndex===undefined||!object.userData.axisSegment&&!(object instanceof T.Line))continue;
  object.updateWorldMatrix(true,false);
  const positions=object instanceof T.Line?object.geometry.getAttribute('position'):undefined,segment=object.userData.axisSegment;
  const a=(segment?new T.Vector3(...segment[0]):new T.Vector3().fromBufferAttribute(positions!,0)).applyMatrix4(object.matrixWorld).project(camera),b=(segment?new T.Vector3(...segment[1]):new T.Vector3().fromBufferAttribute(positions!,1)).applyMatrix4(object.matrixWorld).project(camera);
  if(a.z< -1||a.z>1||b.z< -1||b.z>1)continue;
  const ax=rect.left+(a.x+1)*rect.width/2,ay=rect.top+(1-a.y)*rect.height/2,bx=rect.left+(b.x+1)*rect.width/2,by=rect.top+(1-b.y)*rect.height/2,dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
  // End-on axes remain a distinct centre target, ahead of crossing shafts.
  if(length<36){const d=(point.x-(ax+bx)/2)**2+(point.y-(ay+by)/2)**2;if(d<36&&(!endOn||d<distance)){endOn=true;distance=d;best={axis:object.userData.axis,axisIndex:object.userData.axisIndex};}continue;}
  const t=Math.max(0,Math.min(1,((point.x-ax)*dx+(point.y-ay)*dy)/length)),d=(point.x-ax-t*dx)**2+(point.y-ay-t*dy)**2;
  if(!endOn&&d<distance){distance=d;best={axis:object.userData.axis,axisIndex:object.userData.axisIndex};}
 }
 return best;
}
