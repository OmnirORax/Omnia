import * as T from 'three';
import {activeWorldAxes,type AxisFrame} from '../core/axes.ts';
import type {NudgeActionId} from '../composer/runtime/workspaceActions.ts';
export const ARROW_NUDGES={ArrowUp:'nudgeUp',ArrowDown:'nudgeDown',ArrowLeft:'nudgeLeft',ArrowRight:'nudgeRight'} as const;
/** Screen directions choose among the active origin axes, never a camera-depth path. */
export function axisNudgeDirection(frame:AxisFrame,camera:T.Quaternion,actions:readonly NudgeActionId[]){
 const active=activeWorldAxes(frame);if(!active.length)return new T.Vector3();const basis=[frame.x,frame.y,frame.z].map(v=>new T.Vector3(...v)),right=new T.Vector3(1,0,0).applyQuaternion(camera),up=new T.Vector3(0,1,0).applyQuaternion(camera);
 const horizontal=[...active].sort((a,b)=>Math.abs(basis[b].dot(right))-Math.abs(basis[a].dot(right)))[0],vertical=[...active].filter(i=>i!==horizontal).sort((a,b)=>Math.abs(basis[b].dot(up))-Math.abs(basis[a].dot(up)))[0]??horizontal;
 const amounts=[0,0,0];amounts[horizontal]+=(Number(actions.includes('nudgeRight'))-Number(actions.includes('nudgeLeft')))*(basis[horizontal].dot(right)>=0?1:-1);amounts[vertical]+=(Number(actions.includes('nudgeUp'))-Number(actions.includes('nudgeDown')))*(basis[vertical].dot(up)>=0?1:-1);
 return basis.reduce((sum,axis,i)=>sum.addScaledVector(axis,Math.max(-1,Math.min(1,amounts[i]))),new T.Vector3());
}
