import type { DisplayBinder } from './binders.ts';
import { ensureVariantPlacements, validateDocument, type Document } from './structural.ts';
import { rebaseParentage } from './coordinates.ts';
/** Domain edits, never cosmetic arrow flips. Captured endpoints must still be real. */
export function editBinderConnection(doc:Document,binder:DisplayBinder,action:'reverse'|'delete'):Document {
 const source=doc.placements.find(p=>p.id===binder.source),target=doc.placements.find(p=>p.id===binder.target);
 if(!source||!target)throw Error('The binder endpoints no longer exist.');
 let next=doc;const parents=new Map<string,string|null>();
 const rotateParent=()=>{
  if(source.variantOwner)throw Error('Detach the upstream variant from its owner before reversing this hierarchy.');
  parents.set(target.id,source.parentId);parents.set(source.id,target.id);
  next={...next,placements:next.placements.map(p=>{if(p.id!==source.id&&p.id!==target.id)return p;const {nestingBinder:_,...rest}=p,style=p.id===source.id?target.nestingBinder:source.nestingBinder;return {...rest,...(style?{nestingBinder:style}:{})};})};
 };
 if(binder.kind==='relationship'){
  const relation=doc.relationships.find(r=>r.id===binder.id);
  if(!relation||relation.participants[0]?.entityId!==source.entityId||relation.participants[1]?.entityId!==target.entityId)throw Error('Expand the actual relationship endpoints before editing.');
  next={...doc,relationships:action==='delete'?doc.relationships.filter(r=>r.id!==relation.id):doc.relationships.map(r=>r.id===relation.id?{...r,participants:r.participants.map((p,i)=>i<2?{...p,entityId:relation.participants[1-i].entityId}:p)}:r)};
 }else if(binder.kind==='composition'){
  const composition=doc.compositions.find(c=>c.id===binder.id);
  if(!composition||composition.parentId!==source.entityId||composition.childId!==target.entityId)throw Error('Expand the actual containment endpoints before editing.');
  next={...doc,compositions:action==='delete'?doc.compositions.filter(c=>c.id!==binder.id):doc.compositions.map(c=>c.id===binder.id?{...c,parentId:c.childId,childId:c.parentId}:c)};
  if(binder.key===`nest:${target.id}`){
   if(target.parentId!==source.id)throw Error('The visual containment link changed.');
   if(action==='reverse')rotateParent();else parents.set(target.id,null);
  }
 }else if(binder.kind==='visual'){
  if(target.id!==binder.id||target.parentId!==source.id||target.variantOwner)throw Error('The visual nesting link changed.');
  if(action==='reverse')rotateParent();else parents.set(target.id,null);
 }else {
  const variant=doc.variants?.find(v=>v.id===binder.id);
  if(!variant||variant.ownerId!==source.entityId||variant.entityId!==target.entityId||target.variantOwner?.variantId!==variant.id||target.variantOwner.placementId!==source.id)throw Error('Expand the actual variant endpoints before editing.');
  if(action==='reverse'&&source.variantOwner)throw Error('Detach the upstream variant from its owner before reversing this hierarchy.');
  next={...doc,variants:action==='delete'?doc.variants!.filter(v=>v.id!==binder.id):doc.variants!.map(v=>v.id===binder.id?{...v,ownerId:target.entityId,entityId:source.entityId}:v),placements:doc.placements.map(p=>{
   if(p.variantOwner?.variantId!==binder.id)return p;
   if(p.parentId===p.variantOwner.placementId)parents.set(p.id,null);
   const {variantOwner:_,...rest}=p;return rest;
  })};
  if(action==='reverse'){
   parents.set(target.id,source.parentId);parents.set(source.id,target.id);
   next={...next,placements:next.placements.map(p=>p.id===source.id?{...p,variantOwner:{variantId:binder.id,placementId:target.id}}:p)};
  }
 }
 if(parents.size){next=rebaseParentage(next,parents);const owners=new Set([...parents.values()].filter(Boolean));next={...next,placements:next.placements.map(p=>owners.has(p.id)?{...p,collapsed:false}:p)};}
 next=validateDocument(next);
 return action==='reverse'&&binder.kind==='variant'?validateDocument(ensureVariantPlacements(next,undefined,binder.id)):next;
}
