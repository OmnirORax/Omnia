type Point={x:number;y:number};
/** Invocation is an opening event, not a live dependency of preview renders. */
export function createPopupInvocation(read:()=>Point){
 let opened=false,point:Point|null=null;
 return {sample(open:boolean){
  if(open&&!opened)point={...read()};
  if(!open)point=null;
  opened=open;return point;
 }};
}
