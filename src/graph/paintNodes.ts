import {worldPositions} from './coordinates.ts';
import type {Document,XYZ} from './structural.ts';
import type {SpatialSettings} from './layout3d.ts';
import {createPlacement} from './layout3d.ts';
import {cellAt,cellPoint,prepareLattice} from './lattice.ts';
/** One atomic batch; occupied cells are skipped, never relocated to nearby slots. */
export function paintNodes(doc:Document,points:readonly XYZ[],sourceId:string|undefined,parentId:string|null,settings:SpatialSettings):Document{
 const source=sourceId?doc.placements.find(p=>p.id===sourceId):undefined;
 if(sourceId&&!source)throw Error('Paint source no longer exists.');
 const template=source&&doc.entities.find(e=>e.id===source.entityId);
 const index=prepareLattice(doc,settings.nodeCellSize),occupied=new Set(index.occupied.keys());let next=doc;
 for(const point of points.slice(0,256)){
  const cell=cellAt(point,index.unit),key=`${cell.x},${cell.y},${cell.z}`;if(occupied.has(key))continue;
  occupied.add(key);const entityId=crypto.randomUUID();next={...next,entities:[...next.entities,template?{...structuredClone(template),id:entityId}:{id:entityId,label:'',aliases:[],notes:''}]};
  if(parentId){const parent=next.placements.find(p=>p.id===parentId);if(!parent)throw Error('Paint parent no longer exists.');next={...next,compositions:[...next.compositions,{id:crypto.randomUUID(),parentId:parent.entityId,childId:entityId}],placements:next.placements.map(p=>p.id===parentId?{...p,collapsed:false}:p)};}
  const world=cellPoint(cell,index.unit),parent=parentId?worldPositions(next).get(parentId)!:{x:0,y:0,z:0};
  const placed=createPlacement(next,entityId,parentId,settings,{x:world.x-parent.x,y:world.y-parent.y,z:world.z-parent.z},'exact');next=placed.next;
  if(source)next={...next,placements:next.placements.map(p=>p.id===placed.placementId?{...p,...(source.visual?{visual:structuredClone(source.visual)}:{}),...(source.appearance?{appearance:structuredClone(source.appearance)}:{}),...(source.orientation?{orientation:{...source.orientation}}:{})}:p)};
  const frame=next.frames.find(f=>f.id===next.activeFrameId);if(frame?.locked)next={...next,activeFrameId:null};else if(frame)next={...next,frames:next.frames.map(f=>f.id===frame.id?{...f,scope:{...f.scope,entityIds:[...f.scope.entityIds,entityId]}}:f)};
 }
 return next;
}
