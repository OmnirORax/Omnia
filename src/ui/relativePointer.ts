import {reportSystemMessage} from './systemMessage.ts';
type Point={x:number;y:number};
type Sample={clientX:number;clientY:number;movementX?:number;movementY?:number};
let owner:{stop:(release?:boolean)=>void;handoff:(release:boolean)=>void;readonly surface?:HTMLElement}|undefined;
/** One relative stream for free DOF adjustment; consumers keep their own value math. */
export function createRelativePointer(onLost:()=>void=()=>{},onRejected:(message:string)=>void=reportSystemMessage){
 let element:HTMLElement|undefined,surface:HTMLElement|undefined,doc:Document|undefined,point:Point={x:0,y:0},pending=false,locked=false,legacy=false,required=false,generation=0;
 const change=()=>{if(!element||!doc)return;if(doc.pointerLockElement===surface){pending=false;locked=true;}else if(locked){api.stop();onLost();}};
 const error=(reason?:unknown)=>{if(!element)return;const cancel=required,detail=reason instanceof Error?` ${reason.name}: ${reason.message}`:'';api.stop();onRejected(`Continuous pointer input was refused by the browser.${detail}`);if(cancel)onLost();};
 const api={get target(){return element;},get surface(){return surface;},handoff(release:boolean){api.stop(release);onLost();},get active(){return pending||locked;},get locked(){return !!element&&doc?.pointerLockElement===surface;},
  start(target:HTMLElement,origin:Point,options?:{requireLock?:boolean}){
   const documentOwner=target.ownerDocument??(typeof document==='undefined'?undefined:document),lockSurface=typeof documentOwner?.documentElement?.requestPointerLock==='function'?documentOwner.documentElement:target;
   point={...origin};required=!!options?.requireLock;
   if(element===target&&(pending||api.locked))return true;
   // The page survives control rerenders. Transfer an existing lock without
   // releasing it and immediately asking the browser for another one.
   const preserve=documentOwner?.pointerLockElement===lockSurface;
   api.stop(!preserve);
   if(!required&&!preserve&&typeof navigator!=='undefined'&&navigator.userActivation?.isActive===false)return false;
   owner?.handoff(!preserve);
   if(typeof lockSurface.requestPointerLock!=='function'){if(required){onRejected('This browser cannot hold the cursor still for sliding.');onLost();}return false;}
   owner=api;element=target;surface=lockSurface;doc=documentOwner??document;pending=true;const epoch=++generation;
   doc.addEventListener('pointerlockchange',change);
   if(doc.pointerLockElement===lockSurface){pending=false;locked=true;return true;}
   try{
    const request=lockSurface.requestPointerLock();legacy=!request||typeof request.then!=='function';
    // Promise failures belong to this request. Document errors have no request
    // identity and may have been queued by an older control.
    if(legacy)doc.addEventListener('pointerlockerror',error);
    else void request.then(()=>{if(epoch!==generation&&owner?.surface!==lockSurface&&documentOwner?.pointerLockElement===lockSurface)documentOwner.exitPointerLock();},reason=>{if(epoch===generation)error(reason);});
   }catch(reason){error(reason);return false;}return true;
  },
  observeMove(listener:(event:MouseEvent|PointerEvent)=>void){
   if(typeof window==='undefined')return()=>{};
   let last:{type:string;time:number;x:number;y:number;dx:number;dy:number;paired:boolean}|undefined;
   const move=(event:MouseEvent|PointerEvent)=>{
    if(!api.locked&&event.type!=='pointermove')return;
    const sample={type:event.type,time:event.timeStamp,x:event.clientX,y:event.clientY,dx:event.movementX,dy:event.movementY,paired:false};
    const companion=api.locked&&last&&!last.paired&&last.type!==sample.type&&Number.isFinite(sample.time)&&sample.time===last.time&&sample.x===last.x&&sample.y===last.y&&sample.dx===last.dx&&sample.dy===last.dy;
    if(companion){last!.paired=true;return;}last=sample;listener(event);
   };
   window.addEventListener('mousemove',move,true);window.addEventListener('pointermove',move,true);
   return()=>{window.removeEventListener('mousemove',move,true);window.removeEventListener('pointermove',move,true);};
  },
  sample(event:Sample){if(api.locked){locked=true;pending=false;point={x:point.x+(Number.isFinite(event.movementX)?event.movementX!:0),y:point.y+(Number.isFinite(event.movementY)?event.movementY!:0)};}else if(!required)point={x:event.clientX,y:event.clientY};return {...point};},
  stop(release=true){generation++;const previous=surface,documentOwner=doc,late=legacy&&pending;legacy=false;element=surface=undefined;doc=undefined;pending=locked=false;if(owner===api)owner=undefined;documentOwner?.removeEventListener('pointerlockchange',change);documentOwner?.removeEventListener('pointerlockerror',error);if(release&&previous&&documentOwner?.pointerLockElement===previous)documentOwner.exitPointerLock();else if(late&&previous&&documentOwner){const cleanup=()=>{documentOwner.removeEventListener('pointerlockchange',release);documentOwner.removeEventListener('pointerlockerror',cleanup);};const release=()=>{cleanup();if(documentOwner.pointerLockElement===previous&&owner?.surface!==previous)documentOwner.exitPointerLock();};documentOwner.addEventListener('pointerlockchange',release);documentOwner.addEventListener('pointerlockerror',cleanup);}},
 };return api;
}
