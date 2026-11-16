/** Complete selection before generic hit/camera release handlers can reinterpret
 * the same press. A different button's release must leave the gesture intact. */
export function releaseRange<T>(gesture:{mode:string;pointer:number;button:number;dragged:boolean;origin?:T;volume?:unknown}|undefined,event:{pointerId:number;button:number;preventDefault:()=>void;stopImmediatePropagation:()=>void},actions:{candidates:()=>T[];finish:()=>void;range:(origins:T[],extend:boolean)=>void;pick:(origin:T)=>void}){
 if(!gesture||gesture.mode!=='range'||gesture.pointer!==event.pointerId||gesture.button!==event.button)return false;
 event.preventDefault();event.stopImmediatePropagation();
 const origins=gesture.dragged?actions.candidates():undefined;
 actions.finish();
 if(origins)actions.range(origins,!gesture.volume);
 else if(gesture.origin!==undefined)actions.pick(gesture.origin);
 return true;
}
