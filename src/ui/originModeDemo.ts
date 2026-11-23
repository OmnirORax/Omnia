import {emptyWorld,type Vec3} from '../core/model.ts';
import {planarOriginDirections,sideAxes,type OriginDirections} from '../core/originDirections.ts';
import {createPaintSession} from '../core/painting.ts';
import type {AxisFrame} from '../core/axes.ts';
/** A bounded, read-only example using the real placement/validation owner. */
export function originModeDemo(settings:OriginDirections,active:readonly number[]){
 const world=emptyWorld(),directions=planarOriginDirections(settings,active),basis:[Vec3,Vec3,Vec3]=[[1,0,0],[0,1,0],[0,0,1]],frame:AxisFrame={id:'example',origin:[0,0,0],ends:[],members:[],x:basis[0],y:basis[1],z:basis[2],activeAxes:sideAxes(directions.sides!),directions};
 const session=createPaintSession(world,[0,0,0],basis,frame),probes:Vec3[]=[[2.3,1.2,0],[-2.3,1.2,0],[-2.3,-1.2,0],[2.3,-1.2,0],[2.3,0,0],[-2.3,0,0],[0,2.3,0],[0,-2.3,0]];
 let cursor=probes[0],candidate=session.candidate(cursor);for(const point of probes){const next=session.candidate(point);if(next.valid){cursor=point;candidate=next;break;}}
 const scale=.18,project=(point:Vec3)=>({x:point[0]*scale,y:-point[1]*scale}),sites=new Map<string,{x:number;y:number}>();
 if(directions.mode==='area')for(let x=-3;x<=3;x++)for(let y=-3;y<=3;y++){const next=session.candidate([x,y,0]);if(next.valid){const p=project(next.anchor);if(Math.hypot(p.x,p.y)<.67)sites.set(`${p.x},${p.y}`,p);}}
 return {cursor:project(cursor),anchor:project(candidate.anchor),positions:candidate.valid?candidate.stamp.map(project).filter(p=>Math.hypot(p.x,p.y)<.68):[],sites:[...sites.values()],valid:candidate.valid,rejection:candidate.rejection};
}
