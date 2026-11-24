/** Shared floating-surface drag: handle pickup, viewport limits and cancellation. */
export function windowDrag(root:HTMLElement,heading:HTMLElement,record?:(before:string)=>void,options?:{translateScale:()=>number}){
 heading.style.cursor='move';heading.style.touchAction='none';
 heading.onpointerdown=event=>{
  if(event.button!==0||event.target instanceof Element&&event.target.closest('button,input,select,textarea,a,[role="button"]')&&!(options&&event.target===heading))return;
  const before=root.style.cssText,box=root.getBoundingClientRect(),start={x:event.clientX,y:event.clientY};
  const initial=(root.style.translate||'0 0').split(' ').map(Number.parseFloat),scale=options?.translateScale()??1;
  event.preventDefault();if(options)event.stopPropagation();heading.setPointerCapture(event.pointerId);
  heading.onpointermove=move=>{const x=Math.max(0,Math.min(innerWidth-40,box.left+move.clientX-start.x)),y=Math.max(0,Math.min(innerHeight-30,box.top+move.clientY-start.y));
   if(options)root.style.translate=`${(initial[0]||0)+(x-box.left)/scale}px ${(initial[1]||0)+(y-box.top)/scale}px`;
   else{root.style.left=`${x}px`;root.style.top=`${y}px`;root.style.right='auto';}
  };
  heading.onpointerup=()=>{heading.onpointermove=null;record?.(before);};
  heading.onpointercancel=()=>{heading.onpointermove=null;root.style.cssText=before;};
 };
 return()=>{heading.onpointerdown=null;heading.onpointermove=null;heading.onpointerup=null;heading.onpointercancel=null;};
}
