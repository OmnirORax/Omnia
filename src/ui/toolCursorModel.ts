/** Highest priority wins; equal priorities use the most recently activated owner. */
export function activeToolCursor<T extends {priority?:number}>(requests:Iterable<T>,applicable:(request:T)=>boolean=()=>true):T|null {
  let current:T|null=null;
  for(const request of requests)if(applicable(request)&&(!current||(request.priority??0)>=(current.priority??0)))current=request;
  return current;
}

/** Missing applicability is never a website-wide tool by accident. */
export function cursorApplies(request:{zone?:string;parked?:unknown},zone:string|undefined,blocked=false){
  if(request.parked)return true;
  return !blocked&&!!request.zone&&(request.zone==='*'||request.zone===zone);
}

export type CursorArea={left:number;top:number;width:number;height:number;circle?:boolean};
export function inCursorArea(point:{x:number;y:number},area:CursorArea){
  const x=point.x-area.left,y=point.y-area.top;
  if(x<0||y<0||x>area.width||y>area.height)return false;
  if(!area.circle)return true;
  return Math.hypot(x-area.width/2,y-area.height/2)<=Math.min(area.width,area.height)/2;
}
