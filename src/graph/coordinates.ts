import type { Document, Placement, XYZ } from "./structural.ts";

export function localPosition(p: Placement): XYZ {
  return p.spatialPosition ?? { x: p.position.x / 100, y: p.parentId ? -2 : 0, z: p.position.y / 100 };
}
/** Shared coordinate resolution; rendering filters must not rebase stored placements. */
export function worldPositions(doc: Document): Map<string, XYZ> {
  const byId = new Map(doc.placements.map(p => [p.id, p])), cache = new Map<string, XYZ>();
  const resolve = (id: string): XYZ => {
    const cached = cache.get(id); if (cached) return cached;
    const p = byId.get(id); if (!p) throw new Error(`Missing placement: ${id}`);
    const parent = p.parentId ? resolve(p.parentId) : { x: 0, y: 0, z: 0 }, local = localPosition(p);
    const result = { x: parent.x + local.x, y: parent.y + local.y, z: parent.z + local.z };
    cache.set(id, result); return result;
  };
  for (const p of doc.placements) resolve(p.id);
  return cache;
}

/** Parent changes preserve XYZ in the live layout and every saved view. Legacy
 * 2D fallbacks rebase as well, subject to the existing child-header minimum. */
export function rebaseParentage(doc:Document,changes:ReadonlyMap<string,string|null>,savedViews=true):Document {
 if(!changes.size)return doc;
 const worlds=worldPositions(doc),byId=new Map(doc.placements.map(p=>[p.id,p]));
 const plane=new Map<string,{x:number;y:number}>();
 const resolve2D=(id:string):{x:number;y:number}=>{const known=plane.get(id);if(known)return known;const p=byId.get(id)!;const parent=p.parentId?resolve2D(p.parentId):{x:0,y:0};const point={x:parent.x+p.position.x,y:parent.y+p.position.y};plane.set(id,point);return point;};
 const local=(worlds:ReadonlyMap<string,XYZ>,id:string,parentId:string|null)=>{const p=worlds.get(id)!,parent=parentId?worlds.get(parentId)!:{x:0,y:0,z:0};return {x:p.x-parent.x,y:p.y-parent.y,z:p.z-parent.z};};
 const layoutViews=savedViews?doc.layoutViews?.map(view=>{
  const saved=new Map(view.positions.map(p=>[p.placementId,p.position])),positions=worldPositions({...doc,placements:doc.placements.map(p=>({...p,spatialPosition:saved.get(p.id)??localPosition(p)}))});
  return {...view,positions:[...view.positions.filter(p=>!changes.has(p.placementId)),...[...changes].map(([id,parent])=>({placementId:id,position:local(positions,id,parent)}))]};
 }):undefined;
 return {...doc,...(layoutViews?{layoutViews}:{}),placements:doc.placements.map(p=>{
  if(!changes.has(p.id))return p;const parentId=changes.get(p.id)!,world=resolve2D(p.id),parent=parentId?resolve2D(parentId):{x:0,y:0};
  return {...p,parentId,spatialPosition:local(worlds,p.id,parentId),position:{x:parentId?Math.max(24,world.x-parent.x):world.x,y:parentId?Math.max(96,world.y-parent.y):world.y}};
 })};
}
