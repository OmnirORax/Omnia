import {createAutoColors} from './scene/autoColors.ts';
import {selectedDocumentText} from './text/export.ts';
import {bindColorSession} from './ui/colorSession.ts';
import {SYSTEM_MESSAGE} from './ui/systemMessage.ts';
import {DEFAULT_ORIGIN_DIRECTIONS,planarOriginDirections,originSides,sideAxes,toggleOriginSide,type OriginDirections} from './core/originDirections.ts';
import {ARROW_NUDGES} from './world/axisNudge.ts';
import {selectionLatch} from './ui/selectionLatch.ts';
import {capturingShortcut} from './ui/shortcuts.ts';
import {installPointerBindings,pointerActivation} from './ui/pointerBindings.ts';
import {nativeLayout,nativeAppearance} from './composer/runtime/historyBridge.ts';
import {navigationState} from './ui/navigationState.ts';
import {releaseShortcuts,installReleaseShortcuts,createHeldCommands} from './ui/releaseShortcuts';
import {reconnectBinder} from './core/connections';
import {WORLD_GESTURES,DOCUMENT_GESTURES} from './ui/gestureShortcuts';
import {shortcuts,assignAvailableDefault,installShortcutCapture,normalizeShortcut,shortcutEvent,worldBinding,worldShortcutId,matchesShortcut,type ShortcutDefinition} from './ui/shortcuts';
import {shortcutWindow} from './ui/shortcutWindow';
import {selectionCenter,applyGroupTargets} from './core/groupPlacement';
import {controlShortcutDefinitions,registerControlShortcutCatalog,shortcutContextFor,assignedShortcuts,installContextActions,registerContextActions,refreshContextActions} from './ui/contextActions';
import {aimFrame,aimFramePoint,axisCenter,activeWorldAxes,createAxis,shiftAxisOrigin,setSpatialOrigin,slotNode} from './core/axes.ts';
import {parseBrush,brushShape,SINGLE_BRUSH,type Brush} from './core/brush.ts';
import {handleContentViewShortcut} from './ui/contentViewShortcut.ts';
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
import {universalHistory,travelGlobalHistory} from './core/universalHistory.ts';
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
import {visualProperties,type Paint,type PaintField} from './properties/visual.ts';
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
import { paintNodes, adoptNodes, connectNodes, childNode, detachNode, removeNodes, toggleSubtree, toggleChildLevel, hierarchyAction } from './core/nodeOperations.ts';
import type { editDocument } from './text/editor.ts';
import {scenePanel,SCENE_TABS,type SceneTab} from './scene/panel.ts';
import { validateAsset, MAX_ASSET_BYTES, type VisualAsset } from './graph/assets.ts';
import { workspacePanel } from './ui/workspace.ts';
import { field } from './ui/fields.ts';
import { liveForm,flushLiveForms } from './ui/liveForm.ts';

try{shortcuts.initialize(localStorage);}catch{/* Session-only bindings when storage is unavailable. */}
installPointerBindings(()=>view?.inputContext==='rotate'?'world':view?.inputContext??'world');
const hierarchyCommands=createHeldCommands(releaseShortcuts,()=>[
 {binding:worldBinding('V'),run:command=>attempt(()=>view?.toggleHierarchy(command==='next',true))},
 {binding:worldBinding('Shift+V'),run:command=>attempt(()=>view?.toggleHierarchy(command==='next',false,true))},
],()=>[{id:'all',binding:worldBinding('Q')},{id:'next',binding:worldBinding('Shift+Q')}]);
installReleaseShortcuts(event=>{
 if(capturingShortcut())return false;
 if(/^(Control|Shift|Alt|Meta|AltGraph)$/.test(event.key)||event.isComposing)return false;
 if(matchesShortcut(event,worldBinding('Ctrl+S')))return true;
 if(event.target instanceof Element&&event.target.closest('button,a[href]')&&(event.key==='Enter'||event.key===' '))return false;
 const element=event.target instanceof Element?event.target:undefined,editor=element?.closest('.cm-editor'),typing=element?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
 if(element?.closest('input,textarea,select')||typing&&!editor)return matchesShortcut(event,worldBinding('Esc'));
 if(editor&&(event.ctrlKey||event.metaKey)&&!event.altKey&&/^[cxv]$/i.test(event.key))return false;
 if(editor&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&/^(Arrow|Home|End|Page)/.test(event.key))return false;
 if(editor&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key!=='Escape'&&!/^F\d+$/.test(event.key)&&!Object.values(shortcuts.getSnapshot().Document??{}).some(binding=>!!binding&&binding===shortcutEvent(event,'Document')))return false;
 if(!typing&&!element?.closest('[data-input-owner]')&&hierarchyCommands.match(event))return true;
 if(!typing&&!element?.closest('[data-input-owner]')&&Object.keys(ARROW_NUDGES).some(key=>matchesShortcut(event,worldBinding(key))))return false;
 if(!typing&&/^\d$/.test(event.key))return true;
 if(view?.selectingRange&&!typing&&matchesShortcut({...event,key:event.key,ctrlKey:false,metaKey:false,altKey:false,shiftKey:false} as KeyboardEvent,worldBinding('V')))return true;
 const omnic=!!element&&shortcutContextFor(element)==='Omnic';
 if(omnic&&!typing&&event.key.length===1&&event.key!==' ')return true;
 const keys=[...(!editor&&!omnic?worldShortcutActions(true).map(action=>({key:action.key??'',category:'Omnium' as const})):[]),...assignedShortcuts().filter(action=>editor?action.context==='Document':omnic?action.context==='Omnic':action.context==='Omnium').map(action=>({key:action.key,category:action.context==='Document'?'Document' as const:'Omnium' as const})),...(!editor?['V','Esc','.','F11','Ctrl+Z','Ctrl+Y','Ctrl+Shift+Z','Enter']:['F11']).map(key=>({key:worldBinding(key),category:'Omnium' as const}))];
 return keys.some(action=>matchesShortcut(event,action.key,action.category));
},event=>{const chord=hierarchyCommands.match(event);return chord?[chord.prefix]:[];},event=>{const chord=hierarchyCommands.match(event);if(chord)return {release:chord.run,cancel:()=>{}};const element=event.target instanceof Element?event.target:undefined;if(!matchesShortcut(event,originShortcutBinding())||element?.closest('input,textarea,select,[contenteditable],[data-input-owner],.cm-editor')||element&&shortcutContextFor(element)==='Omnic')return;return view?.beginOriginSet()??{release:()=>feedback('Point inside the world to set its origin.'),cancel:()=>{}};});
installShortcutCapture();
installPrimaryClickGate();
installBrowserShortcutGuard();
installValueDrag();
installCursorTracking();
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tools = element('tools'), status = element('status'), search = document.createElement('input');
search.id='find';search.type='search';search.placeholder='Find nodes…';search.setAttribute('aria-label','Find nodes');search.autocomplete='off';
type Target = Origin | Edge;
const isNode = (target: Target): target is Origin => 'born' in target;
const selection = createSelection<Target>((a, b) => isNode(a) && isNode(b) ? sameOrigin(a, b) : !isNode(a) && !isNode(b) && JSON.stringify(a) === JSON.stringify(b));
const selectedOrigins = () => selection.targets.filter(isNode);
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
window.addEventListener(SYSTEM_MESSAGE,event=>feedback((event as CustomEvent<string>).detail));
function attempt(action: () => void) { try { universalHistory.transaction(()=>{view?.commitSelection();action();}); } catch (error) { feedback(error instanceof Error ? error.message : String(error)); } }
function renderClose() { disposeTools?.();disposeTools=undefined;tools.hidden = true;updateUIAppearance(store.world.appearance);for(const document of documents.values())document?.previewAppearance(store.world); view?.update(store.world, selectedOrigins(), shown, selection.targets.filter((target): target is Edge => !isNode(target))); }
function close(){if(viewHistory.rendering){renderClose();return;}viewHistory.hideMenu();}
const menuFactories=new Map<string,(args:unknown[])=>void>();
function defineMenu<Args extends unknown[]>(kind:string,render:(...args:Args)=>void,atCursor=false,dismissOnOutside=true){
 menuFactories.set(kind,args=>render(...args as Args));
 return(...args:Args)=>{if(viewHistory.rendering){render(...args);return;}if(atCursor)menuPoint={...cursorPosition()};viewHistory.menu({kind,args,dismissOnOutside,point:{...menuPoint},selection:selection.targets as Target[]});};
}
function pick(origin: Origin, extend = false, toggle = false) { universalHistory.activeContext=`node:${key(origin)}`;universalHistory.contextPath=['omnium',universalHistory.activeContext]; selection.pick(origin, extend, toggle);followSelectionOrigin();refresh(); }
function selectedNodes(world: World) { const ids=new Set(selectedOrigins().map(key));return world.nodes.filter(node=>ids.has(key(node.origin))); }
const view = (() => {
  try {
    return createWorld(element('world'), {
      toggleAllContent(){store.change(world=>{world.settings??={latticeScale:1,names:'selection'};world.settings.names=world.settings.names==='all'?'selection':'all';});},
      cameraChanged:state=>store.setCamera(state),
      placeOrigin(plan){attempt(()=>store.change(world=>{const reference=view!.reference,directions=planarOriginDirections(reference.directions,activeWorldAxes(reference)),frame=setSpatialOrigin(world,plan.anchor,plan.position,plan.right,plan.up,'camera');frame.directions=structuredClone(directions);frame.activeAxes=sideAxes(directions.sides!);delete frame.packing;if(plan.aim)aimFramePoint(world,frame.id,plan.aim);}));},
      originChord(){if(pointerActivation()==='gesture:origin-rotation'){releaseShortcuts.consume(originShortcutBinding());return true;}const binding=originShortcutBinding();if(!releaseShortcuts.held(binding))return false;releaseShortcuts.consume(binding);return true;},
      committedSelection:()=>selection.committed.filter(isNode),
      hover(origin,edge){selection.hover(edge??origin);return selectedOrigins();},
      pick, picking: () => selection.requesting,
      range(origins, extend) { if (!selection.requesting) { selection.hover(undefined);selection.set(extend ? [...selection.committed.filter(isNode), ...origins] : origins);followSelectionOrigin();refresh(); } },
      clear() { if (selection.requesting) return; viewHistory.hideMenu(true); selection.clear(); refresh(); },
      menu(origin, point, edge) { if (selection.requesting) {if(edge)selection.cancel();else return;} message = ''; if(edge)selection.set([edge]);else if(origin)selection.set(selection.has(origin)?selectedOrigins():[origin]);else if(selection.committed.length<2)selection.clear(); menuPoint = point; refresh(); context(undefined,origin,edge); },
      navigationSettings:()=>openNavigation(),
      rotateCommit(nodes,frame){store.change(world=>{if(nodes.size){applyGroupTargets(world,new Map([...nodes].map(([id,n])=>[id,n.position])));for(const node of world.nodes){const next=nodes.get(key(node.origin));if(next)node.orientation={...next.orientation};}}if(frame){const found=world.axes?.find(f=>f.id===frame.id);if(!found&&frame.id==='@user'){const basis=view!.frameBasis();const created=setSpatialOrigin(world,undefined,frame.state.origin,basis.right,basis.up);Object.assign(created,frame.state,{directed:true});}else if(!found)throw Error('The frame was removed.');else Object.assign(found,frame.state,{directed:true});}});},
      transform(origins,rotation,pivot,layout){store.change(world=>transformNodes(world,origins,rotation,pivot,layout));},
      groupMove(targets){store.change(world=>{applyGroupTargets(world,targets);});followSelectionOrigin();},
      move(origins, delta) { store.change(world => {translate(view!.operationWorld(world), origins, delta);});followSelectionOrigin(); },
      connectDrag(source,target,position){let child:Origin|undefined;store.change(world=>{child=connectNodes(world,source,target,position);});if(child)selection.set([child]);refresh();},
      adopt(origins, owner, delta) { store.change(world => adoptNodes(view!.operationWorld(world), origins, owner, delta)); },
      park(origin, position,origins) { message = ''; store.change(world => {const node=locate(world,origin)!;translate(view!.operationWorld(world),origins,position.map((v,i)=>v-node.position[i]) as Vec3);});followSelectionOrigin(); return store.world; },
      paint(positions,source,axis,parent){store.change(world=>{paintNodes(world,positions,source,axis,parent);});},
      selectionOrigin(ids,position){assignOrigin(ids[0],position);},
      nodeOrigin(origin){assignOrigin(origin,locate(store.world,origin)!.position);},
      origin(id,position){const frame=store.world.axes?.find(frame=>frame.id===id)??view?.reference;if(frame)assignOrigin(frame.ends[0],position);},
      axis(first,second,up){store.change(world=>{createAxis(world,first,second,up);});selection.clear();refresh();},
      slot(origins,axis,point){store.change(world=>{slotNode(view!.operationWorld(world),origins[0],axis,point,origins);});},
      focusAxis(id){selection.clear();store.change(world=>{world.activeAxis=id;});},
      connect(origin){connectNode(origin);},
      hierarchy(origins,nextOnly=false,contentOnly=false){if(contentOnly)return hierarchyAction(store.world,origins,nextOnly,true);let affected:Origin[]=[];store.change(world=>{affected=hierarchyAction(world,origins,nextOnly);});return affected;},
      subtree(origin,nextOnly=false) { store.change(world => nextOnly?toggleChildLevel(world,origin):toggleSubtree(world, origin)); },
      edge(edge) { selection.cancel();selection.set([edge]); refresh(); reconnectEdge(edge); },
      feedback,
    });
  } catch { status.textContent = 'The 3D renderer could not start. WebGL is required; your saved world is preserved.'; return undefined; }
})();

function previewPaint(target:VisualTarget,origins:readonly Origin[],patch?:Paint){
 showAppearancePreview(view?.previewPaint(target,origins,patch)??store.world);
}
function showAppearancePreview(candidate:World){
 updateUIAppearance(candidate.appearance);for(const document of documents.values())document?.previewAppearance(candidate);
}
function refresh(reason?:'document') {
  refreshContextActions();
  requestFormSync();
  updateUIAppearance(store.world.appearance);
  for (const document of documents.values()) document?.refreshAppearance();
  const query = search.value.trim().toLocaleLowerCase();
  const atlas=visibleInAtlas(store.world);
  shown = query ? new Set(store.world.nodes.filter(node => node.label.toLocaleLowerCase().includes(query)).map(node => key(node.origin))) : atlas;
  if(atlas&&shown)shown=new Set([...shown].filter(id=>atlas.has(id)));
  selection.retain(target => isNode(target) ? !!locate(store.world, target) : target.kind === 'part' ? !!locate(store.world, target.owner)?.parts[target.index] : target.kind === 'variant' ? !!locate(store.world,target.owner)?.variantOf : target.kind==='child'?!!locate(store.world,target.child)?.parent&&sameOrigin(locate(store.world,target.child)!.parent!,target.owner):!!store.world.relationships?.[target.index]);
  if(reason==='document')view?.documentChanged(store.world);else view?.update(store.world, selectedOrigins(), shown, selection.targets.filter((target): target is Edge => !isNode(target)));
  element('empty').hidden = store.world.nodes.length > 0;
  if (view){statusText.data=store.message||message;reloadModuleButton.hidden=!reloadForModule;}
}
store.subscribe(refresh);
store.subscribeReplace(()=>view?.restoreCamera(store.world.camera));
universalHistory.subscribe(requestFormSync);
function open(title: string,scopeSearch?:(query:string)=>void,globalOnly=false) {
  disposeTools?.();disposeTools=undefined;tools.replaceChildren(); tools.hidden = false;
  const row = document.createElement('div'); row.className = 'title';
  const caption = document.createElement('span'); caption.textContent = title;
  const back = document.createElement('button'); back.textContent = '×'; back.setAttribute('aria-label', 'Close'); back.onclick = close;
  row.append(caption, back); tools.append(row);windowDrag(tools,row,()=>{menuPoint={x:parseFloat(tools.style.left)||0,y:parseFloat(tools.style.top)||0};});
  const find = document.createElement('input'); find.type = 'search';find.value=viewHistory.state.menu?.query??''; find.placeholder = globalOnly?'Global search…':'Section search…'; find.setAttribute('aria-label',globalOnly?'Global search':'Search current section');
  const globalResults=document.createElement('div');globalResults.className='settings-search-results';
  const filter = () => {
    const query = find.value.trim().toLocaleLowerCase();viewHistory.query(find.value);
    if(scopeSearch){scopeSearch(find.value);positionMenu();return;}
    for (const item of Array.from(tools.children)) if (item instanceof HTMLButtonElement) item.hidden = item.dataset.searchOnly === 'true' && !query || !!query && !`${item.textContent} ${item.dataset.keywords ?? ''}`.toLocaleLowerCase().includes(query);
    for(const form of tools.querySelectorAll('form'))if(!globalResults.contains(form))for(const row of form.children)if(row instanceof HTMLElement)row.hidden=!!query&&!searchMatches(row.textContent??'',query);
    globalResults.replaceChildren();
    positionMenu();
  };
  find.oninput = filter;
  find.onkeydown = event => { if (event.key === 'Enter') { const match = Array.from(tools.children).find(item => item instanceof HTMLButtonElement && !item.hidden) as HTMLButtonElement | undefined; if (match) { event.preventDefault(); match.click(); } } };
  const searchRow=document.createElement('div');searchRow.className='menu-searches';searchRow.append(find);if(!globalOnly){const globalFind=document.createElement('input');globalFind.type='search';globalFind.placeholder='Global search…';globalFind.setAttribute('aria-label','Global search');let globalRender:ReturnType<typeof searchRenderer>|undefined;globalFind.oninput=()=>{if(globalFind.value.trim()){globalRender??=searchRenderer(globalResults);globalRender(globalFind.value);}else globalResults.replaceChildren();positionMenu();};searchRow.prepend(globalFind);}tools.append(searchRow,globalResults);
  requestAnimationFrame(() => { if (!find.isConnected) return; filter(); });
  positionMenu();return find;
}
function positionMenu() {
  requestAnimationFrame(() => {
    tools.style.left = `${Math.max(8, Math.min(menuPoint.x, innerWidth - tools.offsetWidth - 8))}px`;
    tools.style.top = `${Math.max(8, Math.min(menuPoint.y, innerHeight - tools.offsetHeight - 8))}px`;
  });
}
function shortcutCaption(control:HTMLElement,label:string,defaultKey?:string){
 if(defaultKey){control.dataset.shortcutLabel=label;control.dataset.worldShortcut=defaultKey;}
 const binding=defaultKey?(worldBinding(defaultKey)||(!normalizeShortcut(defaultKey)?defaultKey:'')):'';control.textContent=binding?`${label} (${binding})`:label;
}
function button(label: string, action: () => void, parent = tools, defaultKey?:string) {
  const b = document.createElement('button'); shortcutCaption(b,label,defaultKey); b.onclick = () => attempt(action); parent.append(b); return b;
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
  liveForm(form, group => attempt(() => store.change(apply, group)),()=>{close();view?.focusInput();});
  watchFields(form,inputs.map((input,index)=>({input,read:()=>{const node=locate(store.world,origins[0]);if(!node)return undefined;if(capabilityKey==='move'&&origins.length>1)return node.position[index]-start[index];return capabilities(resolveNodeSettings(store.world,inherited(node,store.world))).find(c=>c.key===capabilityKey)?.properties[index].read();}})));
  tools.append(form); positionMenu(); inputs[0].focus(); if (inputs[0].type === 'text') inputs[0].select();
});
function toggleOriginAxis(axis:number,sign?:1|-1){const frame=view?.reference;if(!frame)return;changeOriginDirections(toggleOriginSide(frame.directions??DEFAULT_ORIGIN_DIRECTIONS,activeWorldAxes(frame),axis,sign));}
function changeOriginDirections(next:OriginDirections){store.change(world=>{const frame=view?.reference;if(!frame)return;const saved=world.axes?.find(f=>f.id===frame.id);if(saved){saved.directions=structuredClone(next);saved.activeAxes=sideAxes(next.sides??[]);}else world.userDirections=structuredClone(next);});}
const openOriginDirections=defineMenu('origin-directions',()=>{if(!view)return;open('Origin directions');const host=document.createElement('div');tools.append(host);void loadEditor(()=>import('./ui/originDirections.tsx')).then(({mountOriginDirections})=>{if(!host.isConnected)return;disposeTools=mountOriginDirections(host,()=>view!.reference,store.subscribe,changeOriginDirections,()=>store.world,(axis,sign)=>attempt(()=>toggleOriginAxis(axis,sign)));positionMenu();}).catch(error=>feedback(String(error)));positionMenu();},false,false);
function toggleOriginSymmetry(){if(!view)return;const directions=view.reference.directions??DEFAULT_ORIGIN_DIRECTIONS;changeOriginDirections({...directions,symmetry:!directions.symmetry});openOriginDirections();}
function editLabel(){
 selection.commitTargets();
 const edge=selection.targets.find((target):target is Edge=>!isNode(target));if(edge){edgeContext(edge);const input=tools.querySelector<HTMLInputElement>('form input[type=text]');input?.focus();input?.select();return;}
 const hovered=view?.hoveredOrigin;view?.cancel();
 if(hovered&&selectedOrigins().length<2&&!selection.has(hovered))pick(hovered);
 if(!selectedOrigins().length){feedback('Point to or select a node to name.');return;}
 editCapability('label');
}
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
function followSelectionOrigin(){const group=selection.committed.filter(isNode);if(group.length>1)assignOrigin(group[0],selectionCenter(store.world,group));}
function assignOrigin(anchor:Origin|undefined,position:Vec3){const basis=view!.frameBasis(),axes=[...activeWorldAxes(view!.reference)],directions=view!.reference.directions;store.change(world=>{const frame=setSpatialOrigin(world,anchor,position,basis.right,basis.up);frame.activeAxes=axes;delete frame.packing;if(directions)frame.directions=structuredClone(directions);});}
function focusSelection(){view?.positionUser();}
function relationFrame(origin?:Origin){
 const world=store.world,active=world.axes?.find(frame=>frame.id===world.activeAxis),anchor=origin??active?.ends[0];
 return active?.ends.length===2&&(!origin||active.ends.some(end=>sameOrigin(end,origin)))?active:[...(world.axes??[])].reverse().find(frame=>frame.ends.length===2&&anchor&&frame.ends.some(end=>sameOrigin(end,anchor)));
}
function enterNodePerspective(origin:Origin){
 const relation=relationFrame(origin);if(!view||!relation)return;view.enterNode(origin,relation.id);
}
function aimOrigin(target?:Origin|Vec3){const point=target??view?.originAimPoint();let id=store.world.activeAxis;if(!id&&view){const reference=view.reference,basis=view.frameBasis();store.change(world=>{const frame=setSpatialOrigin(world,undefined,axisCenter(world,reference),basis.right,basis.up);frame.directions=structuredClone(reference.directions);frame.activeAxes=[...activeWorldAxes(reference)];});id=store.world.activeAxis;}if(!id)return;if(point){store.change(world=>Array.isArray(point)?aimFramePoint(world,id!,point as Vec3):aimFrame(world,id!,point));return;}requestNode(node=>store.change(world=>aimFrame(world,id!,node)));}

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
    for (const edge of selection.targets.filter((value): value is Edge => !isNode(value)).sort((a,b) => ('index' in b?b.index:-1)-('index' in a?a.index:-1))) {
      if (edge.kind === 'relationship') world.relationships?.splice(edge.index,1);
      else if (edge.kind === 'variant') detachNode(world,edge.owner);
      else if(edge.kind==='child')detachNode(world,edge.child);
      else locate(world,edge.owner)?.parts.splice(edge.index,1);
    }
    removeNodes(world, selectedOrigins());
  });
  selection.hover(undefined);selection.clear(); close(); refresh();
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

// The unused first argument keeps saved context-menu view descriptors readable.
const context=defineMenu('context',(_position: Vec3|undefined,origin?:Origin,edge?:Edge)=>{
  if (edge) { edgeContext(edge); return; }
  open(origin ? `${selectedOrigins().length} selected` : 'Omnium');
  if (!origin) { button('Create structure', () => {close();view?.toggleCreation();},tools,'W'); button('Omnic',()=>openComposer(undefined)); button('Library · Atlas',openLibrary); button('👁', appearance).setAttribute('aria-label', 'Appearance'); return; }
  const node = selectedNodes(store.world)[0]; if (!node) return;
  for (const capability of capabilities(node).filter(c => !['color','carrier','move'].includes(c.key))) button(capability.label, () => editCapability(capability.key),tools,capability.key==='label'?'L':undefined);
  button('👁', appearance).setAttribute('aria-label', 'Appearance');
  for (const capability of capabilities(node).filter(c => ['color','carrier'].includes(c.key))) {
    const shortcut = button(`👁 ${capability.label}`, () => editCapability(capability.key)); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = capability.properties.map(p => p.property.label).join(' ');
  }
  if (selectedOrigins().length === 1) { const shortcut = button('👁 Visual', visuals); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = 'image SVG GLB character size text'; }
  if (selectedOrigins().length === 1) { button('Omnic',()=>openComposer(selectedOrigins()[0])); button('Library · Atlas',openLibrary); button('Composition', parts); button('Document', openDocument,tools,'D'); button('Node tools…', nodeTools); }
  button('Include…', chooseReference);
  button(node.invariant ? '⚬ Release invariant' : '⚬ Activate invariant', () => {
    if(!node.invariant&&!node.parts.length&&!node.omnic&&!node.omnicEdits){openComposer(node.origin);return;}
    store.change(world => { for (const target of selectedNodes(world)) setInvariant(world, target, !node.invariant); }); close();
  });
  for (const [name, action] of [['Scene', openScene], ['World', worldControls]] as const) { const shortcut = button(`👁 ${name}`, action); shortcut.dataset.searchOnly = 'true'; }
  button('Position User', () => {focusSelection();close();},tools,'P');
  if(relationFrame(selectedOrigins()[0]))button('View from node',()=>{enterNodePerspective(selectedOrigins()[0]);close();});
});
const immersive=createImmersiveMode({
 keyboard:(navigator as Navigator&{keyboard?:KeyboardLock}).keyboard,
 fullscreen:()=>!!document.fullscreenElement,
 enter:()=>document.documentElement.requestFullscreen(),exit:()=>document.exitFullscreen(),
 changed:()=>{requestFormSync();for(const control of document.querySelectorAll<HTMLButtonElement>('[data-immersive-mode]')){control.textContent=immersiveLabel();control.disabled=immersive.phase==='entering'||immersive.phase==='leaving';}},
});
function immersiveLabel(){return immersive.phase==='entering'?'Starting immersive mode…':`${immersive.phase==='active'?'Exit':'Enter'} immersive mode · ${worldBinding('F11')||'—'}`;}
function immersiveAction():SearchAction{return {label:immersiveLabel(),keywords:'world immersive fullscreen keyboard lock chrome ctrl f4 f11',available:immersive.supported,run:()=>{if(immersive.phase==='off')enableBrowserShortcuts(false);void (immersive.phase==='active'?immersive.leave():immersive.enter()).catch(error=>feedback(error.message));}};}
document.addEventListener('fullscreenchange',()=>immersive.fullscreenChanged());
window.addEventListener('pagehide',()=>{void immersive.leave().catch(()=>{});});
// Capture F11 before local handlers; locked Escape keeps its normal app handlers.
window.addEventListener('keydown',event=>{if(immersive.supported&&!browserShortcutsEnabled())handleImmersiveShortcut(event,()=>immersiveAction().run(),worldBinding('F11'));},true);
const settingsCatalog=createSettingsCatalog<SearchSetting>();
const worldSettings=settingsCatalog.define('world',()=>[
    {label:'Lattice scale',keywords:'world lattice',definition:{key:'latticeScale',label:'Lattice scale',kind:'number' as const,min:1e-9},read:()=>store.world.settings?.latticeScale??1,write:(world:World,value:string|number|boolean)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.latticeScale=Number(value);}},
    {label:'Content view',keywords:'world names labels glyph contents visibility contour expansion all on off focused selection v shortcut',definition:{key:'names',label:'Content view',kind:'toggle'},read:()=>store.world.settings?.names==='all',write:(world:World,value:Value)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.names=value?'all':'selection';}},
    {label:'Browser shortcuts',keywords:'world browser chrome keyboard shortcuts',definition:{key:'browserShortcuts',label:'Browser shortcuts',kind:'toggle'},read:browserShortcutsEnabled,set:value=>{enableBrowserShortcuts(Boolean(value));if(value)void immersive.leave().catch(error=>feedback(error.message));}},
]);

function hierarchyShortcut(nextOnly=false){view?.toggleHierarchy(nextOnly);}
window.addEventListener('keydown',event=>{
 const target=event.target,typing=target instanceof Element&&!!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],.cm-editor,[data-input-owner]');
 if(!typing&&matchesShortcut(event,worldBinding('Shift+V'))){event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)attempt(()=>view?.toggleHierarchyIsolation());return;}
 handleContentViewShortcut(event,typing,()=>attempt(()=>view?.toggleContentView()),worldBinding('V'),view?.selectingRange);
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
  const visualEntries=(['nodeDefaults','text','background',...(origins.length?['nodeText' as const,'nodes' as const]:[])] as const).flatMap(target=>(target==='nodeDefaults'||target==='nodes'?NODE_VISUAL_PROPERTIES.map(p=>({...p,key:p.id})):visualProperties(target==='text'||target==='nodeText',readPaint(store.world,target,origins[0]))).map(definition=>({label:`${target} · ${definition.label}`,keywords:`eye appearance visuals ${target==='nodeDefaults'?'global nodes sphere body':''}`,definition,preview:(value:Value|undefined)=>previewPaint(target,origins,value===undefined?undefined:{[definition.key]:value}),read:()=>readPaint(store.world,target,origins[0])[definition.key as PaintField]!,write:(world:World,value:string|number|boolean)=>writePaint(world,target,origins,{[definition.key]:value})})));
  const entries:SearchSetting[]=[
    ...nodeEntries,...visualEntries,

    ...([{key:'prompt',label:'Scene prompt',kind:'text'},{key:'variable',label:'Scene variable',kind:'text'},{key:'source',label:'Scene prompt input',kind:'select',options:[{id:'label',label:'Label'},{id:'notes',label:'Document'},{id:'label-and-notes',label:'Label + document'}]}] as Property[]).map(definition=>({label:definition.label,keywords:'scene image generation prompt source variable',definition,read:()=>(store.world.scene??defaultScene())[definition.key as 'prompt'|'variable'|'source'],write:(world:World,value:Value)=>{world.scene??=defaultScene();Object.assign(world.scene,{[definition.key]:value});}})),
    ...Object.entries(vfxFunction.inputs).map(([key,binding])=>({label:binding.definition.label,keywords:`scene ${key}`,definition:{...binding.definition,key},read:()=>binding.read({sceneVfx:(store.world.scene??defaultScene()).vfx}),write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx=binding.write({sceneVfx:world.scene.vfx},value).sceneVfx;}})),
    ...audioDefinitions.map(d=>({label:d.property.label,keywords:'scene audio sound pulse bounce blinking flash delay cooldown',definition:d.property,read:()=>((store.world.scene??defaultScene()).vfx.audioResponse[d.key] as number)*d.scale,write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx.audioResponse[d.key]=Number(value)/d.scale;}})),
    ...NORMALIZATION_FIELDS.map(d=>({label:d.label,keywords:'scene normalization normalize correction threshold limit',definition:{key:normalizationProperty(d.key),label:d.label,kind:d.kind,...(d.kind==='number'?{min:d.min,max:d.max,step:.01}:{})},read:()=>(store.world.scene??defaultScene()).normalization[d.key],write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.normalization=editNormalization(world.scene.normalization,{[d.key]:value});}})),
  ];
  return entries;
}
type SearchSetting={label:string;keywords:string;definition:Property;read:()=>Value|undefined;write?:(world:World,value:Value)=>void;set?:(value:Value)=>void;preview?:(value:Value|undefined)=>void};
type SearchAction={label:string;key?:string;keywords:string;run:()=>void;available?:boolean};
function spaceActions():SearchAction[]{
 const relation=relationFrame(),frame=view?.reference,active=!!store.world.activeAxis;
 return [
 {label:'Face origin toward position',key:'Ctrl+X',keywords:'world origin axes direction aim face align',run:aimOrigin,available:active},
 {label:'Brush',key:'Shift+X',keywords:'world paint cube sphere geometry recursive unit',run:openBrush},
 {label:view?.hierarchyIsolated?'Show all hierarchies':'Hide nodes outside active hierarchy',key:'Shift+V',keywords:'isolate hierarchy visibility hide show branch',run:()=>view?.toggleHierarchyIsolation()},
 {label:'Coordinates',key:'C',keywords:'world cursor brush coordinates xy xyz readout labels',run:()=>view?.toggleCoordinates()},
 {label:'Position User',key:'P',keywords:'world camera node axis reference origin focus align',run:focusSelection,available:true},
 {label:'View from first node',keywords:'world camera perspective occupy endpoint depth z',run:()=>{if(relation)enterNodePerspective(relation.ends[0]);},available:!!relation},
 {label:'View from second node',keywords:'world camera perspective occupy endpoint depth z',run:()=>{if(relation?.ends[1])enterNodePerspective(relation.ends[1]);},available:!!relation},
 {label:'Return to user view',keywords:'world camera perspective user leave node',run:()=>view?.leaveNode(),available:!!view?.inNodeView},
 ...(frame?[0,1].map(axis=>({label:`${sideAxes(originSides(frame.directions,activeWorldAxes(frame))).includes(axis)?'✓ ':''}${'XYZ'[axis]} axis`,keywords:'world active axes plane line volume constrain',run:()=>toggleOriginAxis(axis)})):[]),
 ...([{label:`Selection depth · ${view?.selectionDepth??8}`,keywords:'selection volume box depth',run:()=>{const value=prompt('Selection depth',String(view?.selectionDepth??8));if(value!==null)view?.setSelectionDepth(Number(value));}}]),
 {label:'Shift origin…',keywords:'world plane origin elevation level offset xyz',available:active,run:()=>{const value=prompt('Origin shift: X Y Z','0 0 0');if(value===null)return;const offset=value.trim().split(/[ ,]+/).map(Number);if(offset.length!==3||offset.some(n=>!Number.isSafeInteger(n)))throw Error('Use three whole numbers.');store.change(world=>shiftAxisOrigin(world,world.activeAxis!,offset as Vec3));}},
 {label:'Origin directions',keywords:'origin axes symmetry half unit dial placement',run:openOriginDirections},
 {label:'Use User reference',keywords:'world axis origin reference deactivate',run:()=>store.change(world=>{delete world.activeAxis;}),available:active},
 {label:'Delete origin frame',keywords:'world axis origin reference remove constraints',run:()=>store.change(world=>{world.axes=world.axes?.filter(frame=>frame.id!==world.activeAxis);delete world.activeAxis;}),available:active},
 ];
}
const openShortcuts=defineMenu('shortcuts',()=>{
 view?.cancel();let shortcutView:ReturnType<typeof shortcutWindow>|undefined;const find=open('Shortcuts',query=>shortcutView?.filter(query));let defaults:ShortcutDefinition[]=[],omnicDefaults:()=>ShortcutDefinition[]=()=>[],ready=false;
 const read=()=>{const native=worldShortcutActions(true).flatMap(action=>(action.defaultKey||action.key===''||action.id===worldShortcutId('R')||action.id===worldShortcutId('W')||action.id===worldShortcutId('O'))?[{category:'Omnium' as const,id:action.id,label:action.label,defaultKey:action.defaultKey,scope:action.scope,gesture:'gesture' in action?action.gesture:undefined}]:[]);
 const global:ShortcutDefinition[]=[['V','Content view'],['F11','Fullscreen'],['Esc','Cancel'],['.','Toggle actions'],['Ctrl+Z','Undo'],['Ctrl+Y','Redo'],['Ctrl+Shift+Z','Redo (alternate)'],['Enter','Apply alignment'],['ArrowUp','Move along axes · up'],['ArrowDown','Move along axes · down'],['ArrowLeft','Move along axes · left'],['ArrowRight','Move along axes · right']].map(([key,label])=>({category:'Omnium',id:worldShortcutId(key),defaultKey:key,label,scope:key==='F11'?'application':key.includes('Ctrl')||key==='.'?'applicationExceptDocument':undefined}));
 return [...new Map([...native,...global,...controlShortcutDefinitions(),...WORLD_GESTURES.map(item=>item.id==='gesture:hierarchy-contents'?{...item,gesture:worldBinding('V')&&worldBinding('Q')?`Hold ${worldBinding('V')} + ${worldBinding('Q')}`:''}:item),...DOCUMENT_GESTURES,...defaults,...omnicDefaults()].map(item=>[`${item.category}/${item.id}`,item])).values()].sort((a,b)=>a.label.localeCompare(b.label));};
 const root=document.createElement('div');root.className='shortcut-window';tools.append(root);const window=shortcutWindow(root,read,()=>ready,find);shortcutView=window;disposeTools=window.dispose;
 void Promise.all([import('./text/editor'),import('./composer/runtime/featureActions'),import('./composer/runtime/workspaceActions')]).then(([doc,features,workspace])=>{
 defaults=doc.documentShortcutCatalog();omnicDefaults=()=>features.FEATURE_ACTIONS.filter(action=>!action.id.startsWith('document.')&&!action.id.startsWith('world.')).flatMap(action=>{const key=normalizeShortcut(workspace.shortcutBinding(action.id,{})),current=normalizeShortcut(workspace.shortcutBinding(action.id,shortcuts.getSnapshot().Omnic??{}));return key||current?[{category:'Omnic' as const,id:action.id,label:action.label,defaultKey:key??'',currentKey:current??'',scope:action.scope}]:[];});ready=true;
 if(root.isConnected)window.refresh();}).catch(error=>feedback(String(error)));
});
function openAccount(){void import('./backend/panel.ts').then(module=>module.openAccountPanel()).catch(error=>feedback(String(error)));}
function searchActions():SearchAction[]{return [
 {label:'Account / Cloud',keywords:'account login sign in sign out cloud permissions members',run:openAccount},
 ...['Score tracker','Questboard','Leaderboard'].map(tab=>({label:`♾️ · ${tab}`,keywords:`infinity ∞ metrics timer score quests stars leaderboard ${tab}`,run:()=>{void import('./metrics/panel.ts').then(module=>module.openInfinityPanel(tab,openAccount)).catch(error=>feedback(String(error)));}})),
 {label:'Shortcuts',keywords:'keyboard shortcuts hotkeys keybindings controls bindings',run:openShortcuts},
 immersiveAction(),
 ...spaceActions(),
 ...SCENE_TABS.map(([tab,label])=>({label:`Scene · ${label}`,keywords:`scene ${tab} ${tab==='audio'?'system audio sound connect code import':tab==='image'?'wallpaper background import paste download library private cloud files upload palette dominant theme colors':tab==='normalization'?'normalization correction thresholds':tab==='prompt'?'cloud generate generation history':''}`,run:()=>openScene(tab)})),
 ...VISUAL_TARGETS.map(([target,label])=>({label:`Visuals · ${label}`,keywords:`eye appearance visuals ${target==='nodeDefaults'?'global node sphere body':target==='text'?'font import typeface':target==='background'?'background ui surfaces':''}`,run:()=>openVisualSettings(target,[...selectedOrigins()],label),available:(target!=='nodes'&&target!=='nodeText')||!!selectedOrigins().length})),
 ...CAMERA_ACTIONS.map(([id,label])=>({label:`Camera · ${label}`,keywords:`camera navigation ${id}`,run:()=>view?.camera(id)})),
 {label:'Workspace · import / export / restore',keywords:'workspace file json backup download upload everything cloud private shared draft save load',run:openWorkspace},
 {label:'Omnic composer',keywords:'node object composition create edit',run:()=>openComposer(selectedOrigins()[0])},
 {label:'Library · Atlas',keywords:'library atlas objects presets',run:openLibrary},
 {label:'Appearance · Visuals',keywords:'eye visuals colour color text nodes sphere body backgrounds font typeface',run:appearance},
 {label:'Scene',keywords:'scene wallpaper image audio normalization normalize waves pulse prompt',run:openScene},
 {label:'World',keywords:'world lattice names labels visibility',run:worldControls},
 {label:'Camera & rotation',keywords:'camera navigation 3d orbit look pan walk rotation sensitivity',run:openNavigation},
 {label:'History',keywords:'history undo redo scope steps',run:openHistory},
 {label:'Undo',keywords:'undo history mb4 ctrl z control z',run:()=>travelHistory('undo')},
 {label:'Redo',keywords:'redo history mb5 ctrl y control y',run:()=>travelHistory('redo')},
 {label:'Create structure',key:'W',keywords:'add new node structure',run:()=>view?.toggleCreation(),available:!!view},
 {label:'Document',key:'D',keywords:'node document text notes writing',run:openDocument,available:!!selectedOrigins().length},
 {label:'Composition',keywords:'node parts include references invariants',run:parts,available:!!selectedOrigins().length},
 {label:'Node tools',keywords:'node child parent copy variants attach detach hide connect remove',run:nodeTools,available:!!selectedOrigins().length},
 {label:'Node visual',keywords:'import image svg glb character object mesh show text size',run:visuals,available:!!selectedOrigins().length},
 {label:'Show all nodes',keywords:'show hidden visibility expand collapse',run:()=>{store.change(world=>{for(const node of world.nodes){node.hidden=false;node.collapsed=false;}});close();refresh();}},
 {label:'Fit all',keywords:'camera zoom fit all world',run:()=>{view?.focus(store.world.nodes.map(node=>node.origin),true);close();}},
];}
function appendSetting(parent:HTMLElement,item:SearchSetting,label=item.definition.label){
 const form=document.createElement('form'),control=field({...item.definition,label},item.read()??'');form.append(control.row);parent.append(form);
 if(control.input instanceof HTMLInputElement&&control.input.type==='color'&&item.preview){bindColorSession(control.input,{read:()=>String(item.read()),preview:value=>item.preview!(value),cancel:()=>item.preview!(undefined),commit:value=>attempt(()=>{if(item.set)item.set(value);else store.change(world=>item.write!(world,value));})});}else liveForm(form,group=>attempt(()=>{if(item.set)item.set(control.value());else store.change(world=>item.write!(world,control.value()),group);}));
 watchFields(form,[{input:control.input,read:item.read}]);
}
function searchRenderer(results:HTMLElement){
 return(query:string)=>{
  const settings=settingsCatalog.all().map(item=>({item,index:searchIndex(item)})),actions=searchActions().map(item=>({item,index:searchIndex(item)}));
  results.replaceChildren();if(!query.trim())return;let count=0;
  for(const {item,index}of actions)if(searchMatches(index,query)){const control=document.createElement('button');control.type='button';shortcutCaption(control,item.label,item.key);control.disabled=item.available===false;control.onclick=()=>attempt(item.run);if(item.keywords.includes('keyboard lock'))control.dataset.immersiveMode='';results.append(control);count++;}
  for(const {item,index}of settings)if(searchMatches(index,query)){
   appendSetting(results,item,item.label);count++;
  }
  if(!count){const empty=document.createElement('output');empty.textContent='No matches';results.append(empty);}
  requestFormSync();positionMenu();
 };
}
const searchSettings=defineMenu('search',()=>{
 const results=document.createElement('div');results.className='settings-search-results';const render=searchRenderer(results),input=open('Search',render,true);tools.append(results);if(input.value)render(input.value);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();results.querySelector<HTMLElement>('input,select,button:not(:disabled)')?.focus();}});positionMenu();input.focus();
},true);
let nodeSearchView:ReturnType<typeof panel>|undefined;
const createNodeSearch=viewHistory.defineWindow('nodeSearch',()=>{
 const window=panel('Find nodes',()=>{search.value='';nodeSearchView=undefined;refresh();});
 nodeSearchView=window;window.root.classList.add('node-search-panel');window.body.append(search);
 requestAnimationFrame(()=>{if(search.isConnected){search.focus();search.select();}});
 return window;
});
function openNodeSearch(){
 view?.cancel();close();
 if(nodeSearchView?.root.isConnected){search.focus();search.select();return;}
 createNodeSearch();
}
window.addEventListener('keydown',event=>{
 if(capturingShortcut()||event.isComposing||event.defaultPrevented||!matchesShortcut(event,worldBinding('Ctrl+S')))return;
 event.preventDefault();event.stopImmediatePropagation();if(!event.repeat)runWorldAction(worldShortcutId('Ctrl+S'));
},true);
let draftControl:HTMLElement|undefined;
let saveSharedDraft:(()=>Promise<void>)|undefined;
let workspaceView: ReturnType<typeof workspacePanel> | undefined;
function openWorkspace(restore?:ViewSpec) {
  if(!viewHistory.performing){viewHistory.perform(()=>openWorkspace(restore));return;}
  renderClose(); if (workspaceView?.root.isConnected) { close();workspaceView.root.focus(); return; }
  workspaceView = workspacePanel({ account:openAccount, omnic:()=>openComposer(),atlas:openLibrary,draft:draftControl, selected: () => selectedOrigins().map(origin => JSON.stringify(origin)), read: () => store.world, replace: world => { store.replace(world); selection.clear(); search.value = ''; refresh(); }, recover: () => { store.recover(); selection.clear(); search.value = ''; refresh(); }, beforeReplace: () => {
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
  sceneView = scenePanel({account:openAccount, subscribe:store.subscribe, read: () => store.world, selected: ()=>restore?.selection as Origin[]??selectedOrigins(), change: (edit, group) => store.change(edit, group), preview: candidate => view.session.update(candidate, selectedOrigins()[0]), session: view.session, feedback },tab);
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
    viewHistory.perform(()=>{const document=editDocument(origin, () => store.world, text => store.changeDocument(origin,text,`document:${id}`), feedback, () => documents.delete(id));documents.set(id,document);if(document)viewHistory.adopt(`document:${id}`,{kind:'document',args:[origin]},document,restore);},actionId);
  }).catch(error => {viewHistory.failed(restore,error);feedback(error instanceof Error ? error.message : String(error));}).finally(() => openingDocuments.delete(id));
}

function requestNode(accept: (target: Origin) => void) {
  close(); selection.request(target => { if (!isNode(target)) return false; try { accept(target); message = ''; return true; } catch (error) { message = error instanceof Error ? error.message : String(error); return false; } });
  message = 'Choose a node · Esc cancels'; refresh();
}
function connectNode(origin:Origin){
  requestNode(target=>{if(key(origin)===key(target))throw Error('Choose another node.');store.change(world=>{connectNodes(world,origin,target);});});
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
  void loadEditor(()=>import('./ui/nodeVisuals.tsx')).then(({nodeVisualEditor})=>{if(!root.isConnected)return;disposeTools=nodeVisualEditor(root,{read:()=>store.world,subscribe:store.subscribe,change:store.change,error:feedback,preview:patch=>previewPaint(target,origins,patch)},target,origins);positionMenu();}).catch(error=>feedback(String(error)));
 }else{const editor=paintForm(target,origins,()=>store.world,(edit,group)=>store.change(edit,group),feedback,patch=>previewPaint(target,origins,patch));tools.append(editor.root);disposeTools=editor.dispose;}positionMenu();
});
const appearance=defineMenu('appearance',()=>{
  open('👁');
  button('Scene', openScene); button('World', worldControls);
  button('Visuals',visualTargets);
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
  open('World');for(const action of spaceActions())if(action.available!==false)button(action.label,action.run,tools,action.key);
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
function reconnectEdge(edge:Edge){
 requestNode(target=>store.change(world=>reconnectBinder(world,edge,target)));
}
const edgeContext=defineMenu('edge',(edge: Edge)=>{
  open('Connection');
  const relation=edge.kind==='relationship'?store.world.relationships?.[edge.index]:undefined;
  if(relation && edge.kind === 'relationship'){
    const form=document.createElement('form'),label=field({key:'relation.label',label:'Label',kind:'text'},relation.label),kind=field({key:'relation.kind',label:'Type',kind:'text'},relation.kind);form.append(label.row,kind.row);
    liveForm(form, group=>attempt(()=>store.change(world=>{const r=world.relationships![edge.index];r.label=String(label.value());r.kind=String(kind.value());}, group)),()=>{close();view?.focusInput();});tools.append(form);
    button('Reverse',()=>{store.change(world=>{const r=world.relationships![edge.index];[r.from,r.to]=[r.to,r.from];});close();});
    for(const [key,label] of [['from','Reconnect source…'],['to','Reconnect target…']] as const)button(label,()=>requestNode(target=>store.change(world=>{world.relationships![edge.index][key]=bind(locate(world,target)!,'follow',world);})));
  }else if(edge.kind==='part')button('Reconnect target…',()=>requestNode(target=>store.change(world=>{locate(world,edge.owner)!.parts[edge.index]=bind(locate(world,target)!,'follow',world);})));
  if(edge.kind==='child')button('Reconnect parent…',()=>reconnectEdge(edge));
  if(edge.kind==='variant')button('Reconnect template…',()=>reconnectEdge(edge));
  button('Remove',remove,tools,'Delete');positionMenu();
});
element('workspace').onclick = ()=>openWorkspace();
function travelHistory(direction:'undo'|'redo'){
  const field=document.activeElement,editing=field instanceof HTMLInputElement||field instanceof HTMLTextAreaElement||field instanceof HTMLSelectElement;
  if(editing)field.blur();flushLiveForms();view?.cancel();selection.cancel();travelGlobalHistory(direction);
  if(editing&&field.isConnected)field.focus({preventScroll:true});refresh();
}
search.oninput = () => { close(); refresh(); };
search.onkeydown = event => { if (event.key === 'Enter' && shown && !selection.requesting) { selection.set(store.world.nodes.filter(node => shown!.has(key(node.origin))).map(node => node.origin)); search.blur(); refresh(); } };
tools.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
window.addEventListener('keydown',event=>{
  if(!matchesShortcut(event,worldBinding('Esc'))||event.defaultPrevented)return;
  // The document owns its search panel and editor Escape hierarchy.
  if(event.target instanceof Element&&event.target.closest('.node-document-panel .document-content'))return;
  releaseShortcuts.cancel();
  if(event.repeat){event.preventDefault();event.stopImmediatePropagation();return;}
  const gesture=view?.cancel();
  if(!gesture&&uiPointerHeld())return;
  flushLiveForms();
  if(gesture||selection.cancel()){ /* Cancel the current gesture before closing its window. */ }
  else if(!tools.hidden)close();
  else if(!closeActiveWindow())selection.clear();
  event.preventDefault();event.stopImmediatePropagation();message='';refresh();
},true);
function originShortcutBinding(){return shortcuts.get({category:'Omnium',id:worldShortcutId('O'),label:'Set origin',defaultKey:'X'});}
function runWorldAction(id:string):void{if(id!==worldShortcutId('O'))releaseShortcuts.consume(originShortcutBinding());attempt(()=>worldShortcutActions(true).find(action=>action.id===id)?.execute());}
async function copySelectedDocuments(){
 try{
  flushLiveForms();const origins=selection.committed.filter(isNode),text=selectedDocumentText(store.world,origins);
  if(!navigator.clipboard?.writeText)throw Error('Clipboard writing is unavailable in this browser.');
  await navigator.clipboard.writeText(text);feedback(`Copied ${origins.length} node document${origins.length===1?'':'s'} in hierarchy order.`);
 }catch(error){feedback(error instanceof Error?error.message:String(error));}
}

function worldShortcutActions(includeUnavailable=false){return [
 ...spaceActions().filter(action=>includeUnavailable||action.available!==false).map(action=>({label:action.label,key:action.key,run:action.run})),
 {id:worldShortcutId('O'),label:'Set origin',gesture:undefined,key:'X',run:()=>view?.pickOrigin()},
 {label:'Copy selected node documents',key:'Ctrl+Shift+C',run:()=>{void copySelectedDocuments();}},
 {label:'Toggle origin symmetry',key:'+',run:toggleOriginSymmetry},
 {label:'Expand/collapse hierarchy',key:'Q',run:()=>hierarchyShortcut()},
 {label:'Expand/collapse next level',key:'Shift+Q',run:()=>hierarchyShortcut(true)},
 {label:'Toggle contents facing camera',key:'F',run:()=>view?.toggleContentsFacing()},
 {id:worldShortcutId('R'),label:'Rotate node / orbit camera',gesture:'MB3, then move mouse',key:'',run:()=>view?.rotateHovered()},
 {id:worldShortcutId('move'),label:'Move selection / hovered',gesture:'Left click',key:'',run:()=>view?.moveHovered()},
 {label:'Mount hovered / dismount',key:'M',run:()=>view?.mountTarget()},
 {label:'Save workspace state',key:'5',run:()=>{
  flushLiveForms();view?.saveCamera();
  const session={version:1 as const,views:viewHistory.snapshot(),layout:nativeLayout.getSnapshot(),appearance:nativeAppearance.getSnapshot(),details:navigationState.snapshot(),shortcuts:shortcuts.getSnapshot(),selection:[...selection.targets]};
  store.change(world=>{world.session=structuredClone(session);});void saveSharedDraft?.();feedback('Workspace state saved locally.');
 }},
 {label:'Create nodes',key:'W',run:()=>view?.toggleCreation()},
 {label:'Search',key:'S',run:searchSettings},
 {label:'Find nodes',key:'Ctrl+S',scope:'application',run:openNodeSearch},
 ...((includeUnavailable||selectedOrigins().length>1)?[{label:'Align selection',key:'I',run:()=>view?.alignSelection()}]:[]),
 ...((includeUnavailable||selectedOrigins().length||view?.hoveredOrigin)?[{label:'Document',key:'D',run:()=>openDocument()}]:[]),
 ...((includeUnavailable||selection.values.length)?[{label:'Remove',key:'Delete',run:remove}]:[]),
 {label:'Label',key:'L',run:editLabel},
 ].map(action=>{const defaultKey=action.key&&normalizeShortcut(action.key),id=('id' in action?action.id:undefined)??worldShortcutId(defaultKey??action.key??action.label);return {...action,id,scope:'scope' in action?String(action.scope):undefined,defaultKey:defaultKey??'',execute:action.run,run:()=>runWorldAction(id),key:shortcuts.get({category:'Omnium',id,label:action.label,defaultKey:defaultKey??''})};});}
installContextActions();
registerControlShortcutCatalog(()=>worldShortcutActions(true).map(action=>({category:'Omnium',id:action.id,label:action.label,defaultKey:action.defaultKey,scope:action.scope})));
registerContextActions({label:'Omnium',owns:element=>!!element.closest('#world,header'),read:()=>{
 const mode=view?.inputContext;
 if(mode==='rotate')return [{label:'Confirm rotation',key:'MB3',run:()=>view?.confirmRotation()},{label:'Aim at node',key:'MB3 on node'},{label:'Rotate preview',key:'Move mouse'},{label:'Step settings · math dial',key:'Shift'},{label:'Cancel',key:'Esc',run:()=>view?.cancel()}];
 if(mode==='align')return [{label:'Rotate alignment axis',key:'Right drag'},{label:`Gap ${view?.alignmentGap??0} (0 = adjacent)`,key:'0–9'},{label:'Face origin toward node',key:worldBinding('Ctrl+X'),run:aimOrigin},{label:'Apply alignment',key:'Enter'},{label:'Cancel',key:'Esc',run:()=>view?.cancel()}];
 if(mode==='origin')return [{label:'Choose origin slot',key:'Click'},{label:'Cancel origin picker',key:'X / Esc'}];
 if(mode==='axis-first'||mode==='axis-second')return [{label:mode==='axis-first'?'Choose first axis node':'Choose second axis node',key:'Click'},{label:'Cancel axis picker',key:'Esc'}];
 if(mode==='create')return [{label:'Expand/collapse hierarchy',key:worldBinding('Q')},{label:'Pick up / place',key:'Click'},{label:'Rotate camera',key:'Shift + right drag'},{label:'Place nodes',key:'Click'},{label:'Paint nodes',key:'W, then Alt'},{label:'Toggle painting',key:'W, then Alt'},{label:'Exit creation',key:'W / Esc',run:()=>view?.toggleCreation()}];
 return [
 {label:`Selection ${selectionLatch.depth?'depth':selectionLatch.control?'plane':selectionLatch.shift?'line':'off'}`,key:'Tap Ctrl / Shift'},
 ...worldShortcutActions(),
 {label:'Expand/collapse next level',key:worldBinding('Shift+Q')},{label:'Select in plane',key:'Ctrl + move'},{label:'Select along line',key:'Shift + move'},{label:'Select with depth',key:'Ctrl + Shift + move'},{label:'Expand/collapse hierarchy',key:worldBinding('Q')}, {label:'Pick up / place',key:'Click'},{label:'Rotate camera',key:'Shift + right drag'},{label:'Toggle painting',key:'W, then Alt'},{label:'Rotate node / orbit camera',key:'MB3, then move mouse'},{label:'Look / orbit empty space',key:'Right drag'},{label:'Undo',key:'Ctrl+Z',run:()=>travelHistory('undo')},{label:'Redo',key:'Ctrl+Y',run:()=>travelHistory('redo')},
 {label:'Cancel',key:'Esc',run:()=>view?.cancel()},{label:'Toggle actions',key:'.'}
];}});
document.addEventListener('keydown', event => {
  const editing = event.target instanceof Element && (!!event.target.closest('[data-input-owner]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement);
  if (event.target instanceof Element && event.target.closest('[data-input-owner]')) return;
  if (editing || event.target instanceof HTMLElement && event.target.isContentEditable) return;
  if(selection.requesting&&selection.values.some(target=>!isNode(target))&&(matchesShortcut(event,worldBinding('Delete'))||matchesShortcut(event,worldBinding('L')))){event.preventDefault();selection.cancel();attempt(()=>matchesShortcut(event,worldBinding('Delete'))?remove():editLabel());return;}
  if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&!matchesShortcut(event,worldBinding('5'))&&view?.userPositionKey(event.key)){event.preventDefault();return;}
  if(!event.defaultPrevented&&!event.repeat&&!selection.requesting){
    const action=worldShortcutActions(true).find(action=>action.key&&matchesShortcut(event,action.key));
    if(action){event.preventDefault();action.run();return;}
  }


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
shortcuts.subscribe(()=>{for(const control of document.querySelectorAll<HTMLElement>('[data-world-shortcut]'))shortcutCaption(control,control.dataset.shortcutLabel!,control.dataset.worldShortcut);refreshContextActions();element('empty').querySelector('span')!.textContent=worldBinding('W')||'Create nodes';for(const control of document.querySelectorAll<HTMLButtonElement>('[data-immersive-mode]'))control.textContent=immersiveLabel();});
element('empty').querySelector('span')!.textContent=worldBinding('W')||'Create nodes';
refresh();

// The catalog reads the renderer reference; reserve new defaults only after refresh.
{const actions=worldShortcutActions(true),catalog=[...actions.map(action=>({category:'Omnium' as const,id:action.id,label:action.label,defaultKey:action.defaultKey,scope:action.scope})),...WORLD_GESTURES,...controlShortcutDefinitions()];
 for(const [key,candidates,message] of [
 ['Ctrl+X',['Ctrl+X'],'Ctrl+X is already assigned; bind Aim origin in Shortcuts.'],
 ['Shift+V',['Shift+V','Ctrl+V','Alt+V'],'Assign Hide nodes outside active hierarchy in Shortcuts.'],
 ] as const){const definition=catalog.find(item=>item.id===worldShortcutId(key));if(definition&&shortcuts.getSnapshot().Omnium?.[definition.id]===undefined&&!assignAvailableDefault(shortcuts,definition,candidates,catalog))feedback(message);}
}

// Builds share one draft; production retains its published starting state.
if(location.hostname==='omnium.nexus'||location.hostname==='omnia-web-bae.pages.dev'||location.hostname.endsWith('.omnia-web-bae.pages.dev')){
 const api=createDraftClient(),indicator=document.createElement('button');indicator.type='button';indicator.setAttribute('aria-label','Shared draft');const draftRoot=document.createElement('div'),draftDetails=document.createElement('div');draftDetails.hidden=true;draftRoot.append(indicator,draftDetails);draftControl=draftRoot;
 let issue='',hasLocal=true;try{hasLocal=!!(localStorage.getItem('omnium.v2.world.3')??localStorage.getItem('omnium.v2.world.2')??localStorage.getItem('omnium.v2.world.1'));}catch{/* Preserve recovery mode. */}
 const sync=createDraftSync({
  read:()=>store.world,hasLocal,autoLoad:location.hostname.endsWith('.omnia-web-bae.pages.dev'),
  load:()=>api.load(),save:(world,revision)=>api.save(world,revision),
  marker:()=>{try{const value=JSON.parse(localStorage.getItem('omnium.shared-draft.base.1')??'null');return value&&Number.isSafeInteger(value.revision)&&typeof value.signature==='string'?value as Marker:null;}catch{return null;}},
  remember:value=>{localStorage.setItem('omnium.shared-draft.base.1',JSON.stringify(value));},
  replace:async world=>{const before=store.world;await api.restore(world);if(store.world!==before)throw Error('Workspace changed while loading.');for(const doc of documents.values())doc?.close();sceneView?.close();if(store.world!==before)throw Error('Finish local edits before loading the shared draft.');selection.clear();store.replace(world);refresh();},
  status:(phase,error)=>{indicator.textContent=`Draft · ${phase}`;issue=error??'';renderDraftDetails();},
 });
 saveSharedDraft=sync.save;
 store.subscribe(sync.changed);store.subscribeCamera(sync.changed);
 function renderDraftDetails(){
  const output=document.createElement('output');output.setAttribute('aria-live','polite');output.textContent=issue||sync.phase;draftDetails.replaceChildren(output);
  if(sync.phase==='Loading'||sync.phase==='Saving')return;
  if(sync.phase==='Failed'){const retry=document.createElement('button');retry.textContent='Retry';retry.onclick=()=>{void sync.load();};draftDetails.append(retry);return;}
  for(const [label,choice] of [['Pull','remote'],['Push','local']] as const){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{void sync.load(choice);};draftDetails.append(button);}
 }
 viewHistory.factory('sharedDraft',()=>{openWorkspace();draftDetails.hidden=false;});
 indicator.onclick=()=>{draftDetails.hidden=!draftDetails.hidden;renderDraftDetails();};
 window.addEventListener('online',()=>{if(sync.phase==='Failed')void sync.load();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden)void sync.save();});
 void sync.load().finally(restoreWorkspaceSession);
}

// Restore data owners before reconstructing their windows, including lazy editors.
let restoredWorkspaceSession:unknown;
function restoreWorkspaceSession(){
 const session=store.world.session;if(!session||session===restoredWorkspaceSession)return;
 restoredWorkspaceSession=session;
 nativeLayout.set(session.layout);nativeAppearance.set(session.appearance);
 navigationState.restore(session.details);shortcuts.restore(session.shortcuts);
 selection.set(session.selection as Target[]);viewHistory.restore(session.views);refresh();
}
store.subscribeReplace(restoreWorkspaceSession);
if(!(location.hostname==='omnium.nexus'||location.hostname==='omnia-web-bae.pages.dev'||location.hostname.endsWith('.omnia-web-bae.pages.dev')))restoreWorkspaceSession();

const autoImageColors=createAutoColors({read:()=>store.world,change:edit=>store.change(edit),sample:async image=>{const [{localSceneBlob},{sceneSourceSample}]=await Promise.all([import('./scene/library.ts'),import('./scene/normalizationCache.ts')]);return (await sceneSourceSample(await localSceneBlob(image))).pixels;},error:error=>feedback(String(error))});
store.subscribe(autoImageColors.update);autoImageColors.update();
