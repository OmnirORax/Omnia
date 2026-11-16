import * as THREE from 'three';
import type {Document,XYZ} from '../graph/geometryTypes.ts';
import {createOccupancy} from '../graph/occupancy.ts';
import {cellAt,prepareLattice,prepareLatticeTransform,cellPoint,latticeScale} from '../graph/lattice.ts';
import {placementSubtree} from '../graph/selection.ts';
/** One reversible drive session. Motion changes renderer previews only; parking
 * delegates one commit to the existing document/history owner. */
export function createNavigatorDrive(env:{
 hosts:()=>ReadonlyMap<string,{anchor:THREE.Vector3;group:THREE.Group}>;
 commit:(id:string,world:XYZ)=>Document|null;
 constrain?:(id:string,world:XYZ)=>XYZ|undefined;
}){
 let session:{doc:Document;id:string;ids:Set<string>;worlds:Map<string,XYZ>;root:XYZ;last:XYZ;lastWorlds:Map<string,XYZ>;valid:boolean;pitch:number;size?:number;attempt?:Map<string,XYZ>;error?:string;resolve:ReturnType<typeof prepareLatticeTransform>}|undefined;
 const paint=(worlds:ReadonlyMap<string,XYZ>)=>{for(const [id,p]of worlds){const host=env.hosts().get(id);if(host){host.anchor.set(p.x,p.y,p.z);host.group.position.copy(host.anchor);}}};
 return {get active(){return !!session;},get id(){return session?.id;},get document(){return session?.doc;},get valid(){return session?.valid??true;},get position(){return session?.last;},get origin(){return session?.root;},
  get rejection(){const s=session;if(!s||s.valid)return undefined;if(s.error)return {reason:s.error};if(!s.attempt)return {reason:'No active axis is enabled.'};const index=prepareLattice(s.doc,s.size),occupied=createOccupancy([...index.cells].filter(([id])=>!s.ids.has(id)).map(([id,p])=>[id,cellPoint(p,s.pitch)] as const),s.pitch),seen=createOccupancy([],s.pitch);for(const [id,raw]of s.attempt){const p=s.doc.freePositions?raw:cellPoint(cellAt(raw,s.pitch),s.pitch),blocker=occupied.blocker(p)??seen.blocker(p);if(blocker!==undefined)return {reason:'Occupied position',moving:id,blocker,point:p};seen.add(id,p);}return {reason:'Position violates the current placement constraints.'};},
  refresh(){if(session)paint(session.lastWorlds);},
  owns(id:string){return session?.ids.has(id)??false;},
  begin(doc:Document,id:string,size?:number,scale?:number,moveChildren:boolean|readonly string[]=true){
   if(session)throw Error('Park or cancel the current node before taking control.');
   if(!doc.placements.some(p=>p.id===id))throw Error('The node no longer exists.');
   const ids=typeof moveChildren==='boolean'?(moveChildren?placementSubtree(doc,[id]):new Set([id])):new Set(moveChildren),hosts=env.hosts();if([...ids].filter(id=>hosts.has(id)).length>256)throw Error('Drive up to 256 visible nodes at once.');
   const index=prepareLattice(doc,size),pitch=index.unit*latticeScale(scale),worlds=new Map([...ids].map(id=>[id,cellPoint(index.cells.get(id)!,pitch)]));
   const root=worlds.get(id)!;session={doc,id,ids,worlds,root,last:root,lastWorlds:worlds,valid:true,pitch,size,resolve:prepareLatticeTransform(doc,[...ids],size,scale)};return new THREE.Vector3(root.x,root.y,root.z);
  },
  move(point:THREE.Vector3){
   const s=session;if(!s)return true;s.error=undefined;s.attempt=undefined;
   if(env.constrain){const target=env.constrain(s.id,{x:point.x,y:point.y,z:point.z});if(!target){s.valid=false;return false;}point=new THREE.Vector3(target.x,target.y,target.z);}
   const delta=point.clone().sub(new THREE.Vector3(s.root.x,s.root.y,s.root.z));
   const candidates=new Map([...s.worlds].map(([id,p])=>[id,{x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z}]));
   s.attempt=candidates;let resolved;try{resolved=s.resolve(candidates);}catch(error){s.error=error instanceof Error?error.message:String(error);s.valid=false;return false;}
   s.valid=!!resolved;if(!resolved)return false;s.last=resolved.get(s.id)!;s.lastWorlds=resolved;paint(resolved);return true;
  },
  cancel(){const s=session;session=undefined;if(s)paint(s.worlds);},
  park(lastValid=false,commit=env.commit){const s=session;if(!s)return undefined;if(!s.valid&&!lastValid)return null;
   // Release preview ownership before the synchronous owner/history write can
   // trigger a renderer refresh. Failed writes restore the same drive session.
   session=undefined;
   try{const doc=commit(s.id,s.last);if(!doc){session=s;paint(s.lastWorlds);return null;}return doc;}
   catch(error){session=s;paint(s.lastWorlds);throw error;}
  },
 };
}
