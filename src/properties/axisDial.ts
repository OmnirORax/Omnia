export type AxisDialRay={id:string;point:{x:number;y:number};start?:{x:number;y:number};selected:boolean;preview?:boolean;threshold?:boolean;color?:string;kind?:'axis'|'direction';oneSided?:boolean;label?:string};
/** Shared normalized geometry for axis selectors and rotation/value dials. */
export const AXIS_DIAL={hub:.09,axisInner:.18,axisOuter:.56,needleOuter:.70,tickInner:.81,tickOuter:.90,rim:.95,bandBoundary:.72};
export function dialPoint(point:{x:number;y:number},radius:number){const length=Math.hypot(point.x,point.y);return length?{x:point.x/length*radius,y:point.y/length*radius}:{x:0,y:0};}
export function dialSegments(ray:AxisDialRay){
 if(ray.kind==='axis')return (ray.oneSided?[1]:[1,-1]).map(sign=>({a:dialPoint(ray.point,AXIS_DIAL.axisInner*sign),b:dialPoint(ray.point,AXIS_DIAL.axisOuter*sign)}));
 return [{a:dialPoint(ray.point,ray.threshold?.76:AXIS_DIAL.tickInner),b:dialPoint(ray.point,AXIS_DIAL.tickOuter)}];
}
export function dialTickWidth(count:number){return Math.min(.014,2*Math.PI*.85/Math.max(1,count)*.38);}
/** Separate annular direction picking from inner axis picking; the centre is neutral. */
export function pickAxisDial(point:{x:number;y:number},rays:readonly AxisDialRay[],axisTolerance=.11){
 const radius=Math.hypot(point.x,point.y);if(!Number.isFinite(radius)||radius>1||radius<AXIS_DIAL.axisInner)return;
 if(radius>=AXIS_DIAL.bandBoundary){const p=dialPoint(point,AXIS_DIAL.tickOuter);let best:AxisDialRay|undefined,distance=Infinity;for(const ray of rays){if(ray.kind==='axis')continue;const q=dialPoint(ray.point,AXIS_DIAL.tickOuter),d=(p.x-q.x)**2+(p.y-q.y)**2;if(d<distance){distance=d;best=ray;}}return best;}
 let best:AxisDialRay|undefined,distance=axisTolerance**2;
 for(const ray of rays){if(ray.kind!=='axis')continue;for(const {a,b}of dialSegments(ray)){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy))),d=(point.x-a.x-t*dx)**2+(point.y-a.y-t*dy)**2;if(d<distance){distance=d;best=ray;}}}return best;
}

/** Sector order shares the placement owner's counter-clockwise direction slots. */
export function dialAreaPath(index:number,count=4){const radius=AXIS_DIAL.needleOuter,point=(i:number)=>[radius*Math.cos(i/count*Math.PI*2),-radius*Math.sin(i/count*Math.PI*2)],a=point(index),b=point(index+1);return `M0 0 L${a[0]} ${a[1]} A${radius} ${radius} 0 0 0 ${b[0]} ${b[1]} Z`;}
