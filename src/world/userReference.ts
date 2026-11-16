export type UserPose={position:number[];target:number[];up:number[]};
/** The observer can leave User without moving its spatial reference. */
export function createUserReference(read:()=>UserPose){
 let parked:UserPose|undefined;
 return {read:()=>parked??read(),get detached(){return !!parked;},dismount(){parked??=structuredClone(read());return parked;},mount(){const pose=parked;parked=undefined;return pose;}};
}
