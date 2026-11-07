/** Camera-facing text packing; no graph geometry or saved positions are changed. */
export type ScreenBox={x:number;y:number;width:number;height:number;angle?:number};
export type BinderLabelAnchor={x:number;y:number;dx:number;dy:number;width:number;height:number};
const bounds=(box:ScreenBox)=>{const c=Math.abs(Math.cos(box.angle??0)),s=Math.abs(Math.sin(box.angle??0));return {x:box.x,y:box.y,width:c*box.width+s*box.height,height:s*box.width+c*box.height};};
export function screenBoxesOverlap(a:ScreenBox,b:ScreenBox,gap=0):boolean {
 const axes=(box:ScreenBox)=>{const c=Math.cos(box.angle??0),s=Math.sin(box.angle??0);return [{x:c,y:s},{x:-s,y:c}];};
 const aa=axes(a),bb=axes(b),dx=b.x-a.x,dy=b.y-a.y;
 const radius=(box:ScreenBox,axes:{x:number;y:number}[],axis:{x:number;y:number})=>Math.abs(axes[0].x*axis.x+axes[0].y*axis.y)*box.width/2+Math.abs(axes[1].x*axis.x+axes[1].y*axis.y)*box.height/2;
 return [...aa,...bb].every(axis=>Math.abs(dx*axis.x+dy*axis.y)<radius(a,aa,axis)+radius(b,bb,axis)+gap);
}
/** One index per camera/layout update, shared by every binder. */
export function createLabelSpace(obstacles:readonly ScreenBox[],width:number,height:number,gap=3){
 const valid=(box:ScreenBox)=>[box.x,box.y,box.width,box.height,box.angle??0].every(Number.isFinite)&&box.width>0&&box.height>0;
 const bins=new Map<string,ScreenBox[]>(),size=Math.max(64,width/16,height/16);
 const keys=(box:ScreenBox)=>{const b=bounds(box),keys:string[]=[];for(let x=Math.max(-1,Math.floor((b.x-b.width/2-gap)/size));x<=Math.min(Math.ceil(width/size),Math.floor((b.x+b.width/2+gap)/size));x++)for(let y=Math.max(-1,Math.floor((b.y-b.height/2-gap)/size));y<=Math.min(Math.ceil(height/size),Math.floor((b.y+b.height/2+gap)/size));y++)keys.push(`${x},${y}`);return keys;};
 const reserve=(box:ScreenBox)=>{if(!valid(box))return;for(const key of keys(box)){const list=bins.get(key)??[];list.push(box);bins.set(key,list);}};
 obstacles.forEach(reserve);
 return {gap,reserve,fits(box:ScreenBox){if(!valid(box))return false;const b=bounds(box);if(b.x-b.width/2<2||b.y-b.height/2<2||b.x+b.width/2>width-2||b.y+b.height/2>height-2)return false;return !keys(box).some(key=>(bins.get(key)??[]).some(other=>screenBoxesOverlap(box,other,gap)));}};
}
/** Text extends from a binder sample along its screen-space normal. Try both
 * sides and bounded samples; never fall back to drawing over an occupied node. */
export function placeBinderText(space:ReturnType<typeof createLabelSpace>,anchors:readonly BinderLabelAnchor[]):(ScreenBox&{anchor:number})|undefined {
 for(let index=0;index<anchors.length;index++){
  const a=anchors[index],length=Math.hypot(a.dx,a.dy);if(length<1e-9)continue;
  const normal={x:-a.dy/length,y:a.dx/length};
  const preferred=normal.x<0?-1:1;
  for(const sign of [preferred,-preferred]){
   const nx=normal.x*sign,ny=normal.y*sign;let angle=Math.atan2(ny,nx);
   if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
   const box={x:a.x+nx*(a.width/2+space.gap),y:a.y+ny*(a.width/2+space.gap),width:a.width,height:a.height,angle,anchor:index};
   if(space.fits(box)){space.reserve(box);return box;}
  }
 }
 return undefined;
}
