import {pairedHandles,remapRecipeHandles} from '../omnic/handles.ts';
import {recipeDelta} from '../omnic/delta.ts';
import {recipeSpecification} from '../omnic/specification.ts';
import {definitionRecipe} from '../omnic/definition.ts';
import {definitionBindings,rebindDefinitions} from '../omnic/transfer.ts';
import { emptyWorld, prepareWorld, type World, type Origin, type Binding, type Vec3 } from './model.ts';
import { checkedWorld, parseWorkspaceFile, sceneReferences, type WorkspaceFile } from './transfer.ts';

const key = (origin: Origin) => JSON.stringify(origin);
export type TransferChoice = { nodes: string[]; settings: boolean; scene: boolean; appearance: boolean };
export type PartsFile = WorkspaceFile & { parts?: TransferChoice & { complete: boolean } };
export const fullChoice = (world: World): TransferChoice => ({ nodes: world.nodes.map(node => key(node.origin)), settings: true, scene: true, appearance: true });
export const hasChoice = (choice: TransferChoice) => !!(choice.nodes.length || choice.settings || choice.scene || choice.appearance);
export const availableChoice = (file: PartsFile): TransferChoice => file.parts ?? fullChoice(file.world);
function checkChoice(world: World, choice: TransferChoice) {
  const ids = new Set(world.nodes.map(node => key(node.origin)));
  if (!choice || !Array.isArray(choice.nodes) || choice.nodes.some(id => typeof id !== 'string' || !ids.has(id)) || new Set(choice.nodes).size !== choice.nodes.length || ['settings','scene','appearance'].some(k => typeof choice[k as keyof TransferChoice] !== 'boolean') || !hasChoice(choice)) throw Error('Choose parts present in this file.');
}
/** Include actual dependencies, never arbitrary strings that happen to resemble IDs. */
export function subsetWorld(world: World, choice: TransferChoice): World {
  checkChoice(world, choice);
  const byId = new Map(world.nodes.map(node => [key(node.origin), node])), included = new Set(choice.nodes), pending = [...included];
  const children = new Map<string, string[]>();
  for (const node of world.nodes) if (node.parent) { const id = key(node.parent); const group = children.get(id) ?? []; group.push(key(node.origin)); children.set(id, group); }
  const prepared = prepareWorld(world);
  const include = (id: string) => { if (byId.has(id) && !included.has(id)) { included.add(id); pending.push(id); } };
  const binding = (value: Binding) => prepared.resolve(value).forEach(node => include(key(node.origin)));
  for (let at = 0; at < pending.length; at++) {
    const node = byId.get(pending[at])!;
    if (node.parent) include(key(node.parent));
    if (node.variantOf) include(key(node.variantOf));
    node.parts.forEach(binding);definitionBindings(node).forEach(binding);
    if (node.visual?.omnicEntityId) include(node.visual.omnicEntityId);
    node.text?.content.forEach(part => { if (typeof part !== 'string') include(part.glyph); });
    // A selected parent carries its children.
    for (const child of children.get(pending[at]) ?? []) include(child);
  }
  const nodes = world.nodes.filter(node => included.has(key(node.origin)));
  const assets = new Set(nodes.map(node => node.visual?.assetId).filter(Boolean));
  const inside = (value: Binding) => { const resolved = prepared.resolve(value); return resolved.length > 0 && resolved.every(node => included.has(key(node.origin))); };
  return structuredClone(checkedWorld({ ...emptyWorld(), version:world.version,atlases:choice.settings?world.atlases:undefined,activeAtlas:choice.settings?world.activeAtlas:undefined, nodes, assets: world.assets?.filter(asset => assets.has(asset.id)), relationships: world.relationships?.filter(relation => inside(relation.from) && inside(relation.to)),
    settings: choice.settings ? world.settings : undefined, scene: choice.scene ? world.scene : undefined, appearance: choice.appearance ? world.appearance : undefined }));
}
export function createPartsFile(world: World, choice: TransferChoice): PartsFile {
  const subset = subsetWorld(world, choice);
  return { format: 'omnium-v2-workspace', version: 1, world: subset, scenes: [], parts: { ...structuredClone(choice), complete: choice.nodes.length === world.nodes.length } };
}
export function parsePartsFile(text: string): PartsFile {
  const file = parseWorkspaceFile(text) as PartsFile, raw = file;
  if (raw.parts !== undefined) {
    checkChoice(file.world, raw.parts);
    if (typeof raw.parts.complete !== 'boolean') throw Error('Invalid complete-workspace marker.');
    file.parts = { nodes: raw.parts.nodes, settings: raw.parts.settings, scene: raw.parts.scene, appearance: raw.parts.appearance, complete: raw.parts.complete };
    const subset = subsetWorld(file.world, file.parts);
    if (subset.nodes.length !== file.world.nodes.length) throw Error('Transfer contains unrelated nodes.');
  }
  return file;
}
export function preparePartsImport(current: World, file: PartsFile, choice: TransferChoice, replace: boolean): World {
  const available = availableChoice(file);
  checkChoice(file.world, choice);
  if (choice.nodes.some(id => !available.nodes.includes(id)) || choice.settings && !available.settings || choice.scene && !available.scene || choice.appearance && !available.appearance) throw Error('Choose parts present in this file.');
  const incoming = subsetWorld(file.world, choice), next = structuredClone(current);
  if(incoming.version===3)next.version=3;
  if (replace) {
    if (file.parts?.complete === false || choice.nodes.length !== available.nodes.length) throw Error('Only complete selected content can replace the workspace.');
    next.nodes = incoming.nodes; next.assets = incoming.assets; next.relationships = incoming.relationships;
    if(choice.settings){next.atlases=incoming.atlases;next.activeAtlas=incoming.activeAtlas;}
  } else if (incoming.nodes.length) {
    // Keep a batch rigid and independent; preserve all internal references.
    const ids = new Map<string, Origin>(); let born = Math.max(Date.now(), ...current.nodes.map(node => node.origin.born)) + 1;
    const original=prepareWorld(incoming),existingIndex=prepareWorld(current),canonical=new Map(current.nodes.filter(n=>n.invariant).map(node=>[existingIndex.specification(node),node]));
    const originalSpecs=new Map(incoming.nodes.map(node=>[node,original.specification(node)])),reused=new Set<World['nodes'][number]>();
    for (const node of incoming.nodes){const match=incoming.version===3&&node.invariant?canonical.get(originalSpecs.get(node)!):undefined;if(match){ids.set(key(node.origin),match.origin);reused.add(node);}else ids.set(key(node.origin),{born:born++,at:[...node.origin.at]});}
    const materialized=new Map(incoming.nodes.map(node=>[node,definitionRecipe(node,incoming)]));
    const handleMaps=new Map<World['nodes'][number],Map<string,string>>(),adjusted=new Set<World['nodes'][number]>();
    function adaptHandles(node:World['nodes'][number]){
      if(adjusted.has(node))return;adjusted.add(node);
      const old=materialized.get(node);if(!old)return;
      if(reused.has(node)){const target=canonical.get(originalSpecs.get(node)!)!,actual=definitionRecipe(target,current);if(actual)handleMaps.set(node,pairedHandles(old,actual));return;}
      const parent=node.variantOf&&incoming.nodes.find(parent=>key(parent.origin)===key(node.variantOf!));if(!parent)return;
      adaptHandles(parent);const mapping=handleMaps.get(parent);if(!mapping)return;
      const inherited=new Map(mapping),used=new Set(inherited.values()),ids=(recipe:typeof old)=>{const result:string[]=[];const walk=(items:typeof recipe.components)=>items.forEach(c=>{result.push(c.id);walk(c.children??[]);});walk(recipe.components);return [...result,...recipe.operations.map(op=>op.id),...recipe.frames.map(frame=>frame.id)];};
      for(const id of ids(old))if(!inherited.has(id)&&used.has(id)){const next=crypto.randomUUID();inherited.set(id,next);used.add(next);}
      const recipe=remapRecipeHandles(old,inherited),base=reused.has(parent)?definitionRecipe(canonical.get(originalSpecs.get(parent)!)!,current)!:materialized.get(parent)!;
      node.omnicEdits=recipeDelta(base,recipe);materialized.set(node,recipe);handleMaps.set(node,inherited);if(node.omnicDraft)node.omnicDraft=remapRecipeHandles(node.omnicDraft,inherited);
    }
    for(const node of incoming.nodes)adaptHandles(node);
    const pins=new Map<World['nodes'][number],Map<number,number>>(),retained:Array<{node:World['nodes'][number];target:World['nodes'][number];old:number;next:number}>=[];
    for(const node of reused){const target=next.nodes.find(target=>key(target.origin)===key(ids.get(key(node.origin))!))!,map=new Map<number,number>();let revision=Math.max(0,...(target.omnicHistory??[]).map(recipe=>recipe.revision));
      for(const recipe of node.omnicHistory??[]){const equivalent=target.omnicHistory?.find(other=>recipeSpecification(other)===recipeSpecification(recipe));const mapped=equivalent?.revision??++revision;map.set(recipe.revision,mapped);if(!equivalent)retained.push({node,target,old:recipe.revision,next:mapped});}pins.set(node,map);
    }
    const pin=(binding:Binding,revision:number)=>{const targets=original.resolve(binding);return targets.length===1?pins.get(targets[0])?.get(revision)??revision:revision;};
    const offset = current.nodes.length ? Math.max(...current.nodes.map(node => node.position[0])) - Math.min(...incoming.nodes.map(node => node.position[0])) + 2 : 0;
    const positionMap=new Map(incoming.nodes.map(node=>[JSON.stringify(node.position),reused.has(node)?canonical.get(originalSpecs.get(node)!)!.position:[node.position[0]+offset,node.position[1],node.position[2]] as Vec3]));
    const position = (at: Vec3): Vec3 => positionMap.get(JSON.stringify(at))??[at[0] + offset, at[1], at[2]];
    const origin = (value: Origin) => { const mapped = ids.get(key(value)); if (!mapped) throw Error('Cannot add content with unresolved references.'); return structuredClone(mapped); };
    const binding = (value: Binding): Binding => value.mode === 'follow' ? { ...value, origin: origin(value.origin) } : value.mode === 'position' ? { ...value, at: position(value.at) } : value;
    const prepared = original;
    for (const node of incoming.nodes) for (const value of node.parts) if (!prepared.resolve(value).length) throw Error('Cannot add content with unresolved references.');
    for (const node of incoming.nodes) {
      node.origin = origin(node.origin); node.position = position(node.position);
      if (node.parent) node.parent = origin(node.parent);
      if (node.variantOf) node.variantOf = origin(node.variantOf);
      node.parts = node.parts.map(binding);rebindDefinitions(node,binding,pin,materialized.get(node));
      if (node.visual?.omnicEntityId && ids.has(node.visual.omnicEntityId)) node.visual.omnicEntityId = key(ids.get(node.visual.omnicEntityId)!);
      node.text?.content.forEach(part => { if (typeof part !== 'string') part.glyph = key(origin(JSON.parse(part.glyph))); });
    }
    incoming.relationships?.forEach(relation => { relation.from = binding(relation.from); relation.to = binding(relation.to); });
    for(const view of incoming.atlases??[])if(view.roots)view.roots=view.roots.map(binding);
    for(const node of reused){const target=next.nodes.find(target=>key(target.origin)===key(node.origin))!;
      if(node.omnicDraft){const draft=remapRecipeHandles(node.omnicDraft,handleMaps.get(node)??new Map());if(target.omnicDraft&&recipeSpecification(target.omnicDraft)!==recipeSpecification(draft))throw Error('Both workspaces have different drafts for this definition. Save or clear one before importing.');target.omnicDraft??=draft;}
      if(node.lexiconWords)target.lexiconWords=[...new Set([...(target.lexiconWords??[]),...node.lexiconWords])];
      if(node.catalog){target.catalog??={tags:[],collections:[]};for(const field of ['tags','collections'] as const)target.catalog[field]=[...new Set([...target.catalog[field],...node.catalog[field]])];}
    }
    for(const item of retained){const recipe=item.node.omnicHistory!.find(recipe=>recipe.revision===item.old)!;item.target.omnicHistory=[...(item.target.omnicHistory??[]),{...structuredClone(recipe),revision:item.next}];}
    if(incoming.version===3){
      const previousSpecs=new Map(originalSpecs);
      incoming.nodes=incoming.nodes.filter(node=>!reused.has(node));
      const structural=(value:Binding,map:Map<string,string>):Binding=>value.mode==='structure'?{...value,specification:map.get(value.specification)??value.specification}:value;
      // Recalculate semantic selectors after birth/position rebinding, from leaves outward.
      for(let pass=0;pass<32;pass++){
        const merged={...next,nodes:[...next.nodes,...incoming.nodes]},index=prepareWorld(merged),map=new Map<string,string>();
        for(const node of incoming.nodes){const spec=index.specification(node);map.set(originalSpecs.get(node)!,spec);map.set(previousSpecs.get(node)!,spec);previousSpecs.set(node,spec);}
        let changed=false;const rebind=(value:Binding)=>{const updated=structural(value,map);changed ||=JSON.stringify(value)!==JSON.stringify(updated);return updated;};
        for(const node of incoming.nodes){node.parts=node.parts.map(rebind);rebindDefinitions(node,rebind);}
        for(const relation of incoming.relationships??[]){relation.from=rebind(relation.from);relation.to=rebind(relation.to);}
        for(const view of incoming.atlases??[])if(view.roots)view.roots=view.roots.map(rebind);
        if(!changed)break;
      }
    }
    // Version 2 imports retain the older instance-copy behavior.
    const existing = prepareWorld(current), invariantKeys = new Set(current.nodes.filter(node => node.invariant).map(existing.specification));
    const imported = prepareWorld({...next,nodes:[...next.nodes,...incoming.nodes]});
    for (const node of incoming.nodes) if (node.invariant && invariantKeys.has(imported.specification(node))) node.invariant = false;
    if(choice.settings&&incoming.atlases?.length){const names=new Set(next.atlases?.map(view=>view.name)??[]);next.atlases??=[];for(const view of incoming.atlases){if(names.has(view.name)){if(JSON.stringify(next.atlases.find(existing=>existing.name===view.name))===JSON.stringify(view))continue;let suffix=2;while(names.has(`${view.name} ${suffix}`))suffix++;view.name=`${view.name} ${suffix}`;}names.add(view.name);next.atlases.push(view);}next.activeAtlas??=0;}
    next.nodes.push(...incoming.nodes); next.relationships = [...(next.relationships ?? []), ...(incoming.relationships ?? [])];
    const assets = new Map((next.assets ?? []).map(asset => [asset.id, asset]));
    for (const asset of incoming.assets ?? []) { if (assets.has(asset.id) && JSON.stringify(assets.get(asset.id)) !== JSON.stringify(asset)) throw Error('Conflicting visual asset.'); assets.set(asset.id, asset); }
    next.assets = [...assets.values()];
  }
  for (const part of ['settings','scene','appearance'] as const) if (choice[part]) Object.assign(next, { [part]: incoming[part] });
  return checkedWorld(next);
}
export function scenesForChoice(file: PartsFile, choice: TransferChoice) { return sceneReferences(subsetWorld(file.world, choice)); }
