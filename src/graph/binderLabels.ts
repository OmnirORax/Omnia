/** Camera-facing text packing; no graph geometry or saved positions are changed. */
export type ScreenBox={x:number;y:number;width:number;height:number;angle?:number;radius?:number;innerRadius?:number};
export type BinderLabelAnchor={x:number;y:number;dx:number;dy:number;width:number;height:number};
const bounds=(box:ScreenBox)=>{const c=Math.abs(Math.cos(box.angle??0)),s=Math.abs(Math.sin(box.angle??0));return {x:box.x,y:box.y,width:c*box.width+s*box.height,height:s*box.width+c*box.height};};
export function screenBoxesOverlap(a:ScreenBox,b:ScreenBox,gap=0):boolean {
 if(a.radius!==undefined&&b.radius!==undefined)return Math.hypot(a.x-b.x,a.y-b.y)<a.radius+b.radius+gap;
 if(a.radius!==undefined)return screenBoxesOverlap(b,a,gap);
 if(b.radius!==undefined){const c=Math.cos(a.angle??0),s=Math.sin(a.angle??0),dx=b.x-a.x,dy=b.y-a.y,x=Math.abs(c*dx+s*dy),y=Math.abs(-s*dx+c*dy);return Math.hypot(Math.max(0,x-a.width/2),Math.max(0,y-a.height/2))<b.radius+gap&&(!b.innerRadius||Math.hypot(x+a.width/2,y+a.height/2)>b.innerRadius-gap);}
 const ca=Math.cos(a.angle??0),sa=Math.sin(a.angle??0),cb=Math.cos(b.angle??0),sb=Math.sin(b.angle??0);
 const cosine=Math.abs(ca*cb+sa*sb),sine=Math.abs(ca*sb-sa*cb),dx=b.x-a.x,dy=b.y-a.y;
 return Math.abs(dx*ca+dy*sa)<a.width/2+cosine*b.width/2+sine*b.height/2+gap
  &&Math.abs(-dx*sa+dy*ca)<a.height/2+sine*b.width/2+cosine*b.height/2+gap
  &&Math.abs(dx*cb+dy*sb)<b.width/2+cosine*a.width/2+sine*a.height/2+gap
  &&Math.abs(-dx*sb+dy*cb)<b.height/2+sine*a.width/2+cosine*a.height/2+gap;
}
/** One index per camera/layout update, shared by every binder. */
export function createLabelSpace(obstacles:readonly ScreenBox[],width:number,height:number,gap=3){
 const valid=(box:ScreenBox)=>[box.x,box.y,box.width,box.height,box.angle??0].every(Number.isFinite)&&box.width>0&&box.height>0;
 const bins=new Map<string,ScreenBox[]>(),size=Math.max(64,width/16,height/16);
 const keys=(box:ScreenBox)=>{const b=bounds(box),keys:string[]=[];for(let x=Math.max(-1,Math.floor((b.x-b.width/2-gap)/size));x<=Math.min(Math.ceil(width/size),Math.floor((b.x+b.width/2+gap)/size));x++)for(let y=Math.max(-1,Math.floor((b.y-b.height/2-gap)/size));y<=Math.min(Math.ceil(height/size),Math.floor((b.y+b.height/2+gap)/size));y++)keys.push(`${x},${y}`);return keys;};
 const reserve=(box:ScreenBox)=>{if(!valid(box))return;for(const key of keys(box)){const list=bins.get(key)??[];list.push(box);bins.set(key,list);}};
 obstacles.forEach(reserve);
 const within=(box:ScreenBox)=>{if(!valid(box))return false;const b=bounds(box);return b.x-b.width/2>=2&&b.y-b.height/2>=2&&b.x+b.width/2<=width-2&&b.y+b.height/2<=height-2;};
 const blockers=(box:ScreenBox)=>{const seen=new Set<ScreenBox>(),found:ScreenBox[]=[];for(const key of keys(box))for(const other of bins.get(key)??[]){if(seen.has(other))continue;seen.add(other);if(screenBoxesOverlap(box,other,gap))found.push(other);}return found;};
 return {gap,reserve,within,blockers,fits:(box:ScreenBox)=>within(box)&&blockers(box).length===0};
}
/** Text extends from a binder sample along its screen-space normal. Try both
 * sides and bounded samples; never fall back to drawing over an occupied node. */
export function placeBinderText(space:ReturnType<typeof createLabelSpace>,anchors:readonly BinderLabelAnchor[]):(ScreenBox&{anchor:number;leader:number})|undefined {
 for(let index=0;index<anchors.length;index++){
  const a=anchors[index],length=Math.hypot(a.dx,a.dy);if(length<1e-9)continue;
  const normal={x:-a.dy/length,y:a.dx/length},preferred=normal.x<0?-1:1;
  let best:(ScreenBox&{anchor:number;leader:number})|undefined;
  for(const sign of [preferred,-preferred]){
   const nx=normal.x*sign,ny=normal.y*sign;let angle=Math.atan2(ny,nx),leader=0;
   if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
   for(let attempt=0;attempt<8;attempt++){
    const box={x:a.x+nx*(a.width/2+space.gap+leader),y:a.y+ny*(a.width/2+space.gap+leader),width:a.width,height:a.height,angle,anchor:index,leader};
    if(!space.within(box))break;
    const blocked=space.blockers(box);
    if(!blocked.length){if(!best||leader<best.leader)best=box;break;}
    // Push the text past the obstructing projected ink, retaining its root at
    // the binder through a short perpendicular stem. Do not clip the glyphs.
    leader=Math.max(leader+1,...blocked.map(other=>{
      const c=Math.cos(other.angle??0),s=Math.sin(other.angle??0);
      const extent=other.radius??(Math.abs(c*nx+s*ny)*other.width/2+Math.abs(-s*nx+c*ny)*other.height/2);
      return (other.x-a.x)*nx+(other.y-a.y)*ny+extent+.5;
    }));
   }
   if(best?.leader===0)break;
  }
  if(best){space.reserve(best);return best;}
 }
 return undefined;
}
