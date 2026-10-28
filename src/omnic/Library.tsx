import { atomnicViewBounds } from './atomnicSettings.ts';
import {useEffect,useMemo,useRef,useState} from 'react';
import {UISection} from '../ui/UISection';
import {UIField} from '../ui/UIField';
import {UIAction} from '../ui/UIAction';
import {RangeControl} from '../ui/RangeControl';
import {FunctionControl} from '../ui/UIWorkspace';
import {useFeatureActions} from '../ui/useFeatureActions';
import {GENERATORS,OPERATORS} from './registry';
import {workspaceLibraryIndex,matchesLibrary,type IndexEntry} from './libraryIndex';
import {objectResolver,pruneObjectHistory} from './revisions';
import {saveOmnicDefinition} from './document';
import {evaluateRecipe} from './evaluate';
import {renderSVG} from './svg';
import {WorkspaceCloud} from './WorkspaceCloud';
import {activeDocument,addWorkspaceAtlas,organizeObject,parseWorkspace,validateFilter,withActiveDocument,collectionScope,WORKSPACE_BYTES,type OmnicWorkspace,type StructuralFilter} from './workspace';
import {referenceComponents,type Recipe} from './model';
import {readWorkspaceSlot,saveWorkspaceSlot} from './workspaceStorage';
import './composer.css';

type Props={workspace:OmnicWorkspace;onChange:(next:OmnicWorkspace)=>void;onSwitch:(id:string)=>void;onOpen:(id:string)=>void;onPlace:(id:string)=>void;onCopy:(recipe:Recipe,label:string,source:string)=>void};
const PAGE=32;
const tags=(text:string)=>[...new Set(text.split(',').map(tag=>tag.trim()).filter(Boolean))];
export function OmnicLibrary({workspace,onChange,onSwitch,onOpen,onPlace,onCopy}:Props){
  const [filter,setFilter]=useState<StructuralFilter>({}),[selectedId,setSelectedId]=useState(''),[page,setPage]=useState(0);
  const [newName,setNewName]=useState(''),[parentCollection,setParentCollection]=useState('');
  const [draftLabel,setDraftLabel]=useState(''),[draftTags,setDraftTags]=useState(''),[revision,setRevision]=useState<number|null>(null);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const [indexed,setIndexed]=useState<Map<string,IndexEntry>>(()=>new Map());
  const numericParameters=useMemo(()=>[...new Map([...GENERATORS,...OPERATORS].flatMap(d=>d.parameters).filter(p=>p.kind==='number').map(p=>[p.property,p])).values()],[]);
  const index=useMemo(()=>workspaceLibraryIndex(workspace.id),[workspace.id]),input=useRef<HTMLInputElement>(null),currentWorkspace=useRef(workspace);currentWorkspace.current=workspace;
  const objects=useMemo(()=>workspace.entities.filter(entity=>!!entity.omnic),[workspace.entities]);
  const resolver=useMemo(()=>objectResolver(workspace.entities),[workspace.entities]);
  // Yield between bounded evaluations. Rows never mount SVG previews; only the
  // inspected revision renders one. Indexing stops when this window unmounts.
  useEffect(()=>{
    let cancelled=false,timer:ReturnType<typeof setTimeout>,position=0,published=0;
    const next=new Map<string,IndexEntry>();
    index.prune(new Set(objects.map(e=>e.id)));setIndexed(new Map());
    const work=()=>{const start=performance.now();do{const object=objects[position++];if(!object)break;next.set(object.id,index.update(object,workspace.entities,resolver));}while(position<objects.length&&performance.now()-start<4);
      if(cancelled)return;if(position>=objects.length||performance.now()-published>=50){setIndexed(new Map(next));published=performance.now();}if(position<objects.length)timer=setTimeout(work,0);
    };timer=setTimeout(work,0);return()=>{cancelled=true;clearTimeout(timer);};
  },[objects,workspace.entities,resolver,index]);
  const metadata=useMemo(()=>new Map(workspace.library.items.map(item=>[item.entityId,item])),[workspace.library.items]);
  const collections=useMemo(()=>filter.collection?collectionScope(workspace.library.collections,filter.collection):undefined,[workspace.library.collections,filter.collection]);
  const results=useMemo(()=>objects.filter(entity=>matchesLibrary(entity,metadata.get(entity.id),indexed.get(entity.id),filter,collections)),[objects,metadata,indexed,filter,collections]);
  const selected=objects.find(e=>e.id===selectedId),item=selected?metadata.get(selected.id):undefined;
  const dependents=useMemo(()=>objects.filter(e=>e.omnic&&referenceComponents(e.omnic).some(c=>c.reference===selectedId)).length,[objects,selectedId]);
  useEffect(()=>{setDraftLabel(selected?.label??'');setDraftTags(item?.tags.join(', ')??'');setRevision(null);},[selectedId,selected?.label,item?.tags]);
  useEffect(()=>{setPage(0);},[filter]);
  const preview=useMemo(()=>{
    if(!selected||revision===null)return '';
    const recipe=selected.omnicHistory?.find(r=>r.revision===revision);if(!recipe)return '';
    try{return renderSVG(evaluateRecipe(recipe,resolver),{bounds:atomnicViewBounds(recipe.atomnic)});}catch{return '';}
  },[selected,revision,resolver]);
  const attempt=(run:()=>void)=>{try{run();setError('');}catch(error){setError(error instanceof Error?error.message:String(error));}};
  const set=(patch:Partial<StructuralFilter>)=>setFilter(previous=>{const next={...previous,...patch};for(const key of Object.keys(next))if(next[key as keyof StructuralFilter]===undefined||next[key as keyof StructuralFilter]==='')delete next[key as keyof StructuralFilter];return next;});
  const download=()=>{const data=JSON.stringify(workspace);if(new TextEncoder().encode(data).length>WORKSPACE_BYTES)throw Error('Workspace exceeds the export budget.');const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='omnium-workspace.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  useFeatureActions('omnicLibrary',{
    'omnic.library.open':{enabled:!!selected,run:()=>selected&&onOpen(selected.id)},
    'omnic.library.place':{enabled:!!selected,run:()=>attempt(()=>selected&&onPlace(selected.id))},
    'omnic.library.copy':{enabled:!!selected,run:()=>attempt(()=>selected&&onCopy(selected.omnic!,`${selected.label} copy`,selected.id))},
    'omnic.workspace.export':{enabled:true,run:()=>attempt(download)},
    'omnic.workspace.import':{enabled:true,run:()=>input.current?.click()},
    'omnic.workspace.recover':{enabled:true,run:()=>void (async()=>{try{const backup=await readWorkspaceSlot('before-replace');if(!backup)throw Error('No local replacement backup exists.');if(currentWorkspace.current!==workspace)throw Error('Local work changed. Retry recovery after editing.');onChange(backup);setNotice('Local replacement backup restored.');setError('');}catch(error){setError(error instanceof Error?error.message:String(error));}})()},
  });
  const collectionName=(id:string)=>workspace.library.collections.find(c=>c.id===id)?.name??id;
  return <div className="omnic-composer omnic-library">
    <UISection id="omnic-library-workspace" title={workspace.name}>
      <div className="omnic-row"><UIField id="omnic:active-atlas" label="Active atlas" category="Omnic"><select aria-label="Active atlas" value={workspace.activeAtlasId} onChange={event=>onSwitch(event.target.value)}>{workspace.atlases.map(atlas=><option key={atlas.id} value={atlas.id}>{atlas.name}</option>)}</select></UIField>
        <FunctionControl id="omnic.workspace.export"/><FunctionControl id="omnic.workspace.import"/><FunctionControl id="omnic.workspace.recover"/>
      </div>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;void (async()=>{try{if(file.size>WORKSPACE_BYTES)throw Error('Workspace exceeds 8 MB.');const next=parseWorkspace(await file.text());await saveWorkspaceSlot(workspace,'before-replace');if(currentWorkspace.current!==workspace)throw Error('Local work changed during import. Retry after editing.');onChange(next);setSelectedId('');setNotice('Workspace imported. Undo restores the previous workspace.');setError('');}catch(error){setError(error instanceof Error?error.message:String(error));}})();}}/>
    </UISection>
    <UISection id="omnic-library-browse" title={`Objects · ${results.length}`}>
      <div className="omnic-row">
        <UIField id="omnic:library-search" label="Search library" category="Omnic"><input aria-label="Search library" placeholder="Name or tag…" maxLength={200} value={filter.text??''} onChange={e=>set({text:e.target.value})}/></UIField>
        <select aria-label="Collection filter" value={filter.collection??''} onChange={e=>set({collection:e.target.value||undefined})}><option value="">All collections</option>{workspace.library.collections.map(c=><option value={c.id} key={c.id}>{c.parentId?`${collectionName(c.parentId)} / `:''}{c.name}</option>)}</select>
        <select aria-label="Saved family" value="" onChange={e=>{const family=workspace.library.families.find(f=>f.id===e.target.value);if(family)setFilter({...family.filter});}}><option value="">Families…</option>{workspace.library.families.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select>
      </div>
      <UISection id="omnic-library-filters" title="Structural filters" defaultExpanded={false}>
        <div className="omnic-row"><select aria-label="Generator filter" value={filter.generator??''} onChange={e=>set({generator:e.target.value||undefined})}><option value="">Any generator</option>{GENERATORS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select>
          <select aria-label="Operator filter" value={filter.operator??''} onChange={e=>set({operator:e.target.value||undefined})}><option value="">Any operator</option>{OPERATORS.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}</select>
          {(['motion','boundary','filled'] as const).map(key=><select key={key} aria-label={`${key} filter`} value={filter[key]===undefined?'':String(filter[key])} onChange={e=>set({[key]:e.target.value===''?undefined:e.target.value==='true'})}><option value="">{key}: any</option><option value="true">{key}: yes</option><option value="false">{key}: no</option></select>)}
        </div>
        <div className="omnic-row">{(['countMin','countMax'] as const).map((key,i)=><UIField key={key} id={`omnic:filter-${key}`} label={i?'Maximum units':'Minimum units'} category="Omnic"><label><input type="checkbox" checked={filter[key]!==undefined} onChange={e=>set({[key]:e.target.checked?(i?1024:0):undefined})}/>{i?'Max units':'Min units'}{filter[key]!==undefined&&<RangeControl aria-label={i?'Maximum units':'Minimum units'} min={0} max={1024} step={1} value={filter[key]!} onValueChange={value=>set({[key]:value})}/>}</label></UIField>)}</div>
        <UIField id="omnic:filter-tags" label="Required tags" category="Omnic"><input key={filter.tags?.join(',')} aria-label="Required tags" placeholder="Required tags, comma separated" maxLength={1000} defaultValue={filter.tags?.join(', ')??''} onBlur={e=>set({tags:tags(e.target.value)})}/></UIField>
        <div className="omnic-row"><select aria-label="Declared numeric parameter filter" value={filter.parameter?.property??''} onChange={e=>{const p=numericParameters.find(p=>p.property===e.target.value);set({parameter:p?{property:p.property,min:p.min!,max:p.max!}:undefined});}}><option value="">Declared parameters: any</option>{numericParameters.map(p=><option key={p.property} value={p.property}>{p.label}</option>)}</select>
          {filter.parameter&&(['min','max'] as const).map(key=>{const parameter=numericParameters.find(p=>p.property===filter.parameter?.property);return parameter&&<UIField key={key} id={`omnic:filter-parameter-${key}`} label={`Parameter ${key}`} category="Omnic"><label>{key}<RangeControl aria-label={`Parameter ${key}`} min={parameter.min!} max={parameter.max!} step={parameter.step} value={filter.parameter![key]} onValueChange={value=>set({parameter:{...filter.parameter!,[key]:value}})}/></label></UIField>;})}
        </div>
        <UIAction id="omnic:clear-filters" label="Clear filters" category="Omnic" onClick={()=>setFilter({})}/>
      </UISection>
      <div className="omnic-library-results" role="list" aria-label="Library objects">{results.slice(page*PAGE,(page+1)*PAGE).map(entity=>{const entry=indexed.get(entity.id);return <button type="button" role="listitem" key={entity.id} aria-pressed={selectedId===entity.id} onClick={()=>setSelectedId(entity.id)}><span>{entity.label||entity.id}</span><small>{entry?.facts?`${entry.facts.count} units${entry.facts.motion?' · motion':''}`:entry?.error?'Check definition':'Indexing…'}{metadata.get(entity.id)?.preset?' · preset':''}</small></button>;})}</div>
      <div className="omnic-row"><button type="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button><small>{Math.min(results.length,page*PAGE+1)}–{Math.min(results.length,(page+1)*PAGE)} / {results.length} · indexed {indexed.size}/{objects.length}</small><button type="button" disabled={(page+1)*PAGE>=results.length} onClick={()=>setPage(p=>p+1)}>Next</button></div>
    </UISection>
    {selected&&<UISection id="omnic-library-object" title={selected.label||'Object'}>
      <div className="omnic-row"><FunctionControl id="omnic.library.open"/><FunctionControl id="omnic.library.place"/><FunctionControl id="omnic.library.copy"/></div>
      <div className="omnic-row"><UIField id="omnic:library-name" label="Object name" category="Omnic"><input aria-label="Object name" maxLength={500} value={draftLabel} onChange={e=>setDraftLabel(e.target.value)}/></UIField><UIField id="omnic:library-tags" label="Object tags" category="Omnic"><input aria-label="Object tags" maxLength={3200} placeholder="Tags, separated by commas" value={draftTags} onChange={e=>setDraftTags(e.target.value)}/></UIField><UIAction id="omnic:update-object" label="Save name / tags" category="Omnic" onClick={()=>attempt(()=>onChange(organizeObject({...workspace,entities:workspace.entities.map(e=>e.id===selected.id?{...e,label:draftLabel}:e)},selected.id,{tags:tags(draftTags)})))}/></div>
      <div className="omnic-row"><label><input type="checkbox" checked={item?.preset??false} onChange={e=>attempt(()=>onChange(organizeObject(workspace,selected.id,{preset:e.target.checked})))}/>Reusable preset</label>{workspace.library.collections.map(c=><label key={c.id}><input type="checkbox" checked={item?.collections.includes(c.id)??false} onChange={e=>attempt(()=>onChange(organizeObject(workspace,selected.id,{collections:e.target.checked?[...(item?.collections??[]),c.id]:(item?.collections??[]).filter(id=>id!==c.id)})))}/>{c.name}</label>)}</div>
      <small>Used in {workspace.atlases.filter(a=>a.document.placements.some(p=>p.entityId===selected.id)).length} atlases · {dependents} dependent objects</small>
      {item?.derivedFrom&&<button type="button" onClick={()=>setSelectedId(item.derivedFrom!)}>Copied from {workspace.entities.find(e=>e.id===item.derivedFrom)?.label||item.derivedFrom}</button>}
      <UISection id="omnic-library-dependencies" title="Dependencies / revisions" defaultExpanded={false}>
        {(indexed.get(selected.id)?.facts?.dependencies??[]).map((dep,i)=><button type="button" key={`${dep.id}:${i}`} onClick={()=>setSelectedId(dep.id)}>{workspace.entities.find(e=>e.id===dep.id)?.label||dep.id} · {dep.revision===undefined?'live':`revision ${dep.revision}`}</button>)}
        <div className="omnic-row"><select aria-label="Saved object revision" value={revision??''} onChange={e=>setRevision(e.target.value===''?null:Number(e.target.value))}><option value="">Current · r{selected.omnic?.revision}</option>{[...(selected.omnicHistory??[])].reverse().map(r=><option key={r.revision} value={r.revision}>Saved r{r.revision} · frozen dependencies</option>)}</select>
          <UIAction id="omnic:restore-revision" label="Restore as new revision" category="Omnic" disabled={revision===null} onClick={()=>attempt(()=>{const r=selected.omnicHistory?.find(r=>r.revision===revision);if(r)onChange(withActiveDocument(workspace,saveOmnicDefinition(activeDocument(workspace),selected.id,r)));})}/></div>
        <UIAction id="omnic:prune-revisions" label="Prune unpinned history" category="Omnic" onClick={()=>attempt(()=>{onChange({...workspace,entities:pruneObjectHistory(workspace.entities,selected.id)});setRevision(null);setNotice('Kept current and pinned revisions. Undo restores the pruned archive.');})}/>
        {preview&&<div className="omnic-revision-preview" dangerouslySetInnerHTML={{__html:preview}}/>}
        {indexed.get(selected.id)?.error&&<small role="alert">{indexed.get(selected.id)?.error}</small>}
        {(indexed.get(selected.id)?.facts?.diagnostics??[]).map((message,i)=><small key={i}>{message}</small>)}
      </UISection>
    </UISection>}
    <UISection id="omnic-library-organize" title="Organization" defaultExpanded={false}>
      <div className="omnic-row"><UIField id="omnic:organization-name" label="Organization name" category="Omnic"><input aria-label="Organization name" placeholder="Name…" maxLength={100} value={newName} onChange={e=>setNewName(e.target.value)}/></UIField>
        <UIAction id="omnic:rename-workspace" label="Rename workspace" category="Omnic" disabled={!newName.trim()} onClick={()=>attempt(()=>onChange({...workspace,name:newName.trim()}))}/>
        <UIAction id="omnic:rename-atlas" label="Rename active atlas" category="Omnic" disabled={!newName.trim()} onClick={()=>attempt(()=>onChange({...workspace,atlases:workspace.atlases.map(a=>a.id===workspace.activeAtlasId?{...a,name:newName.trim()}:a)}))}/>
        <UIAction id="omnic:new-atlas" label="New atlas" category="Omnic" disabled={!newName.trim()} onClick={()=>attempt(()=>onChange(addWorkspaceAtlas(workspace,newName)))}/>
        <select aria-label="Parent collection" value={parentCollection} onChange={e=>setParentCollection(e.target.value)}><option value="">Top level</option>{workspace.library.collections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <UIAction id="omnic:new-collection" label="New collection" category="Omnic" disabled={!newName.trim()} onClick={()=>attempt(()=>onChange({...workspace,library:{...workspace.library,collections:[...workspace.library.collections,{id:crypto.randomUUID(),name:newName.trim(),parentId:parentCollection||null}]}}))}/>
        <UIAction id="omnic:rename-collection" label="Rename collection" category="Omnic" disabled={!newName.trim()||!parentCollection} onClick={()=>attempt(()=>onChange({...workspace,library:{...workspace.library,collections:workspace.library.collections.map(c=>c.id===parentCollection?{...c,name:newName.trim()}:c)}}))}/>
        <UIAction id="omnic:remove-collection" label="Remove collection" category="Omnic" disabled={!parentCollection} onClick={()=>attempt(()=>{const removed=workspace.library.collections.find(c=>c.id===parentCollection);onChange({...workspace,library:{...workspace.library,collections:workspace.library.collections.filter(c=>c!==removed).map(c=>c.parentId===parentCollection?{...c,parentId:removed?.parentId??null}:c),items:workspace.library.items.map(item=>({...item,collections:item.collections.filter(id=>id!==parentCollection)}))}});setParentCollection('');})}/>
        <UIAction id="omnic:save-family" label="Save filter as family" category="Omnic" disabled={!newName.trim()} onClick={()=>attempt(()=>onChange({...workspace,library:{...workspace.library,families:[...workspace.library.families,{id:crypto.randomUUID(),name:newName.trim(),filter:validateFilter(filter)}]}}))}/>
      </div>
      <small>Families are live structural queries; tags are authored annotations.</small>
      {workspace.library.families.map(f=><div className="omnic-row" key={f.id}><button type="button" onClick={()=>setFilter({...f.filter})}>{f.name}</button><UIAction id={`omnic:remove-family:${f.id}`} label={`Remove family ${f.name}`} symbol="×" category="Omnic" onClick={()=>attempt(()=>onChange({...workspace,library:{...workspace.library,families:workspace.library.families.filter(item=>item.id!==f.id)}}))}/></div>)}
    </UISection>
    <WorkspaceCloud workspace={workspace} onChange={onChange}/>
    {notice&&<small role="status">{notice}</small>}{error&&<small role="alert">{error}</small>}
  </div>;
}
