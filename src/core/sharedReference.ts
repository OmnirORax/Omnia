import type {AxisFrame} from './axes.ts';
import {axisCenter} from './axes.ts';
import {planarOriginDirections,sideAxes} from './originDirections.ts';
import type {World,Vec3} from './model.ts';
export const USER_REFERENCE='@user';
/** One planar placement reference; Z remains the frame's facing direction. */
export function createSharedReference(read:()=>World,user:()=>{origin:Vec3;x:Vec3;y:Vec3;z:Vec3}){
 const axes=[0,1];
 const planar=(frame:AxisFrame):AxisFrame=>{const directions=planarOriginDirections(frame.directions,frame.activeAxes??axes);const {packing:_,...rest}=frame;return {...rest,activeAxes:sideAxes(directions.sides!),directions};};
 return {
  read():AxisFrame{const world=read(),explicit=world.axes?.find(frame=>frame.id===world.activeAxis);if(explicit)return planar(explicit);const pose=user();return planar({id:USER_REFERENCE,ends:[],members:[],directed:true,origin:[...pose.origin],x:pose.x,y:pose.y,z:pose.z,activeAxes:[...axes],directions:world.userDirections});},
  world(world:World,frame:AxisFrame):World{return {...world,activeAxis:frame.id,axes:world.axes?.some(f=>f.id===frame.id)?world.axes.map(f=>f.id===frame.id?{...frame}:f):[...(world.axes??[]),{...frame,origin:[...axisCenter(world,frame)],ends:[...frame.ends],members:[...frame.members]}]};},
 };
}
