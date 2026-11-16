import type {Origin} from './model.ts';
export type SavedCameraPose={position:number[];target:number[];up:number[]};
export type CameraState={observer:SavedCameraPose;user:SavedCameraPose;detached:boolean;fov:number;zoom:number;pov?:Origin;depth?:number;returnView?:SavedCameraPose;contentsFaceCamera:boolean};
export function validateCameraState(value:CameraState|undefined){
 if(value===undefined)return;
 const vector=(v:unknown):v is number[]=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=1e12);
 const pose=(p:SavedCameraPose)=>p&&vector(p.position)&&vector(p.target)&&vector(p.up)&&Math.hypot(...p.up)>1e-8&&Math.hypot(...p.position.map((n,i)=>n-p.target[i]))>1e-10;
 if(!value||typeof value!=='object'||!pose(value.observer)||!pose(value.user)||typeof value.detached!=='boolean'||typeof value.contentsFaceCamera!=='boolean'||!Number.isFinite(value.fov)||value.fov<=0||value.fov>=180||!Number.isFinite(value.zoom)||value.zoom<=0||value.zoom>1e6||value.depth!==undefined&&(!Number.isFinite(value.depth)||value.depth<0||value.depth>1e12)||value.returnView!==undefined&&!pose(value.returnView)||value.pov!==undefined&&(!Number.isFinite(value.pov.born)||!vector(value.pov.at)))throw Error('Invalid camera state.');
}
