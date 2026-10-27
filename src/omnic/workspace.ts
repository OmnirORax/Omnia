import {emptyDocument,validateDocument,type Document,type Entity} from '../graph/structural.ts';
import {archiveDefinitions,objectResolver} from './revisions.ts';
import {referenceComponents,type Component,type Recipe} from './model.ts';

export type StructuralFilter={text?:string;tags?:string[];collection?:string;generator?:string;operator?:string;countMin?:number;countMax?:number;motion?:boolean;boundary?:boolean;filled?:boolean;parameter?:{property:string;min:number;max:number}};
export type LibraryItem={entityId:string;tags:string[];collections:string[];preset:boolean;derivedFrom?:string};
export type Collection={id:string;name:string;parentId:string|null};
export type Family={id:string;name:string;filter:StructuralFilter};
export type WorkspaceAtlas={id:string;name:string;document:Omit<Document,'entities'>};
export type OmnicWorkspace={format:'omnium-workspace';version:1;id:string;name:string;revision:number;entities:Entity[];atlases:WorkspaceAtlas[];activeAtlasId:string;library:{items:LibraryItem[];collections:Collection[];families:Family[]}};
export const WORKSPACE_KEY='omnium.workspace.v1';
export const WORKSPACE_BYTES=8_000_000;
export const WORKSPACE_LIMITS={atlases:32,collections:128,families:128,tagsPerObject:32} as const;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200;
const name=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=100;
const unique=(values:string[])=>new Set(values).size===values.length;
const fail=(message:string):never=>{throw Error(message);};
const withoutEntities=(doc:Document):Omit<Document,'entities'>=>{const {entities:_,...atlas}=doc;return atlas;};
const serializedSizes=new WeakMap<object,number>(),encoder=new TextEncoder();
/** State owners commit immutable data. Cache unchanged subtrees so size guards
 * visit changed paths instead of serializing every archived recipe on each edit.
 * JSON imports and the server also check their actual UTF-8 input length. */
export function assertWorkspaceBudget(workspace:OmnicWorkspace):void {
  const active=new Set<object>();
  const bytes=(value:unknown):number=>{
    if(value===null)return 4;
    if(typeof value!=='object'){const json=JSON.stringify(value);return json===undefined?4:encoder.encode(json).length;}
    const cached=serializedSizes.get(value);if(cached!==undefined)return cached;
    if(active.has(value))return fail('Workspace contains a circular data value.');active.add(value);
    let size=2,count=0;
    const add=(amount:number)=>{size+=amount+(count++?1:0);if(size>WORKSPACE_BYTES)fail('Workspace exceeds 8 MB. Prune unpinned history or reduce the workspace before saving this edit.');};
    if(Array.isArray(value)){for(const item of value)add(bytes(item));}
    else for(const [key,item] of Object.entries(value))if(item!==undefined)add(encoder.encode(JSON.stringify(key)).length+1+bytes(item));
    active.delete(value);serializedSizes.set(value,size);return size;
  };
  if(bytes(workspace)>WORKSPACE_BYTES)fail('Workspace exceeds 8 MB. Prune unpinned history before saving this edit.');
}
const materialized=new WeakMap<WorkspaceAtlas,WeakMap<Entity[],Document>>();
/** Atlas projections borrow the workspace's one canonical entity array. */
export function activeDocument(workspace:OmnicWorkspace):Document {
  const atlas=workspace.atlases.find(atlas=>atlas.id===workspace.activeAtlasId)??fail('Active atlas is missing.');
  let cache=materialized.get(atlas);if(!cache){cache=new WeakMap();materialized.set(atlas,cache);}
  let doc=cache.get(workspace.entities);if(!doc){doc={...atlas.document,entities:workspace.entities};cache.set(workspace.entities,doc);}return doc;
}
export function createWorkspace(doc:Document=emptyDocument(),workspaceId:string=crypto.randomUUID(),atlasId:string=crypto.randomUUID()):OmnicWorkspace {
  const workspace:OmnicWorkspace={format:'omnium-workspace',version:1,id:workspaceId,name:'My workspace',revision:0,entities:archiveDefinitions(validateDocument(doc).entities),atlases:[{id:atlasId,name:'Atlas',document:withoutEntities(doc)}],activeAtlasId:atlasId,library:{items:[],collections:[],families:[]}};assertWorkspaceBudget(workspace);return workspace;
}
export function validateFilter(input:unknown):StructuralFilter {
  if(!record(input)||Object.keys(input).some(key=>!['text','tags','collection','generator','operator','countMin','countMax','motion','boundary','filled','parameter'].includes(key)))return fail('Invalid structural filter.');
  for(const key of ['text','collection','generator','operator'] as const)if(input[key]!==undefined&&(typeof input[key]!=='string'||(input[key] as string).length>200))fail('Invalid filter text.');
  for(const key of ['motion','boundary','filled'] as const)if(input[key]!==undefined&&typeof input[key]!=='boolean')fail('Invalid filter state.');
  for(const key of ['countMin','countMax'] as const)if(input[key]!==undefined&&(!Number.isSafeInteger(input[key])||Number(input[key])<0||Number(input[key])>1024))fail('Count filter must be within 0–1024.');
  if(input.countMin!==undefined&&input.countMax!==undefined&&Number(input.countMin)>Number(input.countMax))fail('Minimum count exceeds maximum.');
  if(input.tags!==undefined&&(!Array.isArray(input.tags)||input.tags.length>32||input.tags.some(tag=>!name(tag))))fail('Invalid filter tags.');
  if(input.parameter!==undefined){const p=input.parameter;if(!record(p)||!id(p.property)||typeof p.min!=='number'||!Number.isFinite(p.min)||typeof p.max!=='number'||!Number.isFinite(p.max)||p.min>p.max)fail('Invalid parameter filter.');}
  return input as StructuralFilter;
}
export function validateWorkspace(input:unknown):OmnicWorkspace {
  if(!record(input)||input.format!=='omnium-workspace'||input.version!==1||!id(input.id)||!name(input.name)||!Number.isSafeInteger(input.revision)||Number(input.revision)<0||!Array.isArray(input.entities)||!Array.isArray(input.atlases)||input.atlases.length<1||input.atlases.length>WORKSPACE_LIMITS.atlases||!record(input.library))return fail('Invalid workspace header.');
  const value=input as OmnicWorkspace;
  if(!unique(value.atlases.map(atlas=>atlas.id))||!value.atlases.some(atlas=>atlas.id===value.activeAtlasId))fail('Invalid atlas identities.');
  for(const atlas of value.atlases){if(!id(atlas.id)||!name(atlas.name)||!record(atlas.document)||'entities' in atlas.document)fail('Invalid workspace atlas.');validateDocument({...atlas.document,entities:value.entities});}
  const library=value.library;
  if(!Array.isArray(library.items)||library.items.length>10000||!Array.isArray(library.collections)||library.collections.length>128||!Array.isArray(library.families)||library.families.length>128)fail('Library organization budget exceeded.');
  if(!unique(library.items.map(item=>item.entityId))||!unique(library.collections.map(c=>c.id))||!unique(library.families.map(f=>f.id)))fail('Duplicate library identity.');
  const entities=new Set(value.entities.map(e=>e.id)),collections=new Map(library.collections.map(c=>[c.id,c]));
  for(const c of library.collections){
    if(!id(c.id)||!name(c.name)||!(c.parentId===null||id(c.parentId)&&collections.has(c.parentId)))fail('Invalid collection.');
    const seen=new Set([c.id]);let cursor=c.parentId;while(cursor){if(seen.has(cursor))fail('Collection cycle.');seen.add(cursor);cursor=collections.get(cursor)?.parentId??null;}
  }
  for(const item of library.items){
    if(!entities.has(item.entityId)||typeof item.preset!=='boolean'||!Array.isArray(item.tags)||item.tags.length>32||item.tags.some(tag=>!name(tag))||!unique(item.tags)||!Array.isArray(item.collections)||item.collections.length>128||item.collections.some(c=>!collections.has(c))||!unique(item.collections)||item.derivedFrom!==undefined&&!id(item.derivedFrom))fail('Invalid library organization.');
  }
  for(const family of library.families){if(!id(family.id)||!name(family.name))fail('Invalid family.');validateFilter(family.filter);}
  assertWorkspaceBudget(value);return value;
}
export function parseWorkspace(text:string):OmnicWorkspace {
  if(new TextEncoder().encode(text).length>WORKSPACE_BYTES)fail('Workspace exceeds the 8 MB limit.');return validateWorkspace(JSON.parse(text));
}
export function withActiveDocument(workspace:OmnicWorkspace,doc:Document):OmnicWorkspace {
  // Removing an object still used by another atlas is rejected, never silently
  // redirected or resurrected. All ordinary graph editing retains its contract.
  const entities=doc.entities,ids=new Set(entities.map(e=>e.id));
  const next={...workspace,entities,revision:workspace.revision+1,atlases:workspace.atlases.map(atlas=>atlas.id===workspace.activeAtlasId?{...atlas,document:{...withoutEntities(doc),revision:Math.max(doc.revision,atlas.document.revision+1)}}:entities!==workspace.entities?{...atlas,document:{...atlas.document,revision:atlas.document.revision+1}}:atlas),library:{...workspace.library,items:workspace.library.items.filter(item=>ids.has(item.entityId))}};
  if(entities!==workspace.entities)for(const atlas of next.atlases)if(atlas.id!==next.activeAtlasId)validateDocument({...atlas.document,entities});
  assertWorkspaceBudget(next);return next;
}
export function addWorkspaceAtlas(workspace:OmnicWorkspace,nameValue:string,atlasId:string=crypto.randomUUID()):OmnicWorkspace {
  if(!name(nameValue)||workspace.atlases.length>=32)fail('Choose a name; at most 32 atlases per workspace.');
  return {...workspace,revision:workspace.revision+1,activeAtlasId:atlasId,atlases:[...workspace.atlases,{id:atlasId,name:nameValue.trim(),document:withoutEntities(emptyDocument())}]};
}
/** Import creates independent canonical identities. Equal legacy IDs or pixels
 * never establish equivalence with objects already in this workspace. */
export function importWorkspaceAtlas(workspace:OmnicWorkspace,source:Document,label='Imported atlas',newId:()=>string=()=>crypto.randomUUID()):OmnicWorkspace {
  validateDocument(source);const ids=new Map(source.entities.map(e=>[e.id,newId()]));
  const entity=(id:string)=>ids.get(id)??id;
  const resolve=objectResolver(source.entities);
  const address=(r:Recipe,value:string,depth=0):string=>{
    if(depth>12)return value;
    for(const c of referenceComponents(r)){
      const prefix=`${c.id}:ref:${c.reference}/`;
      if(value.startsWith(prefix)){const tail=value.slice(prefix.length),nested=resolve(c.reference!,c.referenceRevision);return `${c.id}:ref:${entity(c.reference!)}/${nested?address(nested,tail,depth+1):tail}`;}
    }return value;
  };
  const recipe=(r:Recipe):Recipe=>{
    const component=(c:Component):Component=>({...c,...(c.reference?{reference:entity(c.reference)}:{}),...(c.children?{children:c.children.map(component)}:{})});
    return {...r,components:r.components.map(component),operations:r.operations.map(op=>({...op,targets:op.targets.map(target=>address(r,target))})),frames:r.frames.map(frame=>({...frame,scope:frame.scope.map(target=>address(r,target))}))};
  };
  const scope=(s:Document['frames'][number]['scope'])=>({...s,anchorIds:s.anchorIds.map(entity),entityIds:s.entityIds.map(entity),excludedEntityIds:s.excludedEntityIds.map(entity)});
  const entities=source.entities.map(e=>({...e,id:entity(e.id),...(e.omnic?{omnic:recipe(e.omnic)}:{}),...(e.omnicHistory?{omnicHistory:e.omnicHistory.map(recipe)}:{})}));
  const doc:Document={...source,entities:[...workspace.entities,...entities],placements:source.placements.map(p=>({...p,entityId:entity(p.entityId)})),compositions:source.compositions.map(c=>({...c,parentId:entity(c.parentId),childId:entity(c.childId)})),relationships:source.relationships.map(r=>({...r,participants:r.participants.map(p=>({...p,entityId:entity(p.entityId)})),qualifierIds:r.qualifierIds.map(entity)})),variants:source.variants?.map(v=>({...v,ownerId:entity(v.ownerId),entityId:entity(v.entityId)})),frames:source.frames.map(f=>({...f,scope:scope(f.scope),history:f.history.map(h=>({...h,scope:scope(h.scope)}))}))};
  const next=addWorkspaceAtlas(workspace,label,newId());return validateWorkspace(withActiveDocument(next,validateDocument(doc)));
}
export function organizeObject(workspace:OmnicWorkspace,entityId:string,patch:Partial<Omit<LibraryItem,'entityId'>>):OmnicWorkspace {
  const current=workspace.library.items.find(item=>item.entityId===entityId)??{entityId,tags:[],collections:[],preset:false};
  const item={...current,...patch,entityId};
  const next={...workspace,revision:workspace.revision+1,library:{...workspace.library,items:[...workspace.library.items.filter(item=>item.entityId!==entityId),item]}};
  return validateWorkspace(next);
}
export function collectionScope(collections:readonly Collection[],root:string):Set<string>{
  const included=new Set([root]);for(let pass=0;pass<collections.length;pass++){let added=false;for(const c of collections)if(c.parentId&&included.has(c.parentId)&&!included.has(c.id)){included.add(c.id);added=true;}if(!added)break;}return included;
}
/** Shared undo stores workspace state, so undo remains safe across atlas switches.
 * Navigation and monotone local counters are excluded from conflict patches. */
export function workspaceHistory(workspace:OmnicWorkspace){return {...workspace,revision:0,activeAtlasId:'',atlases:workspace.atlases.map(a=>({...a,document:{...a.document,revision:0}}))};}
export function advanceWorkspaceRevisions(current:OmnicWorkspace,next:OmnicWorkspace):OmnicWorkspace {
  const previous=new Map(current.atlases.map(a=>[a.id,a]));
  return {...next,revision:Math.max(current.revision,next.revision)+1,atlases:next.atlases.map(a=>{
    const before=previous.get(a.id);if(!before||a.document===before.document&&next.entities===current.entities)return a;
    return {...a,document:{...a.document,revision:Math.max(a.document.revision,before.document.revision+1)}};
  })};
}
export function restoreWorkspaceHistory(current:OmnicWorkspace,value:OmnicWorkspace):OmnicWorkspace {
  return validateWorkspace({...advanceWorkspaceRevisions(current,value),activeAtlasId:value.atlases.some(a=>a.id===current.activeAtlasId)?current.activeAtlasId:value.atlases[0].id});
}
