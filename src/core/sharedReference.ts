import type {AxisFrame} from './axes.ts';
import {axisCenter} from './axes.ts';
import type {World,Vec3} from './model.ts';
export const USER_REFERENCE='@user';
/** One reference owner shared by every world operation. User is the fallback. */
export function createSharedReference(read:()=>World,user:()=>{origin:Vec3;x:Vec3;y:Vec3;z:Vec3}){
 let axes=[0,1];
 return {
  read():AxisFrame{const world=read(),explicit=world.axes?.find(frame=>frame.id===world.activeAxis);if(explicit)return explicit;const pose=user();return {id:USER_REFERENCE,ends:[],members:[],directed:true,origin:[...pose.origin],x:pose.x,y:pose.y,z:pose.z,activeAxes:[...axes]};},
  toggle(axis:number){if(![0,1,2].includes(axis))throw Error('Invalid axis.');axes=axes.includes(axis)?axes.filter(n=>n!==axis):axes.length===2?[axis]:[...axes,axis].sort();},
  world(world:World,frame:AxisFrame):World{return world.axes?.some(f=>f.id===world.activeAxis)?world:{...world,activeAxis:frame.id,axes:[...(world.axes??[]),{...frame,origin:[...axisCenter(world,frame)] as Vec3,ends:[...frame.ends],members:[...frame.members]}]};},
 };
}
