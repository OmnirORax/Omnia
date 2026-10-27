import type { Entity } from '../graph/structural.ts';
import { referenceComponents, type Component, type RecipeResolver } from './model.ts';

export function objectResolver(entities:readonly Pick<Entity,'id'|'omnic'|'omnicHistory'>[]):RecipeResolver {
  const objects=new Map(entities.map(entity=>[entity.id,entity]));
  return (id,revision)=>{const object=objects.get(id);return revision===undefined?object?.omnic:object?.omnicHistory?.find(recipe=>recipe.revision===revision);};
}
/** Capture every current definition once. Frozen snapshots pin their entire
 * dependency graph; live definitions continue following canonical objects. */
export function archiveDefinitions(entities:readonly Entity[]):Entity[] {
  const objects=new Map(entities.map(entity=>[entity.id,entity.omnic?.version===1?{...entity,omnic:{...entity.omnic,version:2 as const}}:entity])),visiting=new Set<string>();
  const archive=(id:string)=>{
    const object=objects.get(id);if(!object?.omnic)throw Error(`Missing Omnic object: ${id}`);
    if(object.omnicHistory?.some(recipe=>recipe.revision===object.omnic!.revision))return;
    if(visiting.has(id))throw Error(`Circular Omnic reference: ${id}`);visiting.add(id);
    const pin=(c:Component):Component=>{
      let result={...c,...(c.children?{children:c.children.map(pin)}:{})};
      if(c.reference&&c.referenceRevision===undefined){archive(c.reference);result={...result,referenceRevision:objects.get(c.reference)!.omnic!.revision};}
      return result;
    };
    const recipe={...object.omnic,components:object.omnic.components.map(pin)};
    objects.set(id,{...object,omnicHistory:[...(object.omnicHistory??[]),recipe]});visiting.delete(id);
  };
  for(const object of entities)if(object.omnic)archive(object.id);
  // Never evict a revision reached by a current pin or another retained snapshot.
  // Unreferenced older revisions may age out; referenced history has priority.
  const pinned=new Set<string>();
  for(const object of objects.values())for(const recipe of [object.omnic,...(object.omnicHistory??[])])if(recipe)for(const c of referenceComponents(recipe))if(c.referenceRevision!==undefined)pinned.add(JSON.stringify([c.reference,c.referenceRevision]));
  return [...objects.values()].map(object=>{
    const history=object.omnicHistory;if(!history||history.length<=32)return object;
    const required=history.filter(r=>r.revision===object.omnic?.revision||pinned.has(JSON.stringify([object.id,r.revision])));
    if(required.length>32)throw Error('Revision archive is full of pinned dependencies. Unpin unused revisions before saving.');
    const keep=new Set(required);for(const recipe of [...history].reverse())if(keep.size<32)keep.add(recipe);
    return {...object,omnicHistory:history.filter(recipe=>keep.has(recipe))};
  });
}
/** Explicit, undoable archive maintenance. Preserve the current snapshot, all
 * incoming pins, and the self-reference closure of those retained snapshots. */
export function pruneObjectHistory(entities:readonly Entity[],entityId:string):Entity[]{
  const object=entities.find(e=>e.id===entityId);if(!object?.omnic)throw Error('Missing Omnic object.');
  const keep=new Set([object.omnic.revision]);
  const inspect=(recipe:Entity['omnic'])=>{if(recipe)for(const c of referenceComponents(recipe))if(c.reference===entityId&&c.referenceRevision!==undefined)keep.add(c.referenceRevision);};
  for(const e of entities){inspect(e.omnic);if(e.id!==entityId)e.omnicHistory?.forEach(inspect);}
  let size=-1;while(size!==keep.size){size=keep.size;object.omnicHistory?.filter(r=>keep.has(r.revision)).forEach(inspect);}
  return entities.map(e=>e===object?{...e,omnicHistory:e.omnicHistory?.filter(r=>keep.has(r.revision))}:e);
}
