export type HoverValue={start:(x:number)=>void;move:(x:number)=>void;commit:()=>void;cancel:()=>void};
/** One uncommitted value owns the pointer until accepted, cancelled or replaced. */
export function createHoverPreview(){
 const listeners=new Set<()=>void>(),notify=()=>listeners.forEach(listener=>listener());
 let current:{owner:object;value:HoverValue}|undefined;
 const cancel=()=>{const previous=current;current=undefined;previous?.value.cancel();notify();};
 return {subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>{listeners.delete(listener);};},active:()=>!!current,owns:(owner:object)=>current?.owner===owner,
  enter(owner:object,value:HoverValue,x:number){if(current?.owner===owner)return;cancel();current={owner,value};value.start(x);notify();},
  move(x:number){current?.value.move(x);},
  commit(){const previous=current;current=undefined;previous?.value.commit();notify();return !!previous;},
  cancel,
  release(owner:object){if(current?.owner===owner)cancel();},
 };
}
