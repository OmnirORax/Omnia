/** Selection explicitly takes ownership from incompatible transient operations. */
export function beginRange(event:{button:number;ctrlKey:boolean;metaKey:boolean},cancelPreviews:()=>void){
 if(event.button!==0||!event.ctrlKey&&!event.metaKey)return false;
 cancelPreviews();return true;
}
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

/** Plain marquee selection is a screen operation; explicit depth selection has
 * its own bounded 3D box and does not depend on active movement axes. */
export function insideScreenSelection(point:{x:number;y:number;z:number},rect:{left:number;top:number;width:number;height:number},start:{x:number;y:number},end:{x:number;y:number}){
 const x=rect.left+(point.x+1)*rect.width/2,y=rect.top+(1-point.y)*rect.height/2;
 return point.z>=-1&&point.z<=1&&x>=Math.min(start.x,end.x)&&x<=Math.max(start.x,end.x)&&y>=Math.min(start.y,end.y)&&y<=Math.max(start.y,end.y);
}
