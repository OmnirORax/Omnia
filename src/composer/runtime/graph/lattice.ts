import type { Document, XYZ } from './structural.ts';
import { worldPositions } from './coordinates.ts';
export type Cell = XYZ;
const key=(p:Cell)=>`${p.x},${p.y},${p.z}`;
const add=(a:XYZ,b:XYZ):XYZ=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:XYZ,b:XYZ):XYZ=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const latticeUnit=(size?:number)=>size&&Number.isFinite(size)&&size>0?size:1;
export const latticeScale=(scale?:number)=>scale&&Number.isFinite(scale)&&scale>0?scale:1;
export const cellPoint=(cell:Cell,unit=1):XYZ=>({x:cell.x*unit,y:cell.y*unit,z:cell.z*unit});
export function cellAt(point:XYZ,unit=1):Cell {
 const cell={x:Math.round(point.x/unit),y:Math.round(point.y/unit),z:Math.round(point.z/unit)};
 if(!Object.values(cell).every(Number.isSafeInteger))throw Error('Lattice address exceeds exact integer range.');
 return cell;
}
/** Sparse best-first search. No empty field is instantiated. Candidates are
 * ordered by actual distance to the requested point, then integer coordinates. */
function* orderedCells(point:XYZ):Generator<Cell> {
 type Candidate={cell:Cell;distance:number};
 const heap:Candidate[]=[],seen=new Set<string>();
 const less=(a:Candidate,b:Candidate)=>a.distance<b.distance||a.distance===b.distance&&(a.cell.x<b.cell.x||a.cell.x===b.cell.x&&(a.cell.y<b.cell.y||a.cell.y===b.cell.y&&a.cell.z<b.cell.z));
 const push=(cell:Cell)=>{const id=key(cell);if(seen.has(id)||!Object.values(cell).every(Number.isSafeInteger))return;seen.add(id);const item={cell,distance:(cell.x-point.x)**2+(cell.y-point.y)**2+(cell.z-point.z)**2};heap.push(item);let i=heap.length-1;while(i){const parent=(i-1)>>1;if(!less(item,heap[parent]))break;heap[i]=heap[parent];i=parent;}heap[i]=item;};
 push(cellAt(point));
 for(let count=0;heap.length&&count<250000;count++){
  const item=heap[0],last=heap.pop()!;
  if(heap.length){heap[0]=last;let i=0;while(true){let child=i*2+1;if(child>=heap.length)break;if(child+1<heap.length&&less(heap[child+1],heap[child]))child++;if(!less(heap[child],heap[i]))break;[heap[i],heap[child]]=[heap[child],heap[i]];i=child;}}
  yield item.cell;
  for(const axis of ['x','y','z'] as const)for(const sign of [-1,1])push({...item.cell,[axis]:item.cell[axis]+sign});
 }
 throw Error('No free lattice cell found within the bounded search.');
}
export function nearestCell(point:XYZ,free:(cell:Cell)=>boolean):Cell {
 for(const cell of orderedCells(point))if(free(cell))return cell;
 throw Error('No free lattice cell found within the bounded search.');
}
const caches=new WeakMap<Document,Map<number,ReturnType<typeof buildLattice>>>();
function buildLattice(doc:Document,unit:number){
 const worlds=worldPositions(doc),cells=new Map<string,Cell>(),occupied=new Map<string,string>();
 // Existing exact cells take priority over historical off-grid/overlapping data.
 const frontiers=new Map<string,Generator<Cell>>();
 const placements=doc.placements.map((p,index)=>({p,index,point:worlds.get(p.id)!}));
 placements.sort((a,b)=>Number(!Object.values(a.point).every(v=>Number.isSafeInteger(v/unit)))-Number(!Object.values(b.point).every(v=>Number.isSafeInteger(v/unit)))||a.index-b.index);
 for(const {p,point} of placements){
  const requested={x:point.x/unit,y:point.y/unit,z:point.z/unit},stamp=key(requested);
  let search=frontiers.get(stamp);if(!search){search=orderedCells(requested);frontiers.set(stamp,search);}
  let found=search.next();while(!found.done&&occupied.has(key(found.value)))found=search.next();
  if(found.done)throw Error('No free lattice cell found within the bounded search.');
  cells.set(p.id,found.value);occupied.set(key(found.value),p.id);
 }
 return {cells,occupied,worlds,unit};
}
/** Includes every placement, regardless of filtering, collapse or hidden state.
 * Historical coordinates are projected read-only; settings scale is not an input. */
export function prepareLattice(doc:Document,size?:number){
 const unit=latticeUnit(size);let cache=caches.get(doc);if(!cache){cache=new Map();caches.set(doc,cache);}let found=cache.get(unit);if(!found){found=buildLattice(doc,unit);cache.set(unit,found);}return found;
}
export function latticeWorld(doc:Document,id:string,size?:number):XYZ {
 const index=prepareLattice(doc,size),cell=index.cells.get(id);if(!cell)throw Error(`Missing placement: ${id}`);return cellPoint(cell,index.unit);
}
function writeWorlds(doc:Document,targets:ReadonlyMap<string,XYZ>):Document {
 const worlds=worldPositions(doc);
 return {...doc,placements:doc.placements.map(p=>{const target=targets.get(p.id);if(!target)return p;const parent=p.parentId?(targets.get(p.parentId)??worlds.get(p.parentId)!):{x:0,y:0,z:0};return {...p,spatialPosition:sub(target,parent)};})};
}
const movementCaches=new WeakMap<Document,Map<string,ReturnType<typeof movementPlan>>>();
function movementPlan(doc:Document,id:string,size?:number){
 const index=prepareLattice(doc,size),root=index.cells.get(id);if(!root)throw Error(`Missing placement: ${id}`);
 const children=new Map<string,string[]>();for(const p of doc.placements)if(p.parentId){const list=children.get(p.parentId)??[];list.push(p.id);children.set(p.parentId,list);}
 const moving=new Set([id]);for(const current of moving)for(const child of children.get(current)??[])moving.add(child);
 const offsets=[...moving].map(id=>({id,offset:sub(index.cells.get(id)!,root)}));
 const safe=(cell:Cell)=>offsets.every(({offset})=>{const occupant=index.occupied.get(key(add(cell,offset)));return !occupant||moving.has(occupant);});
 return {index,offsets,safe};
}
function preparedMove(doc:Document,id:string,size?:number){
 let cache=movementCaches.get(doc);if(!cache){cache=new Map();movementCaches.set(doc,cache);}const key=`${latticeUnit(size)}:${id}`;let plan=cache.get(key);if(!plan){plan=movementPlan(doc,id,size);cache.set(key,plan);}return plan;
}
export function resolveLatticePoint(doc:Document,id:string,desiredWorld:XYZ,size?:number,exact=false):XYZ {
 const {index,safe}=preparedMove(doc,id,size);
 const wanted={x:desiredWorld.x/index.unit,y:desiredWorld.y/index.unit,z:desiredWorld.z/index.unit};
 const cell=exact?cellAt(wanted):nearestCell(wanted,safe);
 if(!safe(cell))throw Error('That lattice cell is occupied.');
 return cellPoint(cell,index.unit);
}
export function latticeMove(doc:Document,id:string,desiredWorld:XYZ,size?:number,exact=false):Document {
 const {index,offsets}=preparedMove(doc,id,size),point=resolveLatticePoint(doc,id,desiredWorld,size,exact),cell=cellAt(point,index.unit);
 return writeWorlds(doc,new Map(offsets.map(({id,offset})=>[id,cellPoint(add(cell,offset),index.unit)])));
}
export function latticeDocument(doc:Document,size?:number):Document {
 const index=prepareLattice(doc,size);return writeWorlds(doc,new Map([...index.cells].map(([id,cell])=>[id,cellPoint(cell,index.unit)])));
}
export function latticeCreatePoint(doc:Document,desiredWorld:XYZ,size?:number):XYZ {
 const index=prepareLattice(doc,size);return cellPoint(nearestCell({x:desiredWorld.x/index.unit,y:desiredWorld.y/index.unit,z:desiredWorld.z/index.unit},cell=>!index.occupied.has(key(cell))),index.unit);
}
/** Geometry edits from inspectors/layout/transform owners use the same occupancy
 * boundary. Unchanged placements keep their projected cells and saved coordinates. */
export function reconcileLattice(previous:Document,next:Document,size?:number):Document {
 if(previous===next)return next;
 const old=prepareLattice(previous,size),worlds=worldPositions(next),occupied=new Set<string>(),targets=new Map<string,XYZ>();
 const changed:string[]=[];
 for(const p of next.placements){const before=old.worlds.get(p.id),after=worlds.get(p.id)!;if(before&&before.x===after.x&&before.y===after.y&&before.z===after.z){occupied.add(key(old.cells.get(p.id)!));}else changed.push(p.id);}
 for(const id of changed){const point=worlds.get(id)!;const cell=nearestCell({x:point.x/old.unit,y:point.y/old.unit,z:point.z/old.unit},cell=>!occupied.has(key(cell)));occupied.add(key(cell));targets.set(id,cellPoint(cell,old.unit));}
 if(!changed.length&&previous.placements.length===next.placements.length)return next;
 // Freeze the existing projection on the first geometry edit so removing or
 // moving a historical collision cannot shuffle unrelated carriers.
 for(const p of next.placements)if(!targets.has(p.id))targets.set(p.id,cellPoint(old.cells.get(p.id)!,old.unit));
 const needsSnapshot=previous.placements.some(p=>{const a=old.worlds.get(p.id)!,b=cellPoint(old.cells.get(p.id)!,old.unit);return a.x!==b.x||a.y!==b.y||a.z!==b.z;});
 let result=writeWorlds(next,targets);
 if(needsSnapshot){
  const positions=previous.placements.map(p=>({placementId:p.id,position:p.spatialPosition??{x:p.position.x/100,y:p.parentId?-2:0,z:p.position.y/100}}));
  if(!next.layoutViews?.some(view=>view.preservePositions&&JSON.stringify(view.positions)===JSON.stringify(positions))){
   const needsAuthored=!next.layoutViews?.some(view=>view.id==='authored-layout');
   if((next.layoutViews?.length??0)+1+Number(needsAuthored)>100)throw Error('Save/export the current layout or remove a layout view before aligning historical coordinates.');
   const authored=needsAuthored?[{id:'authored-layout',name:'Authored layout',rule:'manual' as const,positions:result.placements.map(p=>({placementId:p.id,position:p.spatialPosition!}))}]:[];
   result={...result,activeLayoutViewId:result.activeLayoutViewId??'authored-layout',layoutViews:[...(result.layoutViews??[]),...authored,{id:crypto.randomUUID(),name:'Before lattice alignment',rule:'manual',preservePositions:true,positions}]};
  }
 }
 return result;

}
/** Prepare fixed occupancy once for a layout-rotation gesture. Motion only
 * quantizes its already-captured targets and checks the sparse occupancy map. */
export function prepareLatticeTransform(doc:Document,ids:readonly string[],size?:number,scale?:number){
 const index=prepareLattice(doc,size),moving=new Set(ids),pitch=index.unit*latticeScale(scale);
 return (targets:ReadonlyMap<string,XYZ>):Map<string,XYZ>|undefined=>{
  const seen=new Set<string>(),result=new Map<string,XYZ>();
  for(const [id,point] of targets){const cell=cellAt(point,pitch),address=key(cell),occupant=index.occupied.get(address);
   if(seen.has(address)||occupant&&!moving.has(occupant))return undefined;
   seen.add(address);result.set(id,cellPoint(cell,pitch));
  }
  return result;
 };
}

/** Shared creation adapter: navigator world address to parent-local authored XYZ. */
export function localLatticePoint(doc:Document,parentId:string|null,world:XYZ|undefined,size?:number):XYZ|undefined {
 if(!world)return undefined;if(!parentId)return {...world};
 if(!doc.placements.some(p=>p.id===parentId))throw Error('The creation parent no longer exists.');
 const parent=latticeWorld(doc,parentId,size);return {x:world.x-parent.x,y:world.y-parent.y,z:world.z-parent.z};
}
