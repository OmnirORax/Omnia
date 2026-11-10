/** Additional node actions share the existing context-menu and shortcut owner. */
export const NODE_ACCESS_ACTIONS=[['document','Document'],['variants','Variants'],['addVariant','Add variant']] as const;
export type NodeAccessAction=typeof NODE_ACCESS_ACTIONS[number][0];
/** A delayed open must not target a placement that was removed meanwhile. */
export function nodeDocumentTarget(id:string|undefined,placements:readonly {id:string}[]):string|undefined{
 return id&&placements.some(placement=>placement.id===id)?id:undefined;
}
