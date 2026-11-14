export type HoverValue={start:(x:number)=>void;move:(x:number)=>void;commit:()=>void;cancel:()=>void};
/** One uncommitted value owns the pointer until accepted, cancelled or replaced. */
export function createHoverPreview(){
 let current:{owner:object;value:HoverValue}|undefined;
 const cancel=()=>{const previous=current;current=undefined;previous?.value.cancel();};
 return {active:()=>!!current,owns:(owner:object)=>current?.owner===owner,
  enter(owner:object,value:HoverValue,x:number){if(current?.owner===owner)return;cancel();current={owner,value};value.start(x);},
  move(x:number){current?.value.move(x);},
  commit(){const previous=current;current=undefined;previous?.value.commit();return !!previous;},
  cancel,
  release(owner:object){if(current?.owner===owner)cancel();},
 };
}
