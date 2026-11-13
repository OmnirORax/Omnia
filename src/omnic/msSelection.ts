import type {StructuralNode} from './evaluate.ts';
/** Project MS membership into whole authored edit owners. Partial generated
 * selections remain MS selections and must never silently edit the whole owner. */
export function selectedEditOwners(nodes:readonly StructuralNode[],owners:ReadonlyMap<string,string>,selected:ReadonlySet<string>){
 const totals=new Map<string,number>(),included=new Map<string,number>();
 for(const node of nodes){if(node.kind==='group')continue;const owner=owners.get(node.id);if(!owner)continue;totals.set(owner,(totals.get(owner)??0)+1);if(selected.has(node.id))included.set(owner,(included.get(owner)??0)+1);}
 return [...totals.keys()].filter(owner=>included.get(owner)===totals.get(owner));
}
