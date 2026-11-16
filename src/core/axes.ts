import {locate, sameOrigin, type Origin,type Vec3,type World} from './model.ts';
import {address,prepareTranslation} from './lattice.ts';
export type AxisFrame={id:string;ends:Origin[];x:Vec3;y:Vec3;z:Vec3;members:Origin[];origin?:Vec3;directed?:boolean;activeAxes?:number[]};
export const plus=(a:Vec3,b:Vec3):Vec3=>a.map((n,i)=>n+b[i]) as Vec3;
export const minus=(a:Vec3,b:Vec3):Vec3=>a.map((n,i)=>n-b[i]) as Vec3;
export const times=(a:Vec3,n:number):Vec3=>a.map(v=>v*n) as Vec3;
export const dot=(a:Vec3,b:Vec3)=>a.reduce((sum,n,i)=>sum+n*b[i],0);
export const norm=(a:Vec3)=>Math.hypot(...a);
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(a:Vec3)=>times(a,1/norm(a));
export function axisAnchor(world:World,frame:AxisFrame){return frame.ends[0]?locate(world,frame.ends[0])!.position:frame.origin!;}
export function axisCenter(world:World,frame:AxisFrame){return frame.origin??times(plus(axisAnchor(world,frame),locate(world,(frame.ends[1]??frame.ends[0]))!.position),.5);}
export function axisCoordinates(world:World,frame:AxisFrame,p:Vec3):Vec3{const d=minus(p,axisCenter(world,frame));return [dot(d,frame.x),dot(d,frame.y),dot(d,frame.z)];}
export function axisPoint(world:World,frame:AxisFrame,slot:Vec3):Vec3{return plus(frame.directed||frame.origin?axisCenter(world,frame):axisAnchor(world,frame),plus(times(frame.x,slot[0]),plus(times(frame.y,slot[1]),times(frame.z,slot[2]))));}
export function axisSlot(world:World,frame:AxisFrame,p:Vec3,mode:'axis'|'plane'|'space'='axis'):Vec3{
 const coordinates=axisCoordinates(world,frame,p),half=frame.directed||!frame.ends.length?0:norm(minus(locate(world,(frame.ends[1]??frame.ends[0]))!.position,axisAnchor(world,frame)))/2;
 const slot:Vec3=[Math.round(coordinates[0]+half),Math.round(coordinates[1]),Math.round(coordinates[2])];
 if(mode==='axis'){const lengths=coordinates.map(Math.abs),axis=lengths.indexOf(Math.max(...lengths));return [axis===0?slot[0]:half,axis===1?slot[1]:0,axis===2?slot[2]:0];}
 if(mode==='plane'){const lengths=coordinates.map(Math.abs),normal=lengths.indexOf(Math.min(...lengths));slot[normal]=normal===0?half:0;}

 return slot;
}
export function axisComponent(world:World,ids:Set<string>){
 let changed=true;while(changed){changed=false;for(const frame of world.axes??[])if(frame.members.some(origin=>ids.has(address(origin))))for(const member of frame.members){const id=address(member);if(!ids.has(id)){ids.add(id);changed=true;}}}
 return ids;
}
/** Pure plan shared by hover preview and the atomic owner commit. */
export function planAxis(world:World,first:Origin,second:Origin,up:Vec3){
 const a=locate(world,first),b=locate(world,second);if(!a||!b||sameOrigin(first,second))throw Error('Choose two different nodes.');
 const delta=minus(b.position,a.position),distance=norm(delta);if(distance<1e-8)throw Error('The axis needs two distinct positions.');
 const x=unit(delta),projected=minus(up,times(x,dot(up,x))),fallback=Math.abs(x[1])<.9?[0,1,0] as Vec3:[0,0,1] as Vec3;
 const y=unit(norm(projected)>1e-6?projected:minus(fallback,times(x,dot(fallback,x)))),z=unit(cross(x,y));
 const resolve=prepareTranslation(world,[second],false),moving=resolve([0,0,0]);if(!moving)throw Error('The existing arrangement overlaps another node.');
 const lengths=Array.from({length:129},(_,i)=>Math.max(1,Math.round(distance))+i-64).filter(n=>n>=1).sort((a,b)=>Math.abs(a-distance)-Math.abs(b-distance)||a-b);
 for(const length of lengths){
  const shift=minus(plus(a.position,times(x,length)),b.position);
  if(moving.has(address(first))&&norm(shift)>1e-7)continue;
  const targets=resolve(shift);if(targets)return {x,y,z,length,targets};
 }
 throw Error('Axis spacing conflicts with occupied positions or an existing arrangement.');
}
export function createAxis(world:World,first:Origin,second:Origin,up:Vec3){
 const existing=world.axes?.find(frame=>frame.ends.length===2&&frame.ends.some(end=>sameOrigin(end,first))&&frame.ends.some(end=>sameOrigin(end,second)));if(existing){const plan=planAxis(world,first,second,up);for(const node of world.nodes){const target=plan.targets.get(address(node.origin));if(target)node.position=target;}Object.assign(existing,{ends:[structuredClone(first),structuredClone(second)],x:times(plan.z,-1),y:plan.y,z:plan.x,origin:[...locate(world,second)!.position],directed:true});world.activeAxis=existing.id;return existing;}
 if((world.axes?.length??0)>=64)throw Error('Up to 64 axis frames are supported.');
 const plan=planAxis(world,first,second,up);
 for(const node of world.nodes){const target=plan.targets.get(address(node.origin));if(target)node.position=target;}
 const frame:AxisFrame={id:crypto.randomUUID(),ends:[structuredClone(first),structuredClone(second)],x:times(plan.z,-1),y:plan.y,z:plan.x,origin:[...locate(world,second)!.position],directed:true,members:[structuredClone(first),structuredClone(second)]};
 (world.axes??=[]).push(frame);world.activeAxis=frame.id;return frame;
}
export function planSlotNode(world:World,origin:Origin,id:string,desired:Vec3,origins:readonly Origin[]=[origin]){
 const frame=world.axes?.find(frame=>frame.id===id),node=locate(world,origin);if(!frame||!node)throw Error('The axis or node no longer exists.');
 const slot=operationSlot(world,frame,desired),resolve=prepareTranslation(world,origins,false),candidates=Array.from({length:129},(_,i)=>i===0?0:Math.ceil(i/2)*(i%2?-1:1));
 const coordinates=axisCoordinates(world,frame,desired).map(Math.abs),direction=[...activeWorldAxes(frame)].sort((a,b)=>coordinates[b]-coordinates[a])[0];
 if(direction===undefined)throw Error('Activate an axis first.');
 for(const offset of candidates){const trial=[...slot] as Vec3;trial[direction]+=offset;const targets=resolve(minus(axisPoint(world,frame,trial),node.position));if(!targets)continue;
  // Joining an existing arrangement must not move this frame's origin/endpoints.
  if(!frame.members.some(member=>sameOrigin(member,origin))&&frame.ends.some(end=>{const target=targets.get(address(end));return target&&norm(minus(target,locate(world,end)!.position))>1e-7;}))continue;
  return {frame,targets};
 }
 throw Error('No free axis slot for this arrangement.');
}
export function slotNode(world:World,origin:Origin,id:string,desired:Vec3,origins:readonly Origin[]=[origin]){
 const {frame,targets}=planSlotNode(world,origin,id,desired,origins);
 for(const node of world.nodes){const target=targets.get(address(node.origin));if(target)node.position=target;}
 if(!frame.members.some(member=>sameOrigin(member,origin)))frame.members.push(structuredClone(origin));
}
export function validateAxes(world:World){
 if(world.axes===undefined){if(world.activeAxis!==undefined)throw Error('Invalid active axis.');return;}
 if(!Array.isArray(world.axes)||world.axes.length>64)throw Error('Invalid axes.');
 const ids=new Set<string>(),nodes=new Map(world.nodes.map(node=>[address(node.origin),node]));
 for(const frame of world.axes){
  const vector=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n));
  if(!frame||typeof frame.id!=='string'||!frame.id||frame.id.length>100||ids.has(frame.id)||!Array.isArray(frame.ends)||![0,1,2].includes(frame.ends.length)||!Array.isArray(frame.members)||frame.members.length<frame.ends.length||frame.members.length>4000||![frame.x,frame.y,frame.z].every(vector))throw Error('Invalid axis frame.');
  if(frame.activeAxes?.length===3)frame.activeAxes=[0,2];
  if(frame.activeAxes!==undefined&&(!Array.isArray(frame.activeAxes)||frame.activeAxes.length>2||new Set(frame.activeAxes).size!==frame.activeAxes.length||frame.activeAxes.some(n=>!Number.isInteger(n)||n<0||n>2)))throw Error('Invalid active axes.');
  ids.add(frame.id);
  if([frame.x,frame.y,frame.z].some(v=>Math.abs(norm(v)-1)>1e-6)||Math.abs(dot(frame.x,frame.y))>1e-6||norm(minus(cross(frame.x,frame.y),frame.z))>1e-6)throw Error('Invalid axis orientation.');
  if(!frame.ends.length&&!frame.origin)throw Error('An unbound origin requires a position.');
  const members=new Set<string>();
  for(const member of [...frame.members,...frame.ends])if(!member||!nodes.has(address(member)))throw Error('Missing axis node.');
  if(frame.directed!==undefined&&typeof frame.directed!=='boolean'||frame.origin!==undefined&&(!vector(frame.origin)||frame.origin.some(n=>Math.abs(n)>1e7)))throw Error('Invalid axis origin.');
  const anchor=frame.ends[0]?nodes.get(address(frame.ends[0]))!.position:frame.origin!,end=frame.ends[0]?nodes.get(address(frame.ends[1]??frame.ends[0]))!.position:frame.origin!,half=norm(minus(end,anchor))/2;
  for(const member of frame.members){if(members.has(address(member)))throw Error('Duplicate axis member.');members.add(address(member));const d=minus(nodes.get(address(member))!.position,anchor),coords=[dot(d,frame.x),dot(d,frame.y),dot(d,frame.z)],integer=(n:number)=>Math.abs(n-Math.round(n))<1e-5;if(!frame.directed&&(!integer(coords[1])||!integer(coords[2])||!integer(coords[0])&&!integer(coords[0]-half)))throw Error('Node conflicts with its axis slots.');}
  if(frame.ends.some(end=>!members.has(address(end)))||frame.ends.length===2&&sameOrigin(frame.ends[0],frame.ends[1]))throw Error('Invalid axis endpoints.');
  const delta=minus(end,anchor),length=dot(delta,frame.x);
  if(!frame.directed&&(frame.ends.length===2&&length<1-1e-6||Math.abs(length-Math.round(length))>1e-5||norm(minus(delta,times(frame.x,length)))>1e-5))throw Error('Invalid axis spacing.');
 }
 if(world.activeAxis!==undefined&&!ids.has(world.activeAxis))throw Error('Invalid active axis.');
}

export function focusNodeFrame(world:World,origin:Origin,right:Vec3,up:Vec3,orient=false){
 const existing=world.axes?.find(frame=>frame.ends.length===1&&sameOrigin(frame.ends[0],origin));
 if(existing&&(!orient||existing.members.length===1||norm(minus(existing.x,unit(right)))<1e-7&&norm(minus(existing.y,unit(up)))<1e-7)){if(orient){existing.x=unit(right);existing.y=unit(minus(up,times(existing.x,dot(up,existing.x))));existing.z=unit(cross(existing.x,existing.y));}world.activeAxis=existing.id;return existing;}
 if((world.axes?.length??0)>=64)throw Error('Up to 64 reference frames are supported.');
 const x=unit(right),y=unit(minus(up,times(x,dot(up,x)))),z=unit(cross(x,y));
 const frame:AxisFrame={id:crypto.randomUUID(),ends:[structuredClone(origin)],members:[structuredClone(origin)],x,y,z};
 (world.axes??=[]).push(frame);world.activeAxis=frame.id;return frame;
}
export function endpointView(world:World,frame:AxisFrame,origin:Origin){
 if(frame.ends.length!==2||!frame.ends.some(end=>sameOrigin(end,origin)))throw Error('Choose an endpoint of a two-node axis.');
 const position=locate(world,origin)!.position,target=locate(world,frame.ends.find(end=>!sameOrigin(end,origin))!)!.position,back=unit(minus(position,target));
 const right=unit(cross(frame.y,back)),up=unit(cross(back,right));
 return {position,target,right,up};
}

export function originSlots(world:World,frame:AxisFrame):Vec3[]{
 const a=axisAnchor(world,frame),b=frame.ends.length?locate(world,frame.ends[1]??frame.ends[0])!.position:a,delta=minus(b,a),length=norm(delta),steps=Math.round(length);
 if(steps>3999)throw Error('Origin picking supports up to 4,000 positions.');
 return Array.from({length:steps+1},(_,i)=>steps?plus(a,times(delta,i/steps)):[...a] as Vec3);
}
export function setAxisOrigin(world:World,id:string,position:Vec3){
 const frame=world.axes?.find(frame=>frame.id===id);if(!frame)throw Error('Select an axis first.');
 if(!originSlots(world,frame).some(p=>norm(minus(p,position))<1e-6))throw Error('Choose a discrete position on the axis.');
 if(!frame.directed){const oldX=frame.x;frame.x=times(frame.z,-1);frame.z=oldX;frame.directed=true;}
 frame.origin=[...position];
}

export function nodeOriginView(position:Vec3,target:Vec3,up:Vec3){
 const back=minus(position,target);if(norm(back)<1e-7)throw Error('This node is already at the selected origin.');
 const normal=unit(back),projected=minus(up,times(normal,dot(up,normal))),fallback=Math.abs(normal[1])<.9?[0,1,0] as Vec3:[1,0,0] as Vec3;
 const vertical=unit(norm(projected)>1e-7?projected:minus(fallback,times(normal,dot(fallback,normal))));
 return {position:[...position] as Vec3,target:[...target] as Vec3,up:vertical};
}

export const activeWorldAxes=(frame:AxisFrame)=>frame.activeAxes?.length===3?[0,2]:frame.activeAxes??[0,2];
export function toggleWorldAxis(world:World,id:string,axis:number){
 const frame=world.axes?.find(frame=>frame.id===id);if(!frame||!Number.isInteger(axis)||axis<0||axis>2)throw Error('Choose a valid axis.');
 const current=activeWorldAxes(frame);frame.activeAxes=current.includes(axis)?current.filter(n=>n!==axis):current.length===2?[axis]:[...current,axis].sort();world.activeAxis=id;
}
export function shiftAxisOrigin(world:World,id:string,offset:Vec3){
 const frame=world.axes?.find(frame=>frame.id===id);if(!frame||offset.length!==3||offset.some(n=>!Number.isSafeInteger(n)))throw Error('Use whole X Y Z offsets.');
 frame.origin=plus(axisCenter(world,frame),plus(times(frame.x,offset[0]),plus(times(frame.y,offset[1]),times(frame.z,offset[2]))));
}

export function operationSlot(world:World,frame:AxisFrame,p:Vec3):Vec3{
 const active=activeWorldAxes(frame),coords=axisCoordinates(world,frame,p);
 const slots=coords.map((n,i)=>active.includes(i)?Math.round(n):0) as Vec3;
 if(!frame.directed&&!frame.origin)slots[0]+=norm(minus(locate(world,frame.ends[1]??frame.ends[0])!.position,axisAnchor(world,frame)))/2;
 return slots;
}

/** Aim the spatial frame without transforming its nodes or camera. */
export function aimFrame(world:World,id:string,target:Origin){
 const frame=world.axes?.find(frame=>frame.id===id),node=locate(world,target);if(!frame||!node)throw Error('Choose an origin and target node.');
 const origin=axisCenter(world,frame),delta=minus(node.position,origin);if(norm(delta)<1e-7)throw Error('Choose a target away from the origin.');
 const z=unit(delta),projected=minus(frame.y,times(z,dot(frame.y,z))),fallback=Math.abs(z[1])<.9?[0,1,0] as Vec3:[1,0,0] as Vec3;
 const y=unit(norm(projected)>1e-7?projected:minus(fallback,times(z,dot(fallback,z)))),x=unit(cross(y,z));
 frame.origin=[...origin];frame.x=x;frame.y=unit(cross(z,x));frame.z=z;frame.directed=true;
}

/** All origin assignments share one orientation rule, independent of selection shape. */
export function setSpatialOrigin(world:World,anchor:Origin|undefined,position:Vec3,right:Vec3,up:Vec3){
 const current=world.axes?.find(frame=>frame.id===world.activeAxis),explicit=current&&(current.ends.length===2||current.directed);
 let frame=explicit?current:anchor?focusNodeFrame(world,anchor,right,up,true):current;
 if(!frame){if((world.axes?.length??0)>=64)throw Error('Up to 64 reference frames.');const x=unit(right),y=unit(minus(up,times(x,dot(up,x))));frame={id:crypto.randomUUID(),ends:[],members:[],origin:[...position],x,y,z:unit(cross(x,y))};(world.axes??=[]).push(frame);world.activeAxis=frame.id;}
 if(!explicit&&!anchor){const x=unit(right),y=unit(minus(up,times(x,dot(up,x))));Object.assign(frame,{x,y,z:unit(cross(x,y))});}
 if(!explicit){delete frame.directed;if(current&&current!==frame)frame.activeAxes=[...activeWorldAxes(current)];else if(!current)frame.activeAxes=[0,1];}
 frame.origin=[...position];return frame;
}

export function insideActivePlane(world:World,frame:AxisFrame,position:Vec3){
 const active=activeWorldAxes(frame),coordinates=axisCoordinates(world,frame,position);
 return active.length>0&&coordinates.every((n,i)=>active.includes(i)||Math.abs(n)<=.5+1e-7);
}
