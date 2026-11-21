import {type World,type Origin,type Structure} from './model.ts';
import {address} from './lattice.ts';
export function hierarchyScope(world:World,roots:readonly Origin[],nextOnly=false){
 const eligible=world.nodes.filter(n=>!n.hidden&&!n.variantOf),byId=new Map(eligible.map(n=>[address(n.origin),n])),start=roots.length?roots.map(id=>byId.get(address(id))).filter((n):n is Structure=>!!n):eligible.filter(n=>!n.parent||!byId.has(address(n.parent)));
 const children=new Map<string,Structure[]>();for(const n of eligible)if(n.parent){const id=address(n.parent),list=children.get(id)??[];list.push(n);children.set(id,list);}const result=[...start],seen=new Set(start.map(n=>address(n.origin)));for(let i=0;i<result.length;i++){if(nextOnly&&i>=start.length)break;for(const child of children.get(address(result[i].origin))??[])if(!seen.has(address(child.origin))){seen.add(address(child.origin));result.push(child);}}return {roots:start,nodes:result,children};
}
export function toggleHierarchies(world:World,roots:readonly Origin[],nextOnly=false){const scope=hierarchyScope(world,roots,nextOnly),parents=(nextOnly?scope.roots:scope.nodes).filter(n=>scope.children.has(address(n.origin))),collapse=parents.length>0&&parents.every(n=>!n.collapsed);for(const n of parents)n.collapsed=collapse;if(nextOnly&&!collapse)for(const root of scope.roots)for(const child of scope.children.get(address(root.origin))??[])child.collapsed=true;return scope.nodes.map(n=>n.origin);}

export function hierarchyAction(world:World,roots:readonly Origin[],nextOnly=false,contentOnly=false){return contentOnly?hierarchyScope(world,roots,nextOnly).nodes.map(node=>node.origin):toggleHierarchies(world,roots,nextOnly);}

/** Transient branch filter. Saved hidden/collapsed flags remain owned by the world. */
export function createHierarchyIsolation(){
 let roots:Origin[]=[],cachedWorld:World|undefined,cached:Set<string>|undefined;
 function set(next:readonly Origin[]){roots=structuredClone([...next]);cachedWorld=undefined;cached=undefined;}
 return {get active(){return roots.length>0;},get roots(){return roots as readonly Origin[];},
 toggle(next:readonly Origin[]){if(roots.length)set([]);else if(next.length)set(next);else throw Error('Point at or select a hierarchy first.');},
 ensure(next:readonly Origin[]){if(next.length)set(next);else if(!roots.length)throw Error('Point at or select a hierarchy first.');},
 visible(world:World){if(!roots.length)return undefined;if(cachedWorld===world)return cached;
 const scope=hierarchyScope(world,roots),byId=new Map(world.nodes.map(n=>[address(n.origin),n])),ids=new Set(scope.nodes.map(n=>address(n.origin)));
 for(const root of scope.roots){let parent=root.parent;const seen=new Set<string>();while(parent){const id=address(parent);if(seen.has(id))break;seen.add(id);ids.add(id);parent=byId.get(id)?.parent;}}
 cachedWorld=world;cached=ids;return ids;}
 };
}
