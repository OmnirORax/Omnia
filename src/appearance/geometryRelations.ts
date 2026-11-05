import type {Box,Point} from './selectionGeometry.ts';
/** Renderer-independent visible-ink primitives. Holes are separate from enclosure:
 * a ring contains objects in its hole without being connected to them. */
export type ConvexInk={kind:'circle';center:Point;radius:number;clip?:readonly Point[]}|{kind:'capsule';a:Point;b:Point;radius:number}|{kind:'polygon';points:readonly Point[]};
export type InkPiece={outer:ConvexInk;hole?:{center:Point;radius:number}};
export type RelationGeometry={ink:readonly InkPiece[];enclosure?:ConvexInk};
const EPS=1e-7;
const dot=(a:Point,b:Point)=>a.x*b.x+a.y*b.y;
const sub=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const norm=(p:Point)=>Math.hypot(p.x,p.y);
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
export function convexPolygon(points:readonly Point[]){
 if(points.length<3)return false;let sign=0;
 for(let i=0;i<points.length;i++){const n=cross(sub(points[(i+1)%points.length],points[i]),sub(points[(i+2)%points.length],points[(i+1)%points.length]));if(Math.abs(n)<=EPS)continue;if(sign&&Math.sign(n)!==sign)return false;sign=Math.sign(n);}
 return sign!==0;
}
export function inConvexPolygon(points:readonly Point[],point:Point){
 let sign=0;for(let i=0;i<points.length;i++){const n=cross(sub(points[(i+1)%points.length],points[i]),sub(point,points[i]));if(Math.abs(n)<=EPS)continue;if(sign&&Math.sign(n)!==sign)return false;sign=Math.sign(n);}return points.length>=3;
}
const clipVertices=new WeakMap<object,readonly Point[]>();
/** Finite endpoints of a circle/convex-clip intersection. Arc extrema are added
 * by support() in the queried direction, retaining exact circle tangencies. */
function circleClipVertices(shape:Extract<ConvexInk,{kind:'circle'}>){
 let saved=clipVertices.get(shape);if(saved)return saved;
 const result:Point[]=[],points=shape.clip!;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],d=sub(b,a),v=sub(a,shape.center),aa=dot(d,d),bb=2*dot(v,d),cc=dot(v,v)-shape.radius**2;
  if(norm(v)<=shape.radius+EPS)result.push(a);
  const discriminant=bb*bb-4*aa*cc;if(!aa||discriminant<-EPS)continue;
  for(const t of [(-bb-Math.sqrt(Math.max(0,discriminant)))/(2*aa),(-bb+Math.sqrt(Math.max(0,discriminant)))/(2*aa)])if(t>=-EPS&&t<=1+EPS)result.push({x:a.x+t*d.x,y:a.y+t*d.y});
 }
 clipVertices.set(shape,result);return result;
}
export function inkSupport(shape:ConvexInk,direction:Point):Point|undefined{
 const length=norm(direction)||1,offset=(r:number)=>({x:direction.x*r/length,y:direction.y*r/length});
 if(shape.kind==='polygon')return shape.points.reduce<Point|undefined>((best,p)=>!best||dot(p,direction)>dot(best,direction)?p:best,undefined);
 if(shape.kind==='capsule'){const end=dot(shape.a,direction)>dot(shape.b,direction)?shape.a:shape.b,o=offset(shape.radius);return {x:end.x+o.x,y:end.y+o.y};}
 const o=offset(shape.radius),extreme={x:shape.center.x+o.x,y:shape.center.y+o.y};
 if(!shape.clip||inConvexPolygon(shape.clip,extreme))return extreme;
 return circleClipVertices(shape).reduce<Point|undefined>((best,p)=>!best||dot(p,direction)>dot(best,direction)?p:best,undefined);
}
function closestSimplex(simplex:Point[]):{simplex:Point[];point:Point}{
 if(simplex.length===1)return {simplex,point:simplex[0]};
 if(simplex.length===3){const [a,b,c]=simplex,ab=cross(sub(b,a),{x:-a.x,y:-a.y}),bc=cross(sub(c,b),{x:-b.x,y:-b.y}),ca=cross(sub(a,c),{x:-c.x,y:-c.y});
  if(Math.abs(cross(sub(b,a),sub(c,a)))>EPS&&((ab>=-EPS&&bc>=-EPS&&ca>=-EPS)||(ab<=EPS&&bc<=EPS&&ca<=EPS)))return {simplex,point:{x:0,y:0}};
 }
 let best:{simplex:Point[];point:Point}|undefined;
 for(let i=0;i<simplex.length-1;i++)for(let j=i+1;j<simplex.length;j++){const a=simplex[i],b=simplex[j],d=sub(b,a),t=Math.max(0,Math.min(1,-dot(a,d)/(dot(d,d)||1))),point={x:a.x+t*d.x,y:a.y+t*d.y};if(!best||dot(point,point)<dot(best.point,best.point))best={simplex:t===0?[a]:t===1?[b]:[a,b],point};}
 return best!;
}
/** Bounded support-map intersection for discs, capsules and convex clipped paint.
 * No search radius or colour threshold becomes a geometric connection. */
export function convexInkTouches(a:ConvexInk,b:ConvexInk){
 if(a.kind==='circle'&&!a.clip&&b.kind==='circle'&&!b.clip)return norm(sub(a.center,b.center))<=a.radius+b.radius+EPS;
 const support=(d:Point)=>{const x=inkSupport(a,d),y=inkSupport(b,{x:-d.x,y:-d.y});return x&&y?sub(x,y):undefined;};
 const first=support({x:1,y:0});if(!first)return false;
 let state={simplex:[first],point:first};
 for(let i=0;i<64;i++){
  if(norm(state.point)<=EPS)return true;
  const direction={x:-state.point.x,y:-state.point.y},next=support(direction);if(!next||dot(next,direction)<-EPS*norm(direction))return false;
  if(state.simplex.some(p=>norm(sub(p,next))<=EPS))return false;
  state=closestSimplex([...state.simplex,next]);
 }
 return norm(state.point)<=EPS;
}
export function inkMaxDistance(shape:ConvexInk,point:Point){
 if(shape.kind==='polygon')return Math.max(...shape.points.map(p=>norm(sub(p,point))));
 if(shape.kind==='capsule')return Math.max(norm(sub(shape.a,point)),norm(sub(shape.b,point)))+shape.radius;
 if(!shape.clip)return norm(sub(shape.center,point))+shape.radius;
 const direction=sub(shape.center,point),extreme=inkSupport(shape,norm(direction)?direction:{x:1,y:0});
 return Math.max(extreme?norm(sub(extreme,point)):-Infinity,...circleClipVertices(shape).map(p=>norm(sub(p,point))));
}
export function visibleInkTouches(a:RelationGeometry,b:RelationGeometry){
 return a.ink.some(x=>b.ink.some(y=>{
  if(x.hole&&inkMaxDistance(y.outer,x.hole.center)<x.hole.radius-EPS)return false;
  if(y.hole&&inkMaxDistance(x.outer,y.hole.center)<y.hole.radius-EPS)return false;
  return convexInkTouches(x.outer,y.outer);
 }));
}
export function inkBounds(geometry:RelationGeometry):Box|undefined{
 const points=geometry.ink.flatMap(piece=>[{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}].flatMap(d=>{const p=inkSupport(piece.outer,d);return p?[p]:[];}));
 return points.length&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))?{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}:undefined;
}
/** All visible ink must fit. Parent/child ownership is never a containment test. */
export function inkFullyInside(geometry:RelationGeometry,enclosure:ConvexInk){
 return geometry.ink.length>0&&geometry.ink.every(({outer})=>{
  if(enclosure.kind==='circle'&&!enclosure.clip)return inkMaxDistance(outer,enclosure.center)<=enclosure.radius+EPS;
  if(enclosure.kind!=='polygon'||!convexPolygon(enclosure.points))return false;
  const vertices=enclosure.points,sign=Math.sign(vertices.reduce((sum,p,i)=>sum+cross(p,vertices[(i+1)%vertices.length]),0));
  return vertices.every((p,i)=>{const d=sub(vertices[(i+1)%vertices.length],p),normal={x:sign*d.y,y:-sign*d.x},support=inkSupport(outer,normal);return !!support&&dot(sub(support,p),normal)<=EPS*norm(normal);});
 });
}
export type ConnectedEntry={key:string;scope:unknown;geometry:RelationGeometry};
/** Sweep broad phase + cached connected sets. Only the spatial index is topology;
 * containment, source colour and authored grouping never add graph edges. */
export function prepareConnectedInk(entries:readonly ConnectedEntry[],budget=200000){
 const groups=new Map<string,readonly string[]>(),parents=entries.map((_,i)=>i),find=(i:number):number=>parents[i]===i?i:parents[i]=find(parents[i]);
 const cost=(geometry:RelationGeometry)=>geometry.ink.reduce((sum,piece)=>sum+(piece.outer.kind==='polygon'?piece.outer.points.length:piece.outer.kind==='circle'?1+(piece.outer.clip?.length??0):2),0);
 const sorted=entries.flatMap((entry,i)=>{const box=inkBounds(entry.geometry);return box?[{entry,i,box,cost:cost(entry.geometry)}]:[];}).sort((a,b)=>a.box.left-b.box.left);
 let comparisons=0;
 for(let i=0;i<sorted.length;i++)for(let j=i+1;j<sorted.length&&sorted[j].box.left<=sorted[i].box.right+EPS;j++){
  const a=sorted[i],b=sorted[j];if(a.entry.scope!==b.entry.scope||a.box.top>b.box.bottom+EPS||a.box.bottom<b.box.top-EPS)continue;
  const x=find(a.i),y=find(b.i);if(x===y)continue;
  comparisons+=a.cost*b.cost;if(comparisons>budget)return {groups:new Map<string,readonly string[]>(),complete:false,comparisons};
  if(visibleInkTouches(a.entry.geometry,b.entry.geometry))parents[y]=x;
 }
 const members=new Map<number,string[]>();sorted.forEach(({entry,i})=>{const root=find(i),list=members.get(root)??[];list.push(entry.key);members.set(root,list);});
 sorted.forEach(({entry,i})=>groups.set(entry.key,members.get(find(i))!));
 return {groups,complete:true,comparisons};
}
