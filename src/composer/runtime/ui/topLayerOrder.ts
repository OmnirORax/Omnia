/** Native popovers follow opening order, independently of CSS z-index. Track
 * those transitions and keep registered interaction layers above content. */
export type TopLayerNode={isConnected:boolean;matches:(selector:string)=>boolean;hidePopover:()=>void;showPopover:()=>void};
export function createTopLayerOrder<T extends TopLayerNode>(schedule:(run:()=>void)=>void=queueMicrotask,retainFocus:(run:()=>void)=>void=run=>run()){
 const priorities=new Map<T,number>();let order:T[]=[],pending=false,raising=false;
 const reconcile=()=>{
  pending=false;if(raising||!priorities.size)return;raising=true;
  try{retainFocus(()=>{
   order=order.filter(node=>node.isConnected&&node.matches(':popover-open'));
   const layers=[...priorities].filter(([node])=>node.isConnected&&node.matches(':popover-open')).sort((a,b)=>a[1]-b[1]);
   let previous=Math.max(-1,...order.flatMap((node,index)=>priorities.has(node)?[]:[index]));
   for(const [node] of layers){if(!priorities.has(node)||!node.isConnected||!node.matches(':popover-open'))continue;let index=order.indexOf(node);if(index<=previous){node.hidePopover();node.showPopover();order=order.filter(item=>item!==node);order.push(node);index=order.length-1;}previous=index;}
  });}finally{raising=false;}
 };
 const request=()=>{if(!pending&&!raising){pending=true;schedule(reconcile);}};
 return {
  transition(node:T,open:boolean){order=order.filter(item=>item!==node);if(open)order.push(node);if(open)request();},
  register(node:T,priority:number){priorities.set(node,priority);if(node.matches(':popover-open')&&!order.includes(node))order.push(node);request();return()=>{priorities.delete(node);order=priorities.size?order.filter(item=>item!==node):[];};},
 };
}
const order=createTopLayerOrder<HTMLElement>(queueMicrotask,run=>{
 const focused=document.activeElement;try{run();}finally{
  if(focused instanceof HTMLElement&&focused.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});
 }
});let users=0;
const opening=(event:Event)=>{if(event.target instanceof HTMLElement&&event.target.hasAttribute('popover'))order.transition(event.target,(event as ToggleEvent).newState==='open');};
/** Registration belongs to the mounted host owner. Native opening events also
 * cover content popovers opened by other/future systems without private wiring. */
export function registerTopLayerPriority(node:HTMLElement,priority:number){
 if(users++===0)document.addEventListener('beforetoggle',opening,true);
 const remove=order.register(node,priority);return()=>{remove();if(--users===0)document.removeEventListener('beforetoggle',opening,true);};
}
export const TOP_LAYER_PRIORITY={preview:100,cursor:10000} as const;
