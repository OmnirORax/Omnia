export type HoverValue={relative?:boolean;surface?:HTMLElement;capturePress?:boolean;start:(x:number,y?:number)=>void;move:(x:number,y?:number)=>void;commit:()=>void;cancel:()=>void};
/** One uncommitted value owns the pointer until accepted, cancelled or replaced. */
export function createHoverPreview(allowed:()=>boolean=()=>true){
 const listeners=new Set<()=>void>(),notify=()=>listeners.forEach(listener=>listener());
 let current:{owner:object;value:HoverValue;origin:{x:number;y:number}}|undefined;
 const cancel=()=>{const previous=current;current=undefined;previous?.value.cancel();notify();};
 return {subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},active:()=>!!current,relativeInput:()=>current?.value.relative?{surface:current.value.surface,origin:current.origin}:undefined,capturesPress:()=>current?.value.capturePress!==false,owns:(owner:object)=>current?.owner===owner,
  enter(owner:object,value:HoverValue,x:number,y=0){if(!allowed()){cancel();return;}if(current?.owner===owner)return;cancel();current={owner,value,origin:{x,y}};notify();value.start(x,y);},
  move(x:number,y=0){current?.value.move(x,y);},
  commit(){const previous=current;current=undefined;previous?.value.commit();notify();return !!previous;},
  cancel,
  release(owner:object){if(current?.owner===owner)cancel();},
 };
}
