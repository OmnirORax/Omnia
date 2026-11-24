import {reportSystemMessage} from './systemMessage.ts';
type Point={x:number;y:number};
type Sample={clientX:number;clientY:number;movementX?:number;movementY?:number};
let owner:{stop:()=>void;readonly target?:HTMLElement}|undefined;
/** One relative stream for free DOF adjustment; consumers keep their own value math. */
export function createRelativePointer(onLost:()=>void=()=>{},onRejected:(message:string)=>void=reportSystemMessage){
 let element:HTMLElement|undefined,doc:Document|undefined,point:Point={x:0,y:0},pending=false,locked=false,legacy=false,required=false,generation=0;
 const change=()=>{if(!element||!doc)return;if(doc.pointerLockElement===element){pending=false;locked=true;}else if(locked){api.stop();onLost();}};
 const error=()=>{const cancel=required;pending=false;api.stop();onRejected('Continuous pointer input was refused by the browser. Activate the DOF control with a click and try again.');if(cancel)onLost();};
 const api={get target(){return element;},get active(){return pending||locked;},get locked(){return !!element&&doc?.pointerLockElement===element;},
  start(target:HTMLElement,origin:Point,options?:{requireLock?:boolean}){api.stop();point={...origin};required=!!options?.requireLock;if(typeof target.requestPointerLock!=='function'){if(required){onRejected('This browser cannot hold the cursor still for sliding.');onLost();}return false;}owner?.stop();owner=api;element=target;doc=target.ownerDocument??document;pending=true;const epoch=++generation,documentOwner=doc;
   doc.addEventListener('pointerlockchange',change);doc.addEventListener('pointerlockerror',error);
   try{const request=target.requestPointerLock();legacy=!request;if(request&&typeof request.then==='function')void request.then(()=>{if(epoch!==generation&&owner?.target!==target&&documentOwner.pointerLockElement===target)documentOwner.exitPointerLock();}).catch(()=>{if(epoch===generation)error();});}catch{error();return false;}return true;
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
  stop(){generation++;const previous=element,documentOwner=doc,late=legacy&&pending;legacy=false;element=undefined;doc=undefined;pending=locked=false;if(owner===api)owner=undefined;documentOwner?.removeEventListener('pointerlockchange',change);documentOwner?.removeEventListener('pointerlockerror',error);if(previous&&documentOwner?.pointerLockElement===previous)documentOwner.exitPointerLock();else if(late&&previous&&documentOwner){const cleanup=()=>{documentOwner.removeEventListener('pointerlockchange',release);documentOwner.removeEventListener('pointerlockerror',cleanup);};const release=()=>{cleanup();if(documentOwner.pointerLockElement===previous&&owner?.target!==previous)documentOwner.exitPointerLock();};documentOwner.addEventListener('pointerlockchange',release);documentOwner.addEventListener('pointerlockerror',cleanup);}},
 };return api;
}
