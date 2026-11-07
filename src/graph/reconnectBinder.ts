import { ensureVariantPlacements, validateDocument, type Document } from './structural.ts';
import type { DisplayBinder } from './binders.ts';
import { rebaseParentage } from './coordinates.ts';
export type BinderEnd='source'|'target';
/** Reconnect the captured displayed edge through its real domain owner. IDs,
 * styles, participant roles and unrelated records survive. Validate the entire
 * candidate before the caller commits one shared history transaction. */
function reconnectCandidate(doc:Document,binder:DisplayBinder,end:BinderEnd,destination:string,savedViews=true):Document {
 const byId=new Map(doc.placements.map(p=>[p.id,p])),source=byId.get(binder.source),target=byId.get(binder.target),drop=byId.get(destination);
 if(!source||!target||!drop)throw Error('A binder endpoint no longer exists.');
 if(destination===binder[end])return doc;
 if(destination===binder[end==='source'?'target':'source'])throw Error('Choose another node, not the fixed endpoint.');
 const parentChanges=new Map<string,string|null>();let next=doc;
 if(binder.kind==='relationship'){
  const relation=doc.relationships.find(r=>r.id===binder.id);
  if(!relation||relation.participants[0]?.entityId!==source.entityId||relation.participants[1]?.entityId!==target.entityId)throw Error('Expand the actual relationship endpoints before reconnecting.');
  const index=end==='source'?0:1;
  if(relation.participants[index].entityId===drop.entityId)return doc;
  next={...doc,relationships:doc.relationships.map(r=>r.id===binder.id?{...r,participants:r.participants.map((p,i)=>i===index?{...p,entityId:drop.entityId}:p)}:r)};
 }else if(binder.kind==='composition'){
  const composition=doc.compositions.find(c=>c.id===binder.id);
  if(!composition||composition.parentId!==source.entityId||composition.childId!==target.entityId)throw Error('Expand the actual containment endpoints before reconnecting.');
  const updated={...composition,...(end==='source'?{parentId:drop.entityId}:{childId:drop.entityId})};
  next={...doc,compositions:doc.compositions.map(c=>c.id===binder.id?updated:c)};
  // A nested contains edge owns this particular visual parent link too. Other
  // occurrences retain their independent nesting; canonical containment is shared.
  if(binder.key===`nest:${target.id}`){
   if(target.parentId!==source.id)throw Error('The visual containment link changed.');
   if(end==='source')parentChanges.set(target.id,drop.id);
   else {if(drop.parentId)throw Error('Detach the new endpoint from its visual parent first.');parentChanges.set(target.id,null);parentChanges.set(drop.id,source.id);}
  }
 }else if(binder.kind==='visual'){
  if(target.id!==binder.id||target.parentId!==source.id)throw Error('The visual nesting link changed.');
  if(end==='source')parentChanges.set(target.id,drop.id);
  else {
   if(drop.parentId)throw Error('Detach the new endpoint from its visual parent first.');
   parentChanges.set(target.id,null);parentChanges.set(drop.id,source.id);
   next={...doc,placements:doc.placements.map(p=>p.id===drop.id?{...p,nestingBinder:target.nestingBinder}:p)};
  }
 }else {
  const variant=doc.variants?.find(v=>v.id===binder.id);
  if(!variant||source.entityId!==variant.ownerId||target.entityId!==variant.entityId||target.variantOwner?.variantId!==variant.id||target.variantOwner.placementId!==source.id)throw Error('Expand the actual variant endpoints before reconnecting.');
  if(end==='target'&&(drop.parentId||drop.variantOwner))throw Error('Detach the new endpoint from its existing owner first.');
  const updated={...variant,...(end==='source'?{ownerId:drop.entityId}:{entityId:drop.entityId})};
  const owner=end==='source'?drop:source,child=end==='target'?drop:target;
  next={...doc,variants:doc.variants!.map(v=>v.id===variant.id?updated:v),placements:doc.placements.map(p=>{
   if(p.variantOwner?.variantId!==variant.id&&p.id!==child.id)return p;
   if(p.variantOwner?.variantId===variant.id&&p.parentId===p.variantOwner.placementId)parentChanges.set(p.id,null);
   if(p.id===child.id){parentChanges.set(p.id,owner.id);return {...p,variantOwner:{placementId:owner.id,variantId:variant.id}};}
   const {variantOwner: _owner,...detached}=p;return detached;
  })};
 }
 if(parentChanges.size)next=rebaseParentage(next,parentChanges,savedViews);
 next=validateDocument(next);
 if(binder.kind==='variant')next=validateDocument(ensureVariantPlacements(next,undefined,binder.id));
 return next;
}

export function reconnectBinder(doc:Document,binder:DisplayBinder,end:BinderEnd,destination:string):Document {
 return reconnectCandidate(doc,binder,end,destination);
}
/** Hover validation never rebases/copies all saved layouts. Commit repeats the
 * same domain validation against the live document before updating saved views. */
export function binderReconnectReason(doc:Document,binder:DisplayBinder,end:BinderEnd,destination:string):string|null {
 try{reconnectCandidate(doc,binder,end,destination,false);return null;}catch(error){return error instanceof Error?error.message:String(error);}
}
