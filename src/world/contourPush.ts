import type {Point2} from './contentEnvelope.ts';
export type ContourBody={id:string;x:number;y:number;points:readonly Point2[];passive?:boolean;fixed?:boolean};
type Box={left:number;right:number;top:number;bottom:number};
const shapes=new WeakMap<readonly Point2[],{bounds:Box;axes:Map<string,Point2>;axisKey:string;axisList:[string,Point2][];projections:Map<string,[number,number]>}>();
function shape(points:readonly Point2[]){
 let value=shapes.get(points);if(value)return value;
 const axes=new Map<string,Point2>();for(let n=0;n<points.length;n++){const p=points[n],q=points[(n+1)%points.length],len=Math.hypot(q.x-p.x,q.y-p.y);if(len<1e-12)continue;let x=-(q.y-p.y)/len,y=(q.x-p.x)/len;if(x<0||x===0&&y<0){x=-x;y=-y;}x=Math.round(x*1e10)/1e10;y=Math.round(y*1e10)/1e10;axes.set(`${x}:${y}`,{x,y});}
 value={bounds:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))},axes,axisKey:[...axes.keys()].sort().join(';'),axisList:[...axes],projections:new Map()};shapes.set(points,value);return value;
}
const box=(body:ContourBody):Box=>{const b=shape(body.points).bounds;return {left:b.left+body.x,right:b.right+body.x,top:b.top+body.y,bottom:b.bottom+body.y};};
/** Convex SAT intervals are cached per local shape/direction, not per pair. */
export function contourClearance(a:ContourBody,b:ContourBody,direction:Point2,gap=0){
 const ashape=shape(a.points),bshape=shape(b.points),axes=ashape.axisKey===bshape.axisKey?ashape.axisList:[...new Map([...ashape.axes,...bshape.axes])];let clearance=Infinity;
 const interval=(body:ContourBody,cache:ReturnType<typeof shape>,key:string,n:Point2)=>{let local=cache.projections.get(key);if(!local){let lo=Infinity,hi=-Infinity;for(const p of body.points){const v=p.x*n.x+p.y*n.y;lo=Math.min(lo,v);hi=Math.max(hi,v);}local=[lo,hi];cache.projections.set(key,local);}return local;};
 for(const [key,n]of axes){const av=interval(a,ashape,key,n),bv=interval(b,bshape,key,n),as=a.x*n.x+a.y*n.y,bs=b.x*n.x+b.y*n.y,amin=av[0]+as,amax=av[1]+as,bmin=bv[0]+bs,bmax=bv[1]+bs;
  if(bmin>=amax+gap-1e-7||amin>=bmax+gap-1e-7)return 0;
  const speed=n.x*direction.x+n.y*direction.y;if(speed>1e-9)clearance=Math.min(clearance,(amax+gap-bmin)/speed);else if(speed< -1e-9)clearance=Math.min(clearance,(bmax+gap-amin)/-speed);
 }
 return Number.isFinite(clearance)?Math.max(0,clearance):0;
}
/** Solve only on content/anchor changes, never on camera motion. Pin the active
 * node and place neighbors outward from a stable baseline. No viewport clamp.
 * A spatial hash handles ordinary local pushes; a conservative radial fallback
 * bounds pathological dense chains without dropping any collider. */
export function pushContours(items:readonly ContourBody[],pin?:{id:string;x:number;y:number},gap=2){
 const result=new Map<string,Point2>();if(!items.length)return result;
 const root=items.find(i=>i.id===pin?.id)??items.find(item=>item.fixed)??[...items].sort((a,b)=>a.id.localeCompare(b.id))[0],origin=pin?.id===root.id?pin:root;
 const ordered=[...items].sort((a,b)=>a.id===b.id?0:a.id===root.id?-1:b.id===root.id?1:a.fixed&&!b.fixed?-1:b.fixed&&!a.fixed?1:Math.hypot(a.x-root.x,a.y-root.y)-Math.hypot(b.x-root.x,b.y-root.y)||a.id.localeCompare(b.id));
 const bins=new Map<string,ContourBody[]>(),large:ContourBody[]=[],size=128;let radius=0,work=0;
 const cells=(b:Box)=>{const left=Math.floor(b.left/size),right=Math.floor(b.right/size),top=Math.floor(b.top/size),bottom=Math.floor(b.bottom/size);if((right-left+1)*(bottom-top+1)>256)return undefined;const keys:string[]=[];for(let x=left;x<=right;x++)for(let y=top;y<=bottom;y++)keys.push(`${x}:${y}`);return keys;};
 const placed:ContourBody[]=[],shifted=new Set<string>();
 for(const source of ordered){
  const body={...source,x:source.id===root.id?origin.x:source.x,y:source.id===root.id?origin.y:source.y};
  const dx=source.x-root.x,dy=source.y-root.y,d=Math.hypot(dx,dy),direction=d>1e-8?{x:dx/d,y:dy/d}:{x:source.id<root.id?-1:1,y:0};
  if(source.id!==root.id&&!source.fixed){const projection=(body.x-origin.x)*direction.x+(body.y-origin.y)*direction.y;if(projection<0){body.x-=direction.x*projection;body.y-=direction.y*projection;}}
  if(body.x!==source.x||body.y!==source.y)shifted.add(body.id);
  if(source.id!==root.id&&!source.fixed)for(let iteration=0;iteration<=placed.length;iteration++){
   if(work>24000){const r=Math.max(...body.points.map(p=>Math.hypot(p.x,p.y)))+radius+gap+1;body.x=origin.x+direction.x*r;body.y=origin.y+direction.y*r;shifted.add(body.id);break;}
   const bounds=box(body),keys=cells({left:bounds.left-gap,right:bounds.right+gap,top:bounds.top-gap,bottom:bounds.bottom+gap}),neighbors=keys?[...new Set([...large,...keys.flatMap(k=>bins.get(k)??[])])]:placed;
   let move=0;
   for(const obstacle of neighbors){if(body.passive&&!shifted.has(body.id)&&obstacle.passive&&!shifted.has(obstacle.id))continue;work++;const ob=box(obstacle);if(bounds.right+gap<ob.left||bounds.left-gap>ob.right||bounds.bottom+gap<ob.top||bounds.top-gap>ob.bottom)continue;move=Math.max(move,contourClearance(obstacle,body,direction,gap));}
   if(move<1e-7)break;shifted.add(body.id);body.x+=direction.x*(move+1e-5);body.y+=direction.y*(move+1e-5);
  }
  result.set(body.id,{x:body.x,y:body.y});placed.push(body);radius=Math.max(radius,...body.points.map(p=>Math.hypot(body.x+p.x-origin.x,body.y+p.y-origin.y)));
  const keys=cells(box(body));if(!keys)large.push(body);else for(const key of keys){const bin=bins.get(key)??[];bin.push(body);bins.set(key,bin);}
 }
 return result;
}
