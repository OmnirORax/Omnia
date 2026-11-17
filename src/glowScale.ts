/** Shared legibility policy. Resolve detail in output pixels, independently of
 * node count, camera location and the much smaller bloom-mask resolution. */
export const GLOW_DETAIL_PIXELS={off:1.5,full:4} as const;
export function glowScale(pixels:number){return Number.isNaN(pixels)?0:Math.max(0,Math.min(1,(pixels-GLOW_DETAIL_PIXELS.off)/(GLOW_DETAIL_PIXELS.full-GLOW_DETAIL_PIXELS.off)));}
export const glowScaleGLSL=`float zoomGlowScale(float pixels){return clamp((pixels-${GLOW_DETAIL_PIXELS.off.toFixed(1)})/${(GLOW_DETAIL_PIXELS.full-GLOW_DETAIL_PIXELS.off).toFixed(1)},0.,1.);}`;
/** No bounds discovery: callers lend an existing bound and current matrices. */
export function projectedGlowDetail(feature:number,world:readonly number[],view:readonly number[],projectionY:number,height:number,perspective:boolean,center:{x:number;y:number;z:number}={x:0,y:0,z:0}){
 const x=world[0]*center.x+world[4]*center.y+world[8]*center.z+world[12],y=world[1]*center.x+world[5]*center.y+world[9]*center.z+world[13],z=world[2]*center.x+world[6]*center.y+world[10]*center.z+world[14];
 const depth=perspective?Math.max(.00001,-(view[2]*x+view[6]*y+view[10]*z+view[14])):1;
 const scale=Math.min(Math.hypot(world[0],world[1],world[2]),Math.hypot(world[4],world[5],world[6]));
 return feature*scale*Math.abs(projectionY)*height/(2*depth);
}
