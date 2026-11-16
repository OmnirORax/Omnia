import {applyGroupTargets} from './core/groupPlacement';
import {installContextActions,registerContextActions,refreshContextActions} from './ui/contextActions';
import {aimFrame,activeWorldAxes,createAxis,toggleWorldAxis,shiftAxisOrigin,setSpatialOrigin,slotNode} from './core/axes.ts';
import {parseBrush,brushShape,SINGLE_BRUSH,type Brush} from './core/brush.ts';
import {handleContentViewShortcut} from './ui/contentViewShortcut.ts';
import {ANIMATION_TARGETS,animationProperties} from './properties/animations.ts';
import {animationValue} from './world/animations.ts';
import {createImmersiveMode,handleImmersiveShortcut,type KeyboardLock} from './ui/immersiveMode.ts';
import {createSettingsCatalog} from './ui/settingsCatalog.ts';
import {installBrowserShortcutGuard,browserShortcutsEnabled,enableBrowserShortcuts} from './ui/browserShortcuts.ts';
import {viewHistory,type ViewSpec} from './ui/viewHistory.ts';
import {loadEditorModule} from './ui/moduleLoader.ts';
import {sameValue} from './core/equality.ts';
import {updateNativeLayout} from './composer/runtime/historyBridge.ts';
import {windowDrag} from './ui/windowDrag';
import {CAMERA_ACTIONS} from './world/cameraHUD.ts';
import {NODE_VISUAL_PROPERTIES} from './properties/nodeVisuals.ts';
import {searchMatches,searchIndex} from './ui/search.ts';
import type {Property,Value} from './properties/pool.ts';
import {watchFields,requestFormSync} from './ui/formState.ts';
import {installCursorTracking,cursorPosition} from './composer/runtime/ui/cursorPosition.ts';
import {installValueDrag} from './ui/valueDrag.ts';
import {closeActiveWindow} from './ui/windowDismissal.ts';
import {uiPointerHeld} from './composer/runtime/ui/pointerOwnership.ts';
import {universalHistory,globalHistoryOptions,travelGlobalHistory} from './core/universalHistory.ts';
import {installHistoryBindings} from './ui/historyBindings.ts';
import { transformNodes } from './core/navigation.ts';
import {NAV_DEFAULTS,NAVIGATION_PROPERTIES,type NavigationOptions} from './navigation/options.ts';
import {visibleInAtlas} from './omnic/atlas.ts';
import type {composerPanel} from './omnic/editor.ts';
import type {libraryPanel} from './omnic/library.ts';
import {createDraftSync,type Marker} from './cloud/sync.ts';
import {createDraftClient} from './cloud/client.ts';
import {panel} from './ui/panel.ts';
import {readPaint,writePaint,resolveNodeSettings,type VisualTarget} from './core/appearance.ts';
import {visualProperties,type Paint} from './properties/visual.ts';
import vfxFunction from './scene/vfx.function.ts';
import {definitions as audioDefinitions} from './scene/audioControls.ts';
import {defaultScene} from './scene/state.ts';
import {NORMALIZATION_FIELDS,normalizationProperty,editNormalization} from './scene/normalization.ts';
import './style.css';
import { installPrimaryClickGate } from './ui/primaryClick.ts';
import { paintForm } from './ui/visualControls.ts';
import { updateUIAppearance } from './ui/appearance.ts';
import { bind, locate, resolve, sameOrigin, setInvariant, type Binding, type Origin, type Vec3, type World } from './core/model.ts';
import { capabilities, translate } from './core/capabilities.ts';
import { createSelection } from './core/selection.ts';
import { createStore } from './core/store.ts';
import { createWorld, type Edge } from './world.ts';
import { inherited } from './core/lattice.ts';
import { paintNodes, adoptNodes, connectNodes, childNode, detachNode, removeNodes, toggleSubtree, toggleChildLevel } from './core/nodeOperations.ts';
import type { editDocument } from './text/editor.ts';
import {scenePanel,SCENE_TABS,type SceneTab} from './scene/panel.ts';
import { validateAsset, MAX_ASSET_BYTES, type VisualAsset } from './graph/assets.ts';
import { workspacePanel } from './ui/workspace.ts';
import { field } from './ui/fields.ts';
import { liveForm,flushLiveForms } from './ui/liveForm.ts';

installPrimaryClickGate();
installBrowserShortcutGuard();
installValueDrag();
installCursorTracking();
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tools = element('tools'), status = element('status'), search = element<HTMLInputElement>('find');
type Target = Origin | Edge;
const isNode = (target: Target): target is Origin => 'born' in target;
const selection = createSelection<Target>((a, b) => isNode(a) && isNode(b) ? sameOrigin(a, b) : !isNode(a) && !isNode(b) && JSON.stringify(a) === JSON.stringify(b));
const selectedOrigins = () => selection.values.filter(isNode);
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const store = createStore(storage,universalHistory);
let disposeTools:(()=>void)|undefined;
let message = '', menuPoint = { x: 20, y: 60 }, shown: Set<string> | undefined;
let reloadForModule=false;
const statusText=document.createTextNode(''),reloadModuleButton=document.createElement('button');
reloadModuleButton.textContent='Reload';reloadModuleButton.type='button';reloadModuleButton.hidden=true;reloadModuleButton.style.marginLeft='5px';
reloadModuleButton.onclick=()=>{flushLiveForms();location.reload();};status.replaceChildren(statusText,reloadModuleButton);
const loadEditor=<T,>(load:()=>Promise<T>)=>loadEditorModule(load,()=>{reloadForModule=true;});
const key = (origin: Origin) => JSON.stringify(origin);
function feedback(text: string) { message = text; refresh(); }
function attempt(action: () => void) { try { universalHistory.transaction(action); } catch (error) { feedback(error instanceof Error ? error.message : String(error)); } }
function renderClose() { disposeTools?.();disposeTools=undefined;tools.hidden = true; view?.update(store.world, selectedOrigins(), shown, selection.values.filter((target): target is Edge => !isNode(target))); }
function close(){if(viewHistory.rendering){renderClose();return;}viewHistory.hideMenu();}
const menuFactories=new Map<string,(args:unknown[])=>void>();
function defineMenu<Args extends unknown[]>(kind:string,render:(...args:Args)=>void,atCursor=false){
 menuFactories.set(kind,args=>render(...args as Args));
 return(...args:Args)=>{if(viewHistory.rendering){render(...args);return;}if(atCursor)menuPoint={...cursorPosition()};viewHistory.menu({kind,args,point:{...menuPoint},selection:selection.values as Target[]});};
}
function pick(origin: Origin, extend = false, toggle = false) { universalHistory.activeContext=`node:${key(origin)}`;universalHistory.contextPath=['omnium',universalHistory.activeContext]; selection.pick(origin, extend, toggle); refresh(); }
function selectedNodes(world: World) { return world.nodes.filter(node => selection.has(node.origin)); }
const view = (() => {
  try {
    return createWorld(element('world'), {
      pick, picking: () => selection.requesting,
      range(origins, extend) { if (!selection.requesting) { selection.set(extend ? [...selectedOrigins(), ...origins] : origins); refresh(); } },
      clear() { if (selection.requesting) return; close(); selection.set([]); refresh(); },
      menu(origin, point, position, edge) { if (selection.requesting) return; message = ''; if(edge)selection.set([edge]);else if(origin)selection.set(selection.has(origin)?selectedOrigins():[origin]);else selection.set([]); menuPoint = point; refresh(); context(position,origin,edge); },
      navigationSettings:()=>openNavigation(),
      rotateCommit(nodes,frame){store.change(world=>{if(nodes.size){applyGroupTargets(world,new Map([...nodes].map(([id,n])=>[id,n.position])));for(const node of world.nodes){const next=nodes.get(key(node.origin));if(next)node.orientation={...next.orientation};}}if(frame){const found=world.axes?.find(f=>f.id===frame.id);if(!found&&frame.id==='@user'){const basis=view!.frameBasis();const created=setSpatialOrigin(world,undefined,frame.state.origin,basis.right,basis.up);Object.assign(created,frame.state,{directed:true});}else if(!found)throw Error('The frame was removed.');else Object.assign(found,frame.state,{directed:true});}});},
      transform(origins,rotation,pivot,layout){store.change(world=>transformNodes(world,origins,rotation,pivot,layout));},
      groupMove(targets){store.change(world=>applyGroupTargets(world,targets));},
      move(origins, delta) { store.change(world => translate(view!.operationWorld(world), origins, delta)); },
      connectDrag(source,target,position){let child:Origin|undefined;store.change(world=>{child=connectNodes(world,source,target,position);});if(child)selection.set([child]);refresh();},
      adopt(origins, owner, delta) { store.change(world => adoptNodes(view!.operationWorld(world), origins, owner, delta)); },
      park(origin, position) { message = ''; store.change(world => {const node=locate(world,origin)!;translate(view!.operationWorld(world),[origin],position.map((v,i)=>v-node.position[i]) as Vec3);}); return store.world; },
      paint(positions,source,axis){store.change(world=>paintNodes(world,positions,source,axis));},
      selectionOrigin(ids,position){assignOrigin(ids[0],position);},
      nodeOrigin(origin){assignOrigin(origin,locate(store.world,origin)!.position);},
      origin(id,position){const frame=store.world.axes?.find(frame=>frame.id===id)??view?.reference;if(frame)assignOrigin(frame.ends[0],position);},
      aimOrigin(){aimOrigin();},
      axis(first,second,up){store.change(world=>{createAxis(world,first,second,up);});selection.set([]);refresh();},
      slot(origins,axis,point){store.change(world=>slotNode(view!.operationWorld(world),origins[0],axis,point,origins));},
      toggleWorldAxis(id,axis){if(view?.toggleReferenceAxis(id,axis))return;store.change(world=>toggleWorldAxis(world,id,axis));},
      focusAxis(id){selection.set([]);store.change(world=>{world.activeAxis=id;});},
      connect(origin){connectNode(origin);},
      subtree(origin,nextOnly=false) { store.change(world => nextOnly?toggleChildLevel(world,origin):toggleSubtree(world, origin)); },
      edge(edge) { selection.set([edge]); refresh(); },
      feedback,
    });
  } catch { status.textContent = 'The 3D renderer could not start. WebGL is required; your saved world is preserved.'; return undefined; }
})();

function refresh() {
  refreshContextActions();
  requestFormSync();
  updateUIAppearance(store.world.appearance);
  for (const document of documents.values()) document?.refreshAppearance();
  const query = search.value.trim().toLocaleLowerCase();
  const atlas=visibleInAtlas(store.world);
  shown = query ? new Set(store.world.nodes.filter(node => node.label.toLocaleLowerCase().includes(query)).map(node => key(node.origin))) : atlas;
  if(atlas&&shown)shown=new Set([...shown].filter(id=>atlas.has(id)));
  selection.set(selection.values.filter(target => isNode(target) ? !!locate(store.world, target) : target.kind === 'part' ? !!locate(store.world, target.owner)?.parts[target.index] : target.kind === 'variant' ? !!locate(store.world,target.owner)?.variantOf : !!store.world.relationships?.[target.index]));
  view?.update(store.world, selectedOrigins(), shown, selection.values.filter((target): target is Edge => !isNode(target)));
  element('empty').hidden = store.world.nodes.length > 0;
  element<HTMLButtonElement>('undo').disabled = universalHistory.candidates('undo',globalHistoryOptions()).length===0;
  element<HTMLButtonElement>('redo').disabled = universalHistory.candidates('redo',globalHistoryOptions()).length===0;
  if (view){statusText.data=store.message||message;reloadModuleButton.hidden=!reloadForModule;}
}
store.subscribe(refresh);
universalHistory.subscribe(()=>{requestFormSync();element<HTMLButtonElement>('undo').disabled=universalHistory.candidates('undo',globalHistoryOptions()).length===0;element<HTMLButtonElement>('redo').disabled=universalHistory.candidates('redo',globalHistoryOptions()).length===0;});
function open(title: string) {
  disposeTools?.();disposeTools=undefined;tools.replaceChildren(); tools.hidden = false;
  const row = document.createElement('div'); row.className = 'title';
  const caption = document.createElement('span'); caption.textContent = title;
  const back = document.createElement('button'); back.textContent = '×'; back.setAttribute('aria-label', 'Close'); back.onclick = close;
  row.append(caption, back); tools.append(row);windowDrag(tools,row,()=>{menuPoint={x:parseFloat(tools.style.left)||0,y:parseFloat(tools.style.top)||0};});
  const find = document.createElement('input'); find.type = 'search';find.value=viewHistory.state.menu?.query??''; find.placeholder = 'Search…'; find.setAttribute('aria-label', 'Search operations');
  const globalResults=document.createElement('div');globalResults.className='settings-search-results';let renderGlobal:ReturnType<typeof searchRenderer>|undefined;
  const filter = () => {
    const query = find.value.trim().toLocaleLowerCase();viewHistory.query(find.value);
    for (const item of Array.from(tools.children)) if (item instanceof HTMLButtonElement) item.hidden = item.dataset.searchOnly === 'true' && !query || !!query && !`${item.textContent} ${item.dataset.keywords ?? ''}`.toLocaleLowerCase().includes(query);
    if(query){renderGlobal??=searchRenderer(globalResults);renderGlobal(query);}else globalResults.replaceChildren();
    positionMenu();
  };
  find.oninput = filter;
  find.onkeydown = event => { if (event.key === 'Enter') { const match = Array.from(tools.children).find(item => item instanceof HTMLButtonElement && !item.hidden) as HTMLButtonElement | undefined; if (match) { event.preventDefault(); match.click(); } } };
  tools.append(find,globalResults);
  requestAnimationFrame(() => { if (!find.isConnected) return; if (tools.querySelector('form')) find.hidden = true; else { filter(); find.focus(); } });
  positionMenu();
}
function positionMenu() {
  requestAnimationFrame(() => {
    tools.style.left = `${Math.max(8, Math.min(menuPoint.x, innerWidth - tools.offsetWidth - 8))}px`;
    tools.style.top = `${Math.max(8, Math.min(menuPoint.y, innerHeight - tools.offsetHeight - 8))}px`;
  });
}
function button(label: string, action: () => void, parent = tools) {
  const b = document.createElement('button'); b.textContent = label; b.onclick = () => attempt(action); parent.append(b); return b;
}
const editCapability=defineMenu('capability',(capabilityKey: string)=>{
  const origins = [...selectedOrigins()], first = locate(store.world, origins[0]); if (!first) return;
  const capability = capabilities(resolveNodeSettings(store.world,inherited(first, store.world))).find(item => item.key === capabilityKey); if (!capability) return;
  open(capability.label);
  const form = document.createElement('form'), inputs: HTMLInputElement[] = [];
  for (const binding of capability.properties) {
    const entry = field({ ...binding.property, label: `${capabilityKey === 'move' && origins.length > 1 ? 'Δ' : ''}${binding.property.label}` }, capabilityKey === 'move' && origins.length > 1 ? 0 : binding.read());
    const input = entry.input as HTMLInputElement;
    if (input.type === 'text') input.maxLength = 160;
    inputs.push(input); form.append(entry.row);
  }
  const start = [...first.position];
  const apply = (world: World) => {
    if (capabilityKey === 'move') {
      const before = locate(world, origins[0])!.position;
      translate(world, origins, inputs.map((input, axis) => Number(input.value) - (origins.length === 1 ? before[axis] : before[axis] - start[axis])) as Vec3);
    } else for (const origin of origins) {
      const node = locate(world, origin); if (!node) continue;
      const coupled = capabilities(node).find(item => item.key === capabilityKey)!;
      coupled.properties.forEach((binding, i) => binding.write(inputs[i].value));
      if (node.variantOf) node.overrides = [...new Set([...(node.overrides ?? []), ...coupled.properties.map(binding => binding.property.key)])];
    }
  };
  liveForm(form, group => attempt(() => store.change(apply, group)));
  watchFields(form,inputs.map((input,index)=>({input,read:()=>{const node=locate(store.world,origins[0]);if(!node)return undefined;if(capabilityKey==='move'&&origins.length>1)return node.position[index]-start[index];return capabilities(resolveNodeSettings(store.world,inherited(node,store.world))).find(c=>c.key===capabilityKey)?.properties[index].read();}})));
  tools.append(form); positionMenu(); inputs[0].focus(); if (inputs[0].type === 'text') inputs[0].select();
});
function reference(mode: Binding['mode']) {
  const owners = [...selectedOrigins()]; close();
  selection.request(target => {
    if (!isNode(target)) return false;
    try {
      store.change(world => {
        const node = locate(world, target); if (!node) throw new Error('Target is no longer available.');
        const binding = bind(node, mode, world);
        for (const origin of owners) {
          const owner = locate(world, origin); if (!owner) throw new Error('Composition is no longer available.');
          owner.parts.push(structuredClone(binding));
        }
      });
      message = ''; return true;
    } catch (error) { message = error instanceof Error ? error.message : String(error); return false; }
  });
  message = 'Choose a component · Esc cancels'; refresh();
}
function assignOrigin(anchor:Origin|undefined,position:Vec3){const basis=view!.frameBasis(),axes=[...activeWorldAxes(view!.reference)];store.change(world=>{const frame=setSpatialOrigin(world,anchor,position,basis.right,basis.up);frame.activeAxes=axes;});}
function focusSelection(){view?.positionUser();}
function relationFrame(origin?:Origin){
 const world=store.world,active=world.axes?.find(frame=>frame.id===world.activeAxis),anchor=origin??active?.ends[0];
 return active?.ends.length===2&&(!origin||active.ends.some(end=>sameOrigin(end,origin)))?active:[...(world.axes??[])].reverse().find(frame=>frame.ends.length===2&&anchor&&frame.ends.some(end=>sameOrigin(end,anchor)));
}
function enterNodePerspective(origin:Origin){
 const relation=relationFrame(origin);if(!view||!relation)return;view.enterNode(origin,relation.id);
}
function aimOrigin(){const id=store.world.activeAxis;if(!id){feedback('Set an origin with O first.');return;}requestNode(target=>store.change(world=>aimFrame(world,id,target)));}
const openBrush=defineMenu('brush',()=>{
 open('Brush');let unit:Brush|undefined=store.world.brush?.unit;
 const form=document.createElement('form'),input=document.createElement('input'),count=document.createElement('output');input.type='text';input.setAttribute('aria-label','Brush geometry');input.placeholder='2×2×2 / sphere 2';
 const current=store.world.brush??SINGLE_BRUSH;input.value=current.kind==='cube'?current.size.join('×'):`sphere ${current.radius}`;
 const render=()=>{try{const brush=parseBrush(input.value,unit);count.textContent=`${brushShape(brush).points.length} nodes${unit?' · composed':''}`;}catch(error){count.textContent=error instanceof Error?error.message:String(error);}};
 input.oninput=render;form.append(input,count);tools.append(form);
 form.onsubmit=event=>{event.preventDefault();attempt(()=>{const brush=parseBrush(input.value,unit);store.change(world=>{world.brush=brush;});close();view?.focusInput();});};
 button('Apply',()=>form.requestSubmit());
 button('Use as unit',()=>attempt(()=>{unit=parseBrush(input.value,unit);input.value='1';render();}));
 button('Reset unit',()=>{unit=undefined;input.value='1';render();});render();input.focus();input.select();positionMenu();
});
const parts=defineMenu('parts',()=>{
  const origin = selectedOrigins()[0], node = origin && locate(store.world, origin); if (!node) return;
  open(node.label || 'Composition');
  if (!node.parts.length) { const text = document.createElement('div'); text.className = 'muted'; text.textContent = '•'; tools.append(text); }
  node.parts.forEach((binding, index) => {
    const row = document.createElement('div'); row.className = 'part';
    const targets = resolve(binding, store.world), mark = binding.mode === 'follow' ? '↫' : binding.mode === 'position' ? '●' : '⚬';
    const target = button(`${index + 1} ${mark} ${targets.length ? targets.map(n => n.label || '•').join(', ') : 'Unresolved'}`, () => {
      if (targets.length) { selection.set(targets.map(node => node.origin)); close(); refresh(); }
    }, row); target.className = `target${targets.length ? '' : ' warning'}`;
    for (const [symbol, offset] of [['↑', -1], ['↓', 1]] as const) {
      const b = button(symbol, () => { store.change(world => { const owner = locate(world, origin)!; const [part] = owner.parts.splice(index, 1); owner.parts.splice(index + offset, 0, part); }); parts(); }, row);
      b.disabled = index + offset < 0 || index + offset >= node.parts.length;
    }
    button('×', () => { store.change(world => { locate(world, origin)!.parts.splice(index, 1); }); parts(); }, row);
    tools.append(row);
  });
  button('Include…', chooseReference); positionMenu();
});
const chooseReference=defineMenu('include',()=>{
  open('Reference');
  button('↫ Follow chosen structure', () => reference('follow'));
  button('● Match this position', () => reference('position'));
  button('⚬ Shared structure', () => reference('structure'));
});
function remove() {
  store.change(world => {
    for (const edge of selection.values.filter((value): value is Edge => !isNode(value)).sort((a,b) => (b.kind === 'variant' ? -1 : b.index) - (a.kind === 'variant' ? -1 : a.index))) {
      if (edge.kind === 'relationship') world.relationships?.splice(edge.index,1);
      else if (edge.kind === 'variant') detachNode(world,edge.owner);
      else locate(world,edge.owner)?.parts.splice(edge.index,1);
    }
    removeNodes(world, selectedOrigins());
  });
  selection.set([]); close(); refresh();
}
const composers=new Set<ReturnType<typeof composerPanel>>(),openingComposers=new Set<string>();
function openComposer(origin?:Origin,restore?:ViewSpec){
 renderClose();if(origin){const node=locate(store.world,origin);if(node?.visual?.omnicEntityId&&!node.omnic&&!node.omnicEdits)origin=JSON.parse(node.visual.omnicEntityId);}
 for(const composer of composers)if(!composer.root.isConnected)composers.delete(composer);
 const existing=[...composers].find(c=>origin&&c.origin?sameOrigin(origin,c.origin):!origin&&!c.origin);if(existing){close();existing.root.focus();return;}
 const id=origin?key(origin):'new';if(openingComposers.has(id))return;openingComposers.add(id);const epoch=documentEpoch,actionId=universalHistory.currentActionId;
 void loadEditor(()=>import('./omnic/editor.ts')).then(({composerPanel})=>{if(epoch!==documentEpoch||origin&&!locate(store.world,origin)||restore&&!viewHistory.wants(restore))return;viewHistory.perform(()=>{if(!restore){const point=cursorPosition();updateNativeLayout(layout=>({...layout,windows:{...layout.windows,'omnic-composer':{...(layout.windows['omnic-composer']??{width:360,height:360,collapsed:false,pinned:false}),x:point.x,y:point.y,closed:false}}}));}const spec=restore??viewHistory.reserve({kind:'composer'});const composer=composerPanel({historyScope:`window:${spec.instance}`,restorePlacement:true,library:openLibrary,surface:surface=>view?.editOmnic(surface)??(()=>{}),redraw:()=>view?.request(),read:()=>store.world,change:store.change,select:origin=>{const node=locate(store.world,origin);if(node?.variantOf)view?.variants(node.variantOf,true);pick(origin);},feedback,subscribe:store.subscribe},origin);composers.add(composer);viewHistory.adopt(`composer:${key(composer.origin!)}`,{...spec,args:[composer.origin]},composer,restore);},actionId);}).catch(error=>{viewHistory.failed(restore,error);feedback(String(error));}).finally(()=>openingComposers.delete(id));
}
let library:ReturnType<typeof libraryPanel>|undefined,openingLibrary=false;
function openLibrary(restore?:ViewSpec){renderClose();if(library?.root.isConnected){close();library.root.focus();return;}if(openingLibrary)return;openingLibrary=true;const epoch=documentEpoch,actionId=universalHistory.currentActionId;
 void loadEditor(()=>import('./omnic/library.ts')).then(({libraryPanel})=>{if(epoch!==documentEpoch||restore&&!viewHistory.wants(restore))return;viewHistory.perform(()=>{const spec=restore??viewHistory.reserve({kind:'library'});library=libraryPanel({read:()=>store.world,change:store.change,open:origin=>openComposer(origin),focus:origin=>{pick(origin);view?.focus([origin],true);},feedback,subscribe:store.subscribe},`window:${spec.instance}`);viewHistory.adopt('library',spec,library,restore);},actionId);}).catch(error=>{viewHistory.failed(restore,error);feedback(String(error));}).finally(()=>{openingLibrary=false;});
}

const context=defineMenu('context',(_position: Vec3,origin?:Origin,edge?:Edge)=>{
  if (edge) { edgeContext(edge); return; }
  open(origin ? `${selectedOrigins().length} selected` : 'Omnium');
  if (!origin) { button('Create structure (N)', () => {close();view?.toggleCreation();}); button('Omnic',()=>openComposer(undefined)); button('Library · Atlas',openLibrary); button('👁', appearance).setAttribute('aria-label', 'Appearance'); return; }
  const node = selectedNodes(store.world)[0]; if (!node) return;
  for (const capability of capabilities(node).filter(c => !['color','carrier','move'].includes(c.key))) button(capability.key==='label'?'Label (L)':capability.label, () => editCapability(capability.key));
  button('👁', appearance).setAttribute('aria-label', 'Appearance');
  for (const capability of capabilities(node).filter(c => ['color','carrier'].includes(c.key))) {
    const shortcut = button(`👁 ${capability.label}`, () => editCapability(capability.key)); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = capability.properties.map(p => p.property.label).join(' ');
  }
  if (selectedOrigins().length === 1) { const shortcut = button('👁 Visual', visuals); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = 'image SVG GLB character size text'; }
  if (selectedOrigins().length === 1) { button('Omnic',()=>openComposer(selectedOrigins()[0])); button('Library · Atlas',openLibrary); button('Composition', parts); button('Document (D)', openDocument); button('Node tools…', nodeTools); }
  button('Include…', chooseReference);
  button(node.invariant ? '⚬ Release invariant' : '⚬ Activate invariant', () => {
    if(!node.invariant&&!node.parts.length&&!node.omnic&&!node.omnicEdits){openComposer(node.origin);return;}
    store.change(world => { for (const target of selectedNodes(world)) setInvariant(world, target, !node.invariant); }); close();
  });
  for (const [name, action] of [['Scene', openScene], ['World', worldControls]] as const) { const shortcut = button(`👁 ${name}`, action); shortcut.dataset.searchOnly = 'true'; }
  button('Position User (P)', () => {focusSelection();close();});
  if(relationFrame(selectedOrigins()[0]))button('View from node',()=>{enterNodePerspective(selectedOrigins()[0]);close();});
});
const immersive=createImmersiveMode({
 keyboard:(navigator as Navigator&{keyboard?:KeyboardLock}).keyboard,
 fullscreen:()=>!!document.fullscreenElement,
 enter:()=>document.documentElement.requestFullscreen(),exit:()=>document.exitFullscreen(),
 changed:()=>{requestFormSync();for(const control of document.querySelectorAll<HTMLButtonElement>('[data-immersive-mode]')){control.textContent=immersiveLabel();control.disabled=immersive.phase==='entering'||immersive.phase==='leaving';}},
});
function immersiveLabel(){return immersive.phase==='active'?'Exit immersive mode · F11':immersive.phase==='entering'?'Starting immersive mode…':'Enter immersive mode · F11';}
function immersiveAction():SearchAction{return {label:immersiveLabel(),keywords:'world immersive fullscreen keyboard lock chrome ctrl f4 f11',available:immersive.supported,run:()=>{if(immersive.phase==='off')enableBrowserShortcuts(false);void (immersive.phase==='active'?immersive.leave():immersive.enter()).catch(error=>feedback(error.message));}};}
document.addEventListener('fullscreenchange',()=>immersive.fullscreenChanged());
window.addEventListener('pagehide',()=>{void immersive.leave().catch(()=>{});});
// Capture F11 before local handlers; locked Escape keeps its normal app handlers.
window.addEventListener('keydown',event=>{if(immersive.supported&&!browserShortcutsEnabled())handleImmersiveShortcut(event,()=>immersiveAction().run());},true);
window.addEventListener('keydown',event=>{if(immersive.phase==='active'&&event.code==='F4'&&(event.ctrlKey||event.metaKey)&&!browserShortcutsEnabled()){event.preventDefault();event.stopImmediatePropagation();}},true);
const settingsCatalog=createSettingsCatalog<SearchSetting>();
const animationSettings=settingsCatalog.define('animations',()=>ANIMATION_TARGETS.flatMap(target=>animationProperties(target.id).map(property=>({
 label:`Animations · ${target.label} · ${property.label}`,keywords:`appearance animation particles stars lightning text symbols effects ${target.id}`,
 definition:{...property,key:`${target.id}/${property.key}`},
 read:()=>animationValue(store.world.appearance?.animations,target.id,property.key),
 write:(world:World,value:Value)=>{world.appearance??={};world.appearance.animations??={};world.appearance.animations[target.id]??={};world.appearance.animations[target.id][property.key]=value;},
}))));
const worldSettings=settingsCatalog.define('world',()=>[
    {label:'Lattice scale',keywords:'world lattice',definition:{key:'latticeScale',label:'Lattice scale',kind:'number' as const,min:1e-9},read:()=>store.world.settings?.latticeScale??1,write:(world:World,value:string|number|boolean)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.latticeScale=Number(value);}},
    {label:'Content view',keywords:'world names labels glyph contents visibility contour expansion all on off focused selection v shortcut',definition:{key:'names',label:'Content view',kind:'toggle'},read:()=>store.world.settings?.names==='all',write:(world:World,value:Value)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.names=value?'all':'selection';}},
    {label:'Browser shortcuts',keywords:'world browser chrome keyboard shortcuts',definition:{key:'browserShortcuts',label:'Browser shortcuts',kind:'toggle'},read:browserShortcutsEnabled,set:value=>{enableBrowserShortcuts(Boolean(value));if(value)void immersive.leave().catch(error=>feedback(error.message));}},
]);

window.addEventListener('keydown',event=>{
 const target=event.target,typing=target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.cm-editor');
 handleContentViewShortcut(event,typing,()=>{const setting=worldSettings().find(item=>item.definition.key==='names')!;attempt(()=>store.change(world=>setting.write!(world,!setting.read())));});
},true);
const historySettings=settingsCatalog.define('history',()=>[
    {label:'History · Scope',keywords:'history scope selective context categories recent all actions',definition:HISTORY_MODE,read:()=>universalHistory.options.mode,set:value=>universalHistory.configure({mode:value as typeof universalHistory.options.mode})},
    {label:'History · Steps',keywords:'history undo redo count steps',definition:HISTORY_STEPS,read:()=>universalHistory.options.steps,set:value=>universalHistory.configure({steps:Number(value)})},
    ...HISTORY_CATEGORIES.map(id=>({label:`History · ${id}`,keywords:'history selected categories filter',definition:{key:`history.${id}`,label:id==='omnium'?'Nodes / documents':id,kind:'toggle' as const},read:()=>universalHistory.options.categories.includes(id),set:(value:Value)=>universalHistory.configure({categories:value?[...new Set([...universalHistory.options.categories,id])]:universalHistory.options.categories.filter(category=>category!==id)})})),
]);
const navigationSettings=settingsCatalog.define('navigation',()=>NAVIGATION_PROPERTIES.map(definition=>({label:`Camera · ${definition.label}`,keywords:'world navigation 3d rotation',definition,read:()=>({...NAV_DEFAULTS,...store.world.settings?.navigation})[definition.key.slice('navigation.'.length) as keyof NavigationOptions],write:(world:World,value:Value)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.navigation={...NAV_DEFAULTS,...world.settings.navigation,[definition.key.slice('navigation.'.length)]:value};}})));
settingsCatalog.define('workspace',searchSettingsEntries);
function searchSettingsEntries(){
  const origins=[...selectedOrigins()],selected=origins[0]&&locate(store.world,origins[0]);
  let nodeWorld=store.world,nodeCapabilities=selected?capabilities(resolveNodeSettings(store.world,inherited(selected,store.world))):[];
  const readNode=(key:string,index:number)=>{if(nodeWorld!==store.world){nodeWorld=store.world;const node=locate(nodeWorld,origins[0]);nodeCapabilities=node?capabilities(resolveNodeSettings(nodeWorld,inherited(node,nodeWorld))):[];}return nodeCapabilities.find(c=>c.key===key)?.properties[index].read();};
  const nodeEntries=selected?nodeCapabilities.flatMap(capability=>capability.properties.map((binding,index)=>({label:`${capability.label} · ${binding.property.label}`,keywords:'selected node',definition:binding.property,read:()=>readNode(capability.key,index),write:(world:World,value:string|number|boolean)=>{if(capability.key==='move'){const first=locate(world,origins[0]);if(first){const delta:Vec3=[0,0,0];delta[index]=Number(value)-first.position[index];translate(world,origins,delta);}return;}for(const origin of origins){const node=locate(world,origin);if(!node)continue;const target=capabilities(node).find(item=>item.key===capability.key);if(!target)continue;target.properties[index].write(String(value));if(node.variantOf)node.overrides=[...new Set([...(node.overrides??[]),binding.property.key])];}}}))):[];
  const visualEntries=(['nodeDefaults','text','background',...(origins.length?['nodeText' as const,'nodes' as const]:[])] as const).flatMap(target=>(target==='nodeDefaults'||target==='nodes'?NODE_VISUAL_PROPERTIES.map(p=>({...p,key:p.id})):visualProperties(target==='text'||target==='nodeText')).map(definition=>({label:`${target} · ${definition.label}`,keywords:`eye appearance visuals ${target==='nodeDefaults'?'global nodes sphere body':''}`,definition,read:()=>readPaint(store.world,target,origins[0])[definition.key as keyof Paint]!,write:(world:World,value:string|number|boolean)=>writePaint(world,target,origins,{[definition.key]:value})})));
  const entries:SearchSetting[]=[
    ...nodeEntries,...visualEntries,

    ...([{key:'prompt',label:'Scene prompt',kind:'text'},{key:'variable',label:'Scene variable',kind:'text'},{key:'source',label:'Scene prompt input',kind:'select',options:[{id:'label',label:'Label'},{id:'notes',label:'Document'},{id:'label-and-notes',label:'Label + document'}]}] as Property[]).map(definition=>({label:definition.label,keywords:'scene image generation prompt source variable',definition,read:()=>(store.world.scene??defaultScene())[definition.key as 'prompt'|'variable'|'source'],write:(world:World,value:Value)=>{world.scene??=defaultScene();Object.assign(world.scene,{[definition.key]:value});}})),
    ...Object.entries(vfxFunction.inputs).map(([key,binding])=>({label:binding.definition.label,keywords:`scene ${key}`,definition:{...binding.definition,key},read:()=>binding.read({sceneVfx:(store.world.scene??defaultScene()).vfx}),write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx=binding.write({sceneVfx:world.scene.vfx},value).sceneVfx;}})),
    ...audioDefinitions.map(d=>({label:d.property.label,keywords:'scene audio sound pulse bounce blinking flash delay cooldown',definition:d.property,read:()=>((store.world.scene??defaultScene()).vfx.audioResponse[d.key] as number)*d.scale,write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx.audioResponse[d.key]=Number(value)/d.scale;}})),
    ...NORMALIZATION_FIELDS.map(d=>({label:d.label,keywords:'scene normalization normalize correction threshold limit',definition:{key:normalizationProperty(d.key),label:d.label,kind:d.kind,...(d.kind==='number'?{min:d.min,max:d.max,step:.01}:{})},read:()=>(store.world.scene??defaultScene()).normalization[d.key],write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.normalization=editNormalization(world.scene.normalization,{[d.key]:value});}})),
  ];
  return entries;
}
type SearchSetting={label:string;keywords:string;definition:Property;read:()=>Value|undefined;write?:(world:World,value:Value)=>void;set?:(value:Value)=>void};
type SearchAction={label:string;keywords:string;run:()=>void;available?:boolean};
function spaceActions():SearchAction[]{
 const relation=relationFrame(),frame=view?.reference,active=!!store.world.activeAxis;
 return [
 {label:'Face node (Alt+Right click)',keywords:'world origin axes direction aim face align',run:aimOrigin,available:active},
 {label:'Brush (Shift+X)',keywords:'world paint cube sphere geometry recursive unit',run:openBrush},
 {label:'Coordinates (C)',keywords:'world cursor brush coordinates xy xyz readout labels',run:()=>view?.toggleCoordinates()},
 {label:'Position User (P)',keywords:'world camera node axis reference origin focus align',run:focusSelection,available:true},
 {label:'View from first node',keywords:'world camera perspective occupy endpoint depth z',run:()=>{if(relation)enterNodePerspective(relation.ends[0]);},available:!!relation},
 {label:'View from second node',keywords:'world camera perspective occupy endpoint depth z',run:()=>{if(relation?.ends[1])enterNodePerspective(relation.ends[1]);},available:!!relation},
 {label:'Return to user view',keywords:'world camera perspective user leave node',run:()=>view?.leaveNode(),available:!!view?.inNodeView},
 ...(frame?[0,1,2].map(axis=>({label:`${activeWorldAxes(frame).includes(axis)?'✓ ':''}${'XYZ'[axis]} axis`,keywords:'world active axes plane line volume constrain',run:()=>{if(!view?.toggleReferenceAxis(frame.id,axis))store.change(world=>toggleWorldAxis(world,frame.id,axis));}})):[]),
 ...([{label:`Selection depth · ${view?.selectionDepth??8}`,keywords:'selection volume box depth',run:()=>{const value=prompt('Selection depth',String(view?.selectionDepth??8));if(value!==null)view?.setSelectionDepth(Number(value));}}]),
 {label:'Shift origin…',keywords:'world plane origin elevation level offset xyz',available:active,run:()=>{const value=prompt('Origin shift: X Y Z','0 0 0');if(value===null)return;const offset=value.trim().split(/[ ,]+/).map(Number);if(offset.length!==3||offset.some(n=>!Number.isSafeInteger(n)))throw Error('Use three whole numbers.');store.change(world=>shiftAxisOrigin(world,world.activeAxis!,offset as Vec3));}},
 {label:'Unfocus frame',keywords:'world axis origin reference deactivate',run:()=>store.change(world=>{delete world.activeAxis;}),available:active},
 {label:'Release frame',keywords:'world axis origin reference remove constraints',run:()=>store.change(world=>{world.axes=world.axes?.filter(frame=>frame.id!==world.activeAxis);delete world.activeAxis;}),available:active},
 ];
}
function searchActions():SearchAction[]{return [
 immersiveAction(),
 ...spaceActions(),
 {label:'Appearance · Animations',keywords:'appearance effects particles stars lightning electric text symbols animation',run:animations},
 ...SCENE_TABS.map(([tab,label])=>({label:`Scene · ${label}`,keywords:`scene ${tab} ${tab==='audio'?'system audio sound connect code import':tab==='image'?'wallpaper background import paste download library':tab==='normalization'?'normalization correction thresholds':''}`,run:()=>openScene(tab)})),
 ...VISUAL_TARGETS.map(([target,label])=>({label:`Visuals · ${label}`,keywords:`eye appearance visuals ${target==='nodeDefaults'?'global node sphere body':target==='text'?'font import typeface':target==='background'?'background ui surfaces':''}`,run:()=>openVisualSettings(target,[...selectedOrigins()],label),available:(target!=='nodes'&&target!=='nodeText')||!!selectedOrigins().length})),
 ...CAMERA_ACTIONS.map(([id,label])=>({label:`Camera · ${label}`,keywords:`camera navigation ${id}`,run:()=>view?.camera(id)})),
 {label:'Workspace · import / export / restore',keywords:'workspace file json backup download upload everything',run:openWorkspace},
 {label:'Omnic composer',keywords:'node object composition create edit',run:()=>openComposer(selectedOrigins()[0])},
 {label:'Library · Atlas',keywords:'library atlas objects presets',run:openLibrary},
 {label:'Appearance · Visuals',keywords:'eye visuals colour color text nodes sphere body backgrounds font typeface',run:appearance},
 {label:'Scene',keywords:'scene wallpaper image audio normalization normalize waves pulse prompt',run:openScene},
 {label:'World',keywords:'world lattice names labels visibility',run:worldControls},
 {label:'Camera & rotation',keywords:'camera navigation 3d orbit look pan walk rotation sensitivity',run:openNavigation},
 {label:'History',keywords:'history undo redo scope steps',run:openHistory},
 {label:'Undo',keywords:'undo history mb4 ctrl z control z',run:()=>travelHistory('undo')},
 {label:'Redo',keywords:'redo history mb5 ctrl y control y',run:()=>travelHistory('redo')},
 {label:'Create structure (N)',keywords:'add new node structure',run:()=>view?.toggleCreation(),available:!!view},
 {label:'Document (D)',keywords:'node document text notes writing',run:openDocument,available:!!selectedOrigins().length},
 {label:'Composition',keywords:'node parts include references invariants',run:parts,available:!!selectedOrigins().length},
 {label:'Node tools',keywords:'node child parent copy variants attach detach hide connect remove',run:nodeTools,available:!!selectedOrigins().length},
 {label:'Node visual',keywords:'import image svg glb character object mesh show text size',run:visuals,available:!!selectedOrigins().length},
 {label:'Show all nodes',keywords:'show hidden visibility expand collapse',run:()=>{store.change(world=>{for(const node of world.nodes){node.hidden=false;node.collapsed=false;}});close();refresh();}},
 {label:'Fit all',keywords:'camera zoom fit all world',run:()=>{view?.focus(store.world.nodes.map(node=>node.origin),true);close();}},
];}
function appendSetting(parent:HTMLElement,item:SearchSetting,label=item.definition.label){
 const form=document.createElement('form'),control=field({...item.definition,label},item.read()??'');form.append(control.row);parent.append(form);
 liveForm(form,group=>attempt(()=>{if(item.set)item.set(control.value());else store.change(world=>item.write!(world,control.value()),group);}));
 watchFields(form,[{input:control.input,read:item.read}]);
}
function searchRenderer(results:HTMLElement){
 return(query:string)=>{
  const settings=settingsCatalog.all().map(item=>({item,index:searchIndex(item)})),actions=searchActions().map(item=>({item,index:searchIndex(item)}));
  results.replaceChildren();if(!query.trim())return;let count=0;
  for(const {item,index}of actions)if(searchMatches(index,query)){const control=document.createElement('button');control.type='button';control.textContent=item.label;control.disabled=item.available===false;control.onclick=()=>attempt(item.run);if(item.keywords.includes('keyboard lock'))control.dataset.immersiveMode='';results.append(control);count++;}
  for(const {item,index}of settings)if(searchMatches(index,query)){
   appendSetting(results,item,item.label);count++;
  }
  if(!count){const empty=document.createElement('output');empty.textContent='No matches';results.append(empty);}
  requestFormSync();positionMenu();
 };
}
const searchSettings=defineMenu('search',()=>{
 open('Search');tools.querySelector('input[type=search]')?.remove();
 const input=document.createElement('input');input.type='search';input.placeholder='Search';input.setAttribute('aria-label','Search');const results=document.createElement('div');results.className='settings-search-results';tools.append(input,results);
 const render=searchRenderer(results);input.value=viewHistory.state.menu?.query??'';if(input.value)render(input.value);input.addEventListener('input',()=>{viewHistory.query(input.value);render(input.value);});input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();results.querySelector<HTMLElement>('input,select,button:not(:disabled)')?.focus();}});positionMenu();input.focus();
},true);
let draftControl:HTMLButtonElement|undefined;
let workspaceView: ReturnType<typeof workspacePanel> | undefined;
function openWorkspace(restore?:ViewSpec) {
  if(!viewHistory.performing){viewHistory.perform(()=>openWorkspace(restore));return;}
  renderClose(); if (workspaceView?.root.isConnected) { close();workspaceView.root.focus(); return; }
  workspaceView = workspacePanel({ omnic:()=>openComposer(),atlas:openLibrary,draft:draftControl, selected: () => selectedOrigins().map(origin => JSON.stringify(origin)), read: () => store.world, replace: world => { store.replace(world); selection.set([]); search.value = ''; refresh(); }, recover: () => { store.recover(); selection.set([]); search.value = ''; refresh(); }, beforeReplace: () => {
    for(const composer of composers.values())composer.close(); library?.close();
    documentEpoch++; view?.cancel(); close(); selection.cancel(); sceneView?.close();
    for (const document of documents.values()) document?.close();
    if ([...documents.values()].some(document => document?.root.isConnected)) throw Error('An open document could not close. Preserve it before importing.');
  } });
  viewHistory.adopt('workspace',{kind:'workspace'},workspaceView,restore);
}
let sceneView: ReturnType<typeof scenePanel> | undefined;
function openScene(tab:SceneTab='image',restore?:ViewSpec) {
  if(!viewHistory.performing){viewHistory.perform(()=>openScene(tab,restore));return;}
  renderClose(); if (!view) return; sceneView?.close();
  sceneView = scenePanel({ subscribe:store.subscribe, read: () => store.world, selected: ()=>restore?.selection as Origin[]??selectedOrigins(), change: (edit, group) => store.change(edit, group), preview: candidate => view.session.update(candidate, selectedOrigins()[0]), session: view.session, feedback },tab);
  viewHistory.adopt('scene',{kind:'scene',args:[tab],selection:[...selectedOrigins()]},sceneView,restore);
}
const documents = new Map<string, ReturnType<typeof editDocument>>(), openingDocuments = new Set<string>();
let documentEpoch = 0;
function openDocument(requested?:Origin,restore?:ViewSpec) {
  const origin = requested??selectedOrigins()[0]; if (!origin) return; renderClose();
  const id = key(origin), existing = documents.get(id);
  if (existing?.root.isConnected) { close();existing.root.querySelector<HTMLElement>('.cm-content')?.focus(); return; }
  if (openingDocuments.has(id)) return;
  openingDocuments.add(id); const epoch = documentEpoch,actionId=universalHistory.currentActionId;
  void loadEditor(()=>import('./text/editor.ts')).then(({ editDocument }) => {
    if (epoch !== documentEpoch || !locate(store.world, origin)||restore&&!viewHistory.wants(restore)) return;
    viewHistory.perform(()=>{const document=editDocument(origin, () => store.world, text => store.change(world => {
      const node = locate(world, origin); if (!node) throw Error('This node was removed. Copy the document before closing.'); node.text = text;
      if (node.variantOf) node.overrides = [...new Set([...(node.overrides ?? []), 'text'])];
    }, `document:${id}`), feedback, () => documents.delete(id));documents.set(id,document);if(document)viewHistory.adopt(`document:${id}`,{kind:'document',args:[origin]},document,restore);},actionId);
  }).catch(error => {viewHistory.failed(restore,error);feedback(error instanceof Error ? error.message : String(error));}).finally(() => openingDocuments.delete(id));
}

function requestNode(accept: (target: Origin) => void) {
  close(); selection.request(target => { if (!isNode(target)) return false; try { accept(target); message = ''; return true; } catch (error) { message = error instanceof Error ? error.message : String(error); return false; } });
  message = 'Choose a node · Esc cancels'; refresh();
}
function connectNode(origin:Origin){
  requestNode(target=>{if(key(origin)===key(target))throw Error('Choose another node.');store.change(world=>{world.relationships??=[];world.relationships.push({from:bind(locate(world,origin)!,'follow',world),to:bind(locate(world,target)!,'follow',world),label:'',kind:'relation'});});});
  view?.connect(origin);
}
const nodeTools=defineMenu('nodeTools',()=>{
  const origin = selectedOrigins()[0], node = origin && locate(store.world, origin); if (!node) return;
  open(node.label || 'Node');
  button('Variants', () => { view?.variants(origin); close(); });
  button('Add variant', () => { let child: Origin | undefined; store.change(world => { child = childNode(world, origin, true).origin; }); selection.set([child!]); view?.variants(origin, true); close(); refresh(); });

  button('Connect to…', () => connectNode(origin));
  button('Attach to…', () => requestNode(target => store.change(world => { const source = locate(world, origin)!; source.parent = structuredClone(target); })));
  if (node.parent || node.variantOf) button('Detach', () => { store.change(world => detachNode(world, origin)); close(); });
});
const VISUAL_TARGETS=[['nodeDefaults','Nodes'],['text','Text'],['background','UI backgrounds'],['nodes','Selected nodes'],['nodeText','Selected node text']]as const;
const openVisualSettings=defineMenu('visualSettings',(target:VisualTarget,origins:readonly Origin[],title:string)=>{
 open(title);
 if(target==='nodes'||target==='nodeDefaults'){
  const root=document.createElement('div');root.className='node-body-editor';tools.append(root);
  void loadEditor(()=>import('./ui/nodeVisuals.tsx')).then(({nodeVisualEditor})=>{if(!root.isConnected)return;disposeTools=nodeVisualEditor(root,{read:()=>store.world,subscribe:store.subscribe,change:store.change,error:feedback},target,origins);positionMenu();}).catch(error=>feedback(String(error)));
 }else tools.append(paintForm(target,origins,()=>store.world,(edit,group)=>store.change(edit,group),feedback));positionMenu();
});
const appearance=defineMenu('appearance',()=>{
  open('👁');
  button('Scene', openScene); button('World', worldControls);
  button('Visuals',visualTargets);
  button('Animations',animations);
});
const animations=defineMenu('animations',()=>{
 open('Animations');
 for(const target of ANIMATION_TARGETS)button(target.label,()=>animationControls(target.id));
 button('All off',()=>store.change(world=>{world.appearance??={};world.appearance.animations=Object.fromEntries(ANIMATION_TARGETS.map(target=>[target.id,{...world.appearance?.animations?.[target.id],effect:'off'}]));}));
 positionMenu();
});
const animationControls=defineMenu('animationControls',(id:string)=>{
 const target=ANIMATION_TARGETS.find(target=>target.id===id);if(!target)return;
 open(target.label);
 for(const item of animationSettings().filter(item=>item.definition.key.startsWith(`${id}/`)))appendSetting(tools,item);
 button('Reset',()=>store.change(world=>{if(world.appearance?.animations)delete world.appearance.animations[id];}));
 positionMenu();
});
const visualTargets=defineMenu('visualTargets',()=>{
    open('👁 Visuals');
    const origins=[...selectedOrigins()];
    for(const [target,title] of VISUAL_TARGETS){
      if((target==='nodes'||target==='nodeText')&&!origins.length)continue;
      button(title,()=>openVisualSettings(target,origins,title));
    }
    if(origins.length===1)button('Node visual',visuals);
    positionMenu();
});


const HISTORY_MODE:Property={key:'history.mode',label:'Scope',kind:'select',options:[{id:'recent',label:'All actions'},{id:'context',label:'Current context'},{id:'selective',label:'Selected categories'}]};
const HISTORY_STEPS:Property={key:'history.steps',label:'Steps',kind:'number',min:1,max:10,step:1};
const HISTORY_CATEGORIES=['omnium','ui','appearance','settings','camera']as const;
const openHistory=defineMenu('history',()=>{
  open('History');for(const item of historySettings())appendSetting(tools,item);
  button('Undo',()=>store.undo());button('Redo',()=>store.redo());positionMenu();
});
const openNavigation=defineMenu('navigation',()=>{
  open('Camera & rotation');for(const item of navigationSettings())appendSetting(tools,item);
  for(const [id,label]of [['zoom100','100%'],['cameraOrigin','Origin'],['front','Front'],['all','Fit all'],['back','Back']]as const)button(label,()=>view?.camera(id));positionMenu();
});
const worldControls=defineMenu('world',()=>{
  open('World');for(const action of spaceActions())if(action.available!==false)button(action.label,action.run);
  for(const item of worldSettings())appendSetting(tools,item);
  const immersion=immersiveAction(),immersiveButton=button(immersion.label,immersion.run);immersiveButton.disabled=immersion.available===false;immersiveButton.dataset.immersiveMode='';
  button('History',openHistory);
  button('Camera & rotation',openNavigation);
  button('Show all nodes', () => { store.change(world => { for (const node of world.nodes) {node.hidden=false;node.collapsed=false;} });search.value='';close();refresh(); });
  button('Fit all', () => { view?.focus(store.world.nodes.map(node => node.origin),true);close(); });positionMenu();
});
const visuals=defineMenu('visualAsset',()=>{
  const origin=selectedOrigins()[0];if(!origin)return;open('Visual');
  button('Import image / SVG / GLB', () => {
    const file=document.createElement('input');file.type='file';file.accept='.png,.jpg,.jpeg,.webp,.svg,.glb';
    file.onchange=()=>{const selected=file.files?.[0];if(!selected)return;void (async()=>{
      if(selected.size>MAX_ASSET_BYTES)throw Error('Visual assets support files up to 900 KB.');
      const bytes=await selected.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',bytes),id=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      const dataUrl=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(selected);});
      const asset:VisualAsset={id,name:selected.name,kind:selected.name.toLowerCase().endsWith('.glb')?'glb':'image',dataUrl:dataUrl.replace(/^data:application\/octet-stream/,selected.name.toLowerCase().endsWith('.glb')?'data:model/gltf-binary':'data:application/octet-stream')};validateAsset(asset);
      store.change(world=>{world.assets??=[];if(!world.assets.some(a=>a.id===id))world.assets.push(asset);const node=locate(world,origin);if(!node)throw Error('Visual destination was removed.');node.visual={assetId:id};if(node.variantOf)node.overrides=[...new Set([...(node.overrides??[]),'visual'])];});close();
    })().catch(error=>feedback(error instanceof Error?error.message:String(error)));};file.click();
  });
  const node=inherited(locate(store.world,origin)!,store.world),form=document.createElement('form'),character=field({key:'character',label:'Character',kind:'text'},node.visual?.character??''),size=field({key:'visual.size',label:'Size',kind:'number',min:.1,max:5,step:.1},node.visual?.size??1.4),showText=field({key:'visual.showText',label:'Show text',kind:'toggle'},node.visual?.showText??true);form.append(character.row,size.row,showText.row);
  liveForm(form, group=>attempt(()=>store.change(world=>{const target=locate(world,origin)!,text=String(character.value());const visual={...inherited(target,world).visual};if(text){visual.character=text;delete visual.assetId;delete visual.omnicEntityId;}else delete visual.character;target.visual={...visual,size:Number(size.value()),showText:Boolean(showText.value())};if(target.variantOf)target.overrides=[...new Set([...(target.overrides??[]),'visual'])];}, group)));tools.append(form);
  watchFields(form,[{input:character.input,read:()=>{const n=locate(store.world,origin);return n?inherited(n,store.world).visual?.character??'':undefined;}},{input:size.input,read:()=>{const n=locate(store.world,origin);return n?inherited(n,store.world).visual?.size??1.4:undefined;}},{input:showText.input,read:()=>{const n=locate(store.world,origin);return n?inherited(n,store.world).visual?.showText??true:undefined;}}]);
  if(node.visual)button('Clear visual',()=>{store.change(world=>{delete locate(world,origin)!.visual;});close();});positionMenu();
});
const edgeContext=defineMenu('edge',(edge: Edge)=>{
  open('Connection');
  const relation=edge.kind==='relationship'?store.world.relationships?.[edge.index]:undefined;
  if(relation && edge.kind === 'relationship'){
    const form=document.createElement('form'),label=field({key:'relation.label',label:'Label',kind:'text'},relation.label),kind=field({key:'relation.kind',label:'Type',kind:'text'},relation.kind);form.append(label.row,kind.row);
    liveForm(form, group=>attempt(()=>store.change(world=>{const r=world.relationships![edge.index];r.label=String(label.value());r.kind=String(kind.value());}, group)));tools.append(form);
    button('Reverse',()=>{store.change(world=>{const r=world.relationships![edge.index];[r.from,r.to]=[r.to,r.from];});close();});
    for(const [key,label] of [['from','Reconnect source…'],['to','Reconnect target…']] as const)button(label,()=>requestNode(target=>store.change(world=>{world.relationships![edge.index][key]=bind(locate(world,target)!,'follow',world);})));
  }else if(edge.kind==='part')button('Reconnect target…',()=>requestNode(target=>store.change(world=>{locate(world,edge.owner)!.parts[edge.index]=bind(locate(world,target)!,'follow',world);})));
  button('Remove',remove);positionMenu();
});
element('workspace').onclick = ()=>openWorkspace();
element<HTMLButtonElement>('create').disabled = !view;
element('create').onclick = () => view?.toggleCreation();
function travelHistory(direction:'undo'|'redo'){
  const field=document.activeElement,editing=field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement;
  if(editing)field.blur();flushLiveForms();view?.cancel();selection.cancel();travelGlobalHistory(direction);
  if(editing&&field.isConnected)field.focus({preventScroll:true});refresh();
}
element('undo').onclick = () => travelHistory('undo');
element('redo').onclick = () => travelHistory('redo');
search.oninput = () => { close(); refresh(); };
search.onkeydown = event => { if (event.key === 'Enter' && shown && !selection.requesting) { selection.set(store.world.nodes.filter(node => shown!.has(key(node.origin))).map(node => node.origin)); search.blur(); refresh(); } };
tools.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
window.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.defaultPrevented)return;
  // The document owns its search panel and editor Escape hierarchy.
  if(event.target instanceof Element&&event.target.closest('.node-document-panel .document-content'))return;
  if(event.repeat){event.preventDefault();event.stopImmediatePropagation();return;}
  const gesture=view?.cancel();
  if(!gesture&&uiPointerHeld())return;
  flushLiveForms();
  if(gesture||selection.cancel()){ /* Cancel the current gesture before closing its window. */ }
  else if(!tools.hidden)close();
  else if(!closeActiveWindow())selection.set([]);
  event.preventDefault();event.stopImmediatePropagation();message='';refresh();
},true);
function worldShortcutActions(){return [
 ...spaceActions().filter(action=>action.available!==false).map(action=>{const match=/^(.*?) \(([^)]+)\)$/.exec(action.label);return {label:match?.[1]??action.label,key:match?.[2],run:action.run};}),
 ...([{label:'Set origin',key:'O',run:()=>view?.pickOrigin()}]),
 {label:'Mount hovered / dismount',key:'M',run:()=>view?.mountTarget()},
 {label:view?.userDetached?'Mount User':'Dismount User',key:'U',run:()=>view?.toggleUser()},
 {label:'Create nodes',key:'N',run:()=>view?.toggleCreation()},
 {label:'Search',key:'S',run:searchSettings},
 ...(selectedOrigins().length>1?[{label:'Align selection',key:'I',run:()=>view?.alignSelection()}]:[]),
 ...(selectedOrigins().length?[{label:'Document',key:'D',run:()=>openDocument()},{label:'Label',key:'L',run:()=>editCapability('label')},{label:'Remove',key:'Delete',run:remove}]:[]),
 ];}
installContextActions();
registerContextActions({label:'Omnium',owns:element=>!!element.closest('#world,header'),read:()=>{
 const mode=view?.inputContext;
 if(mode==='rotate')return [{label:'Shared reference',key:'O'},{label:'Confirm rotation',key:'Right click empty'},{label:'Rotate preview',key:'Move up/down'},{label:'Snap value',key:'0–9'},{label:'Cancel',key:'Esc'}];
 if(mode==='align')return [{label:'Rotate alignment axis',key:'Right drag'},{label:'Toggle axes',key:'Hold left + sweep'},{label:`Gap ${view?.alignmentGap??0} (0 = adjacent)`,key:'0–9'},{label:'Face origin toward node',key:'Alt + right click',run:aimOrigin},{label:'Apply alignment',key:'Enter'},{label:'Cancel',key:'Esc'}];
 if(mode==='origin')return [{label:'Choose origin slot',key:'Click'},{label:'Cancel origin picker',key:'O / Esc'}];
 if(mode==='axis-first'||mode==='axis-second')return [{label:mode==='axis-first'?'Choose first axis node':'Choose second axis node',key:'Click'},{label:'Cancel axis picker',key:'Esc'}];
 if(mode==='create')return [{label:'Expand/collapse hierarchy',key:'Q'},{label:'Pick up / place',key:'Click'},{label:'Connect',key:'Shift + drag'},{label:'Place nodes',key:'Click'},{label:'Paint nodes',key:'Drag'},{label:'Preview paint',key:'Hold Alt'},{label:'Exit creation',key:'N / Esc',run:()=>view?.toggleCreation()}];
 return [
 ...worldShortcutActions(),
 {label:'Expand/collapse next level',key:'Shift + Q'},{label:'Select in plane',key:'Ctrl + drag'},{label:'Select with depth',key:'Ctrl + Shift + drag'},{label:'Expand/collapse hierarchy',key:'Q'}, {label:'Pick up / place',key:'Click'},{label:'Connect',key:'Shift + drag'},{label:'Preview paint',key:'Hold Alt'},{label:'Look / orbit',key:'Right drag'},{label:'Undo',key:'Ctrl+Z',run:()=>travelHistory('undo')},{label:'Redo',key:'Ctrl+Y',run:()=>travelHistory('redo')},
 {label:'Cancel',key:'Esc'},{label:'Toggle actions',key:'.'}
];}});
document.addEventListener('keydown', event => {
  const editing = event.target instanceof Element && (!!event.target.closest('[data-input-owner]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement);
  if (event.target instanceof Element && event.target.closest('[data-input-owner]')) return;
  if (editing || event.target instanceof HTMLElement && event.target.isContentEditable) return;
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&view?.userPositionKey(event.key)){event.preventDefault();return;}
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.shiftKey&&!event.repeat&&!selection.requesting){
    const action=worldShortcutActions().find(action=>action.key?.toLowerCase()===event.key.toLowerCase());
    if(action){event.preventDefault();attempt(action.run);return;}
  }
  if(event.key.toLowerCase()==='q'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat&&!selection.requesting){event.preventDefault();attempt(()=>view?.toggleHierarchy(event.shiftKey));return;}
  if(event.key.toLowerCase()==='x'&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat){event.preventDefault();openBrush();return;}
  if(event.key.toLowerCase()==='s'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat){event.preventDefault();searchSettings();return;}

  if (event.key === 'Delete' && selection.values.length && !selection.requesting) { event.preventDefault(); attempt(remove); }
});
viewHistory.menuRenderer(spec=>{
 if(!spec){renderClose();return;}menuPoint={...(spec.point??cursorPosition())};
 if(spec.selection&&!sameValue(selection.values,spec.selection)){selection.set(spec.selection as Target[]);refresh();}
 menuFactories.get(spec.kind)?.((spec.args??[]) as unknown[]);
});
viewHistory.factory('workspace',spec=>openWorkspace(spec));
viewHistory.factory('library',spec=>openLibrary(spec));
viewHistory.factory('scene',spec=>openScene((spec.args as SceneTab[])[0],spec));
viewHistory.factory('document',spec=>openDocument((spec.args as Origin[])[0],spec));
viewHistory.factory('composer',spec=>openComposer((spec.args as Origin[])[0],spec));
installHistoryBindings({undo:()=>travelHistory('undo'),redo:()=>travelHistory('redo'),configure:openHistory,flush:flushLiveForms});
refresh();

// Builds share one draft; production retains its published starting state.
if(location.hostname==='omnium.nexus'||location.hostname==='omnia-web-bae.pages.dev'||location.hostname.endsWith('.omnia-web-bae.pages.dev')){
 const api=createDraftClient(),indicator=document.createElement('button');indicator.type='button';indicator.setAttribute('aria-label','Shared draft');draftControl=indicator;
 let draftView:ReturnType<typeof panel>|undefined;
 let issue='',hasLocal=true;try{hasLocal=!!(localStorage.getItem('omnium.v2.world.3')??localStorage.getItem('omnium.v2.world.2')??localStorage.getItem('omnium.v2.world.1'));}catch{/* Preserve recovery mode. */}
 const sync=createDraftSync({
  read:()=>store.world,hasLocal,autoLoad:location.hostname.endsWith('.omnia-web-bae.pages.dev'),
  load:()=>api.load(),save:(world,revision)=>api.save(world,revision),
  marker:()=>{try{const value=JSON.parse(localStorage.getItem('omnium.shared-draft.base.1')??'null');return value&&Number.isSafeInteger(value.revision)&&typeof value.signature==='string'?value as Marker:null;}catch{return null;}},
  remember:value=>{localStorage.setItem('omnium.shared-draft.base.1',JSON.stringify(value));},
  replace:async world=>{const before=store.world;await api.restore(world);if(store.world!==before)throw Error('Workspace changed while loading.');for(const doc of documents.values())doc?.close();sceneView?.close();if(store.world!==before)throw Error('Finish local edits before loading the shared draft.');store.replace(world);selection.set([]);refresh();},
  status:(phase,error)=>{indicator.textContent=`Draft · ${phase}`;issue=error??'';renderDraftDetails();},
 });
 store.subscribe(sync.changed);
 function renderDraftDetails(){
  const view=draftView;if(!view?.root.isConnected)return;
  const output=document.createElement('output');output.setAttribute('aria-live','polite');output.textContent=issue||sync.phase;view.body.replaceChildren(output);
  if(sync.phase==='Loading'||sync.phase==='Saving')return;
  if(sync.phase==='Failed'){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>{void sync.load();};view.body.append(retry);return;}
  for(const [label,choice] of [['Pull','remote'],['Push','local']] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{void sync.load(choice);};view.body.append(button);}
 }
 const openDraft=viewHistory.defineWindow('sharedDraft',()=>{const view=panel('Shared draft');draftView=view;renderDraftDetails();return view;});
 indicator.onclick=()=>{if(draftView?.root.isConnected){draftView.root.focus();return;}openDraft();};
 window.addEventListener('online',()=>{if(sync.phase==='Failed')void sync.load();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void sync.save();});
 void sync.load();
}
