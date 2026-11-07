/** Transient binder text: fixed midpoint attachment, no obstacle packing. */
export type BinderLabelAnchor={x:number;y:number;dx:number;dy:number;width:number;height:number};
export function placeBinderText(a:BinderLabelAnchor):({x:number;y:number;angle:number})|undefined {
 const length=Math.hypot(a.dx,a.dy);
 if(![a.x,a.y,a.dx,a.dy,a.width,a.height].every(Number.isFinite)||length<1e-9||a.width<=0||a.height<=0)return undefined;
 const nx=-a.dy/length,ny=a.dx/length;
 let angle=Math.atan2(ny,nx);
 // Keep glyphs upright without changing the directed side/attachment.
 if(angle>Math.PI/2)angle-=Math.PI;if(angle< -Math.PI/2)angle+=Math.PI;
 return {x:a.x+nx*a.width/2,y:a.y+ny*a.width/2,angle};
}
