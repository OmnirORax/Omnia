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

/** CSS rotation is around the frame centre; keep the working hotspot on target. */
export function cursorOrigin(target:{x:number;y:number},width:number,height:number,anchor={x:.5,y:.5},turns=0){
  const x=(anchor.x-.5)*width,y=(anchor.y-.5)*height,a=turns*Math.PI*2;
  return {x:target.x-width/2-x*Math.cos(a)+y*Math.sin(a),y:target.y-height/2-x*Math.sin(a)-y*Math.cos(a)};
}

export function projectCursorTarget(area:CursorArea,normalized:{x:number;y:number}){
  const edge=Math.min(area.width,area.height);
  return {x:area.left+area.width/2+(normalized.x-.5)*edge,y:area.top+area.height/2+(normalized.y-.5)*edge};
}
