/** Bounds use viewport fractions, with y increasing downward. */
export type ScreenTextBounds={left:number;top:number;right:number;bottom:number};

export function mergeVisibleTextBounds(a:ScreenTextBounds|undefined,b:ScreenTextBounds){
 const left=Math.max(0,b.left),top=Math.max(0,b.top),right=Math.min(1,b.right),bottom=Math.min(1,b.bottom);
 if(!(left<right&&top<bottom))return a;
 return a?{left:Math.min(a.left,left),top:Math.min(a.top,top),right:Math.max(a.right,right),bottom:Math.max(a.bottom,bottom)}:{left,top,right,bottom};
}

const documents=new Map<object,ScreenTextBounds>();
const demandListeners=new Set<()=>void>(),repaintListeners=new Set<()=>void>();
const viewport={left:0,top:0,right:1,bottom:1};
let world:ScreenTextBounds|undefined,enabled=false,position=viewport;
function publish(repaint:boolean){
 let bounds=world;
 for(const box of documents.values())bounds=mergeVisibleTextBounds(bounds,box);
 const next=bounds??viewport,{left,top,right,bottom}=next;
 if(Math.abs(left-position.left)<1e-6&&Math.abs(top-position.top)<1e-6&&Math.abs(right-position.right)<1e-6&&Math.abs(bottom-position.bottom)<1e-6)return;
 position=next;
 if(typeof document!=='undefined'){
  const style=document.documentElement?.style;
  style?.setProperty?.('--visible-text-left',`${left*100}vw`);
  style?.setProperty?.('--visible-text-top',`${top*100}vh`);
  style?.setProperty?.('--visible-text-width',`${(right-left)*100}vw`);
  style?.setProperty?.('--visible-text-height',`${(bottom-top)*100}vh`);
 }
 if(repaint)for(const listener of repaintListeners)listener();
}

export const visibleTextCenter={
 get enabled(){return enabled;},
 get bounds(){return position;},
 setEnabled(next:boolean){
  if(next===enabled)return;
  enabled=next;
  if(!enabled){documents.clear();world=undefined;publish(true);}
  for(const listener of demandListeners)listener();
 },
 updateDocument(key:object,bounds?:ScreenTextBounds){
  if(!enabled)return;
  if(bounds)documents.set(key,bounds);else documents.delete(key);
  publish(true);
 },
 updateWorld(bounds?:ScreenTextBounds){if(enabled){world=bounds;publish(false);}},
 onDemand(listener:()=>void){demandListeners.add(listener);return ()=>{demandListeners.delete(listener);};},
 onRepaint(listener:()=>void){repaintListeners.add(listener);return ()=>{repaintListeners.delete(listener);};},
};
