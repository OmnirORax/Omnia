import {bind,locate,prepareWorld,type Origin,type World} from '../core/model.ts';
import {definitionRecipe} from '../omnic/definition.ts';
import {atlasRecipeResolver,referenceBinding} from '../omnic/bindings.ts';
/** Object-shaped views are transient UI inputs, never a second placement or ID store. */
export function composerAtlas(world:World,origin:Origin){
 const owner=locate(world,origin);if(!owner)throw Error('Composer structure was removed.');
 const index=prepareWorld(world),project=(node:typeof owner,key:string)=>({id:key,label:node.label,omnic:definitionRecipe(node,world),omnicHistory:node.omnicHistory});
 const entity=project(owner,JSON.stringify(bind(owner,'follow',world)));
 const definitions=world.nodes.filter(node=>node.invariant&&definitionRecipe(node,world));
 const objects=definitions.map(node=>project(node,node===owner?entity.id:JSON.stringify(bind(node,'structure',world))));
 return {entity,objects,presetIds:definitions.flatMap((node,i)=>node.catalog?.preset?[objects[i].id]:[]),resolveReference:atlasRecipeResolver(world),referenceObject:(key:string)=>{let matches;try{matches=index.resolve(referenceBinding(key));}catch{return undefined;}return matches.length===1?project(matches[0],key):undefined;}};
}
