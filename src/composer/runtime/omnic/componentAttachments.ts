import {componentIndex} from './componentTargets.ts';
import {evaluateRecipe,type Evaluation,type StructuralNode} from './evaluate.ts';
import {validateRecipe,type Recipe,type RecipeResolver} from './model.ts';
import {mapRegionShape,readRegionShape,regionDiscBounds,type RegionDisc} from '../properties/regionShape.ts';
import {targetNodes} from './contextGeometry.ts';

export type ComponentAttachment={id:string;owner:string;label:string};
/** Attachment capabilities are independent of containment and physical contact.
 * Only locally authored, visible attachments may be rewritten in this recipe. */
export function componentAttachments(recipe:Recipe,evaluation:Evaluation,targets:readonly string[]):ComponentAttachment[]{
 const sources=new Set(targetNodes(evaluation,targets).flatMap(node=>node.attachmentSource??[]));
 return recipe.operations.flatMap(op=>op.operator==='fill'&&op.params.attachment&&op.enabled&&sources.has(op.id)?[{id:op.id,owner:op.targets[0],label:'fill'}]:[]);
}
const appearance=(node:StructuralNode)=>({kind:node.kind,x:node.x,y:node.y,x2:node.x2,y2:node.y2,radius:node.radius,clip:node.clip,fill:node.fill,thickness:node.thickness,color:node.color,opacity:node.opacity,highlight:node.highlight,fillRegions:node.fillRegions,cap:node.cap,glow:node.glow});
const equivalent=(a:unknown,b:unknown):boolean=>{
 if(typeof a==='number'&&typeof b==='number')return Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
 if(a===b)return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(key=>equivalent((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
};
/** Snapshot current evaluated paint, keeping the authored ID and primitive roles.
 * Old operations keep their effective scopes and cannot reapply to baked paint.
 * Validate the complete candidate before the draft owner records one transaction. */
export function detachComponentAttachment(recipe:Recipe,id:string,resolve?:RecipeResolver):{recipe:Recipe;id:string}{
 const before=evaluateRecipe(recipe,resolve),attachment=componentAttachments(recipe,before,recipe.components.map(c=>c.id)).find(item=>item.id===id);
 if(before.motion)throw Error('Detachment currently requires a static structure.');
 if(!attachment)throw Error('This attachment is no longer available.');
 const nodes=before.nodes.filter(node=>node.attachmentSource===id);
 const units:RegionDisc[]=nodes.map(node=>{if(node.kind!=='dot'||!node.clip||!node.fill||node.thickness||node.highlight||node.fillRegions?.length||node.glow)throw Error('This attachment has effects that cannot be preserved as an independent region.');return {x:node.x,y:node.y,radius:node.radius,clip:node.clip,color:node.color,opacity:node.opacity};});
 const boxes=units.map(unit=>regionDiscBounds(unit));if(boxes.some(box=>!box))throw Error('The attachment has no detachable area.');
 const x=(Math.min(...boxes.map(b=>b!.left))+Math.max(...boxes.map(b=>b!.right)))/2,y=(Math.min(...boxes.map(b=>b!.top))+Math.max(...boxes.map(b=>b!.bottom)))/2;
 const shape=readRegionShape(JSON.stringify(mapRegionShape(units,p=>({x:p.x-x,y:p.y-y}))));
 const detachedRoles=new Set([id,...nodes.map(node=>node.id)]);
 const operations=recipe.operations.flatMap(op=>{
  if(op.id===id)return [];
  const targets=(op.targets.length?op.targets:before.operationTargets?.[op.id]??recipe.components.map(c=>c.id)).filter(target=>!detachedRoles.has(target));
  return targets.length?[{...op,targets}]:[];
 });
 const index=componentIndex(recipe);let root=attachment.owner;while(index.get(root)?.parent)root=index.get(root)!.parent!;
 const components=recipe.components.flatMap(component=>component.id===root?[component,{id,generator:'region',params:{shape:JSON.stringify(shape),x,y}}]:[component]);
 const next=validateRecipe({...recipe,components,operations}),after=evaluateRecipe(next,resolve),byId=new Map(after.nodes.filter(node=>node.kind!=='group').map(node=>[node.id,node]));
 const old=before.nodes.filter(node=>node.kind!=='group');
 if(old.length!==byId.size||old.some(node=>!byId.has(node.id)||!equivalent(appearance(node),appearance(byId.get(node.id)!))))throw Error('Detaching would change the evaluated structure. The original attachment is preserved.');
 return {recipe:next,id};
}
