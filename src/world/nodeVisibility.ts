import {type Structure,type Origin,sameOrigin} from '../core/model.ts';
import {address} from '../core/lattice.ts';
/** Visibility overrides are presentation-only; moving never edits saved flags. */
export function nodeVisible(node:Structure,context:{parent:(origin:Origin)=>Structure|undefined;variants:ReadonlySet<string>;pointOfView?:Origin;reveal:boolean;isolation?:ReadonlySet<string>;filter?:ReadonlySet<string>}){
 if(context.pointOfView&&sameOrigin(node.origin,context.pointOfView))return false;
 if(node.variantOf&&!context.variants.has(address(node.variantOf)))return false;
 if(context.reveal)return true;
 const id=address(node.origin);if(node.hidden||context.isolation&&!context.isolation.has(id)||context.filter&&!context.filter.has(id))return false;
 let parent=node.parent&&context.parent(node.parent),depth=0;
 while(parent&&depth++<500){if(parent.hidden||parent.collapsed&&!node.variantOf)return false;parent=parent.parent&&context.parent(parent.parent);}
 return true;
}
