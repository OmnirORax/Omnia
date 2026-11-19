import {createOccupancy} from '../graph/occupancy.ts';
import {nearestCell} from '../graph/lattice.ts';
import {address,inherited,point,prepareTranslation,vector} from './lattice.ts';
import {validateAxes} from './axes.ts';
import {addStructure,bind,locate,sameOrigin,type Origin,type Structure,type Vec3,type World} from './model.ts';
const zero:Vec3=[0,0,0];
const offset=(a:Vec3,b:Vec3):Vec3=>a.map((n,i)=>n+b[i]) as Vec3;
const difference=(a:Vec3,b:Vec3):Vec3=>a.map((n,i)=>n-b[i]) as Vec3;
const legal=(p:Vec3)=>p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e7);
class RoomConflict extends Error{}
function axesFit(world:World,targets:ReadonlyMap<string,Vec3>){
 if(!world.axes?.length)return true;
 try{validateAxes({...world,axes:structuredClone(world.axes),nodes:world.nodes.map(node=>targets.has(address(node.origin))?{...node,position:targets.get(address(node.origin))!}:node)});return true;}catch{return false;}
}
/** Reserve the exact insertion and endpoint positions, then move only blockers.
 * Carried/hidden branches use the normal translation owner; no new drag rules. */
function insertionPlan(world:World,insert:Structure,pinned:Map<string,Vec3>){
 const reserved=createOccupancy([['@insert',point(insert.position)]]);
 for(const [id,p]of pinned){if(!legal(p)||!reserved.free(point(p)))throw new RoomConflict('The carried branches need more space.');reserved.add(id,point(p));}
 const blockers=world.nodes.filter(node=>!pinned.has(address(node.origin))&&!reserved.free(point(node.position)));
 if(!blockers.length){if(!axesFit(world,pinned))throw new RoomConflict('The reference axes need different spacing.');return pinned;}
 const roots=blockers.map(node=>node.origin),moving=prepareTranslation(world,roots,false)(zero);
 if(!moving||[...moving.keys()].some(id=>pinned.has(id)))throw new RoomConflict('A carried branch contains an endpoint.');
 const temporary:World={...world,nodes:[...world.nodes.map(node=>pinned.has(address(node.origin))?{...node,position:pinned.get(address(node.origin))!}:node),insert]};
 const resolve=prepareTranslation(temporary,roots,false);let result:Map<string,Vec3>|undefined,checks=0;
 try{nearestCell({x:0,y:0,z:0},cell=>{
  if(++checks>20000)throw new RoomConflict('The room-making search reached its limit.');
  const targets=resolve(vector(cell));if(!targets)return false;
  const merged=new Map([...pinned,...targets]);if(!axesFit(world,merged))return false;result=merged;return true;
 });}catch(error){throw error instanceof RoomConflict?error:new RoomConflict('No collision-free room was found.');}
 return result!;
}
/** One relation-creation operation, shared by drag and target-picker entry points.
 * The original A→B binder stays; AB is an independent midpoint node. */
export function createRelationNode(world:World,from:Origin,to:Origin):Origin{
 const a=locate(world,from),b=locate(world,to);if(!a||!b)throw Error('A connection endpoint no longer exists.');
 if(sameOrigin(from,to))throw Error('Choose a different target node.');
 if(world.nodes.length>=4000)throw Error('This workbench supports 4,000 nodes.');
 if((world.relationships?.length??0)>=2000)throw Error('This workbench supports 2,000 relationships.');
 const label=[inherited(a,world).label.trim(),inherited(b,world).label.trim()].filter(Boolean).join(' ');
 if(label.length>160)throw Error('The combined label exceeds 160 characters. Shorten the endpoint labels first.');
 const distance=Math.hypot(...difference(b.position,a.position));if(distance<1e-8)throw Error('The endpoints need distinct positions.');
 let chosen:{insert:Structure;targets:Map<string,Vec3>}|undefined;
 // Prefer keeping the source fixed. The reverse anchor handles a destination
 // whose collapsed branch carries the source, without breaking that branch.
 for(const [fixed,moving]of [[a,b],[b,a]]){
  const direction=difference(moving.position,fixed.position).map(n=>n/distance) as Vec3;
  const carried=prepareTranslation(world,[moving.origin],false)(zero);if(!carried)continue;
  let radius=0;for(const p of carried.values())radius=Math.max(radius,Math.hypot(...difference(p,moving.position)));
  const first=Math.max(2,distance),safe=Math.max(first,2*(radius+1)),lengths=[...new Set([first,first+1,first+2,safe,safe+1])];
  for(const length of lengths){
   const target=offset(fixed.position,direction.map(n=>n*length) as Vec3),center=fixed.position.map((n,i)=>(n+target[i])/2) as Vec3;
   if(!legal(target)||!legal(center))continue;
   const delta=difference(target,moving.position),pinned=new Map<string,Vec3>([[address(fixed.origin),[...fixed.position]]]);
   const group=length===distance?new Map([[address(moving.origin),moving.position]]):carried;
   let conflict=false;for(const [id,p]of group){const next=offset(p,delta);if(pinned.has(id)&&Math.hypot(...difference(pinned.get(id)!,next))>1e-7){conflict=true;break;}pinned.set(id,next);}if(conflict)continue;
   let born=Date.now();while(world.nodes.some(node=>node.origin.born===born&&node.origin.at.every((n,i)=>n===center[i])))born++;
   const insert:Structure={origin:{born,at:[...center]},position:center,label,color:a.color,invariant:false,parts:[]};
   try{chosen={insert,targets:insertionPlan(world,insert,pinned)};break;}catch(error){if(!(error instanceof RoomConflict))throw error;}
  }
  if(chosen)break;
 }
 if(!chosen)throw Error('No room compatible with the carried branches and reference axes. Expand or move the endpoints apart first.');
 for(const node of world.nodes){const target=chosen.targets.get(address(node.origin));if(target)node.position=[...target];}
 const occupied=createOccupancy(world.nodes.map(node=>[address(node.origin),point(node.position)] as const));
 const node=addStructure(world,chosen.insert.position,chosen.insert.origin.born,occupied);node.label=label;
 (world.relationships??=[]).push({from:bind(a,'follow',world),to:bind(b,'follow',world),label:'',kind:'relation'});
 return node.origin;
}
