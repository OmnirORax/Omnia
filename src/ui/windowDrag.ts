/** Shared document-window drag: top-bar pickup, viewport limits and cancellation. */
export function windowDrag(root:HTMLElement,heading:HTMLElement,record?:(before:string)=>void){
 heading.style.cursor='move';heading.style.touchAction='none';
 heading.onpointerdown=event=>{
  if(event.button!==0||event.target instanceof Element&&event.target.closest('button,input,select,textarea,a,[role="button"]'))return;
  const before=root.style.cssText,box=root.getBoundingClientRect(),start={x:event.clientX,y:event.clientY};
  event.preventDefault();heading.setPointerCapture(event.pointerId);
  heading.onpointermove=move=>{root.style.left=`${Math.max(0,Math.min(innerWidth-40,box.left+move.clientX-start.x))}px`;root.style.top=`${Math.max(0,Math.min(innerHeight-30,box.top+move.clientY-start.y))}px`;root.style.right='auto';};
  heading.onpointerup=()=>{heading.onpointermove=null;record?.(before);};
  heading.onpointercancel=()=>{heading.onpointermove=null;root.style.cssText=before;};
 };
}
