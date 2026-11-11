import * as THREE from 'three';
import type {Document,XYZ} from '../graph/geometryTypes.ts';
import {prepareLattice,prepareLatticeTransform,cellPoint,latticeScale} from '../graph/lattice.ts';
import {placementSubtree} from '../graph/selection.ts';
/** One reversible drive session. Motion changes renderer previews only; parking
 * delegates one commit to the existing document/history owner. */
export function createNavigatorDrive(env:{
 hosts:()=>ReadonlyMap<string,{anchor:THREE.Vector3;group:THREE.Group}>;
 commit:(id:string,world:XYZ)=>Document|null;
}){
 let session:{doc:Document;id:string;ids:Set<string>;worlds:Map<string,XYZ>;root:XYZ;last:XYZ;lastWorlds:Map<string,XYZ>;valid:boolean;resolve:ReturnType<typeof prepareLatticeTransform>}|undefined;
 const paint=(worlds:ReadonlyMap<string,XYZ>)=>{for(const [id,p]of worlds){const host=env.hosts().get(id);if(host){host.anchor.set(p.x,p.y,p.z);host.group.position.copy(host.anchor);}}};
 return {get active(){return !!session;},get id(){return session?.id;},get document(){return session?.doc;},get valid(){return session?.valid??true;},get position(){return session?.last;},get origin(){return session?.root;},
  refresh(){if(session)paint(session.lastWorlds);},
  owns(id:string){return session?.ids.has(id)??false;},
  begin(doc:Document,id:string,size?:number,scale?:number){
   if(session)throw Error('Park or cancel the current node before taking control.');
   if(!doc.placements.some(p=>p.id===id))throw Error('The node no longer exists.');
   const ids=placementSubtree(doc,[id]),hosts=env.hosts();if([...ids].filter(id=>hosts.has(id)).length>256)throw Error('Drive up to 256 visible nodes at once.');
   const index=prepareLattice(doc,size),pitch=index.unit*latticeScale(scale),worlds=new Map([...ids].map(id=>[id,cellPoint(index.cells.get(id)!,pitch)]));
   const root=worlds.get(id)!;session={doc,id,ids,worlds,root,last:root,lastWorlds:worlds,valid:true,resolve:prepareLatticeTransform(doc,[...ids],size,scale)};return new THREE.Vector3(root.x,root.y,root.z);
  },
  move(point:THREE.Vector3){
   const s=session;if(!s)return true;
   const delta=point.clone().sub(new THREE.Vector3(s.root.x,s.root.y,s.root.z));
   const candidates=new Map([...s.worlds].map(([id,p])=>[id,{x:p.x+delta.x,y:p.y+delta.y,z:p.z+delta.z}]));
   let resolved;try{resolved=s.resolve(candidates);}catch{s.valid=false;return false;}
   s.valid=!!resolved;if(!resolved)return false;s.last=resolved.get(s.id)!;s.lastWorlds=resolved;paint(resolved);return true;
  },
  cancel(){const s=session;session=undefined;if(s)paint(s.worlds);},
  park(lastValid=false){const s=session;if(!s)return undefined;if(!s.valid&&!lastValid)return null;
   // Release preview ownership before the synchronous owner/history write can
   // trigger a renderer refresh. Failed writes restore the same drive session.
   session=undefined;
   try{const doc=env.commit(s.id,s.last);if(!doc){session=s;paint(s.lastWorlds);return null;}return doc;}
   catch(error){session=s;paint(s.lastWorlds);throw error;}
  },
 };
}
