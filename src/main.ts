import {readPaint,writePaint} from './core/appearance.ts';
import {visualProperties,type Paint} from './properties/visual.ts';
import vfxFunction from './scene/vfx.function.ts';
import {definitions as audioDefinitions} from './scene/audioControls.ts';
import {defaultScene} from './scene/state.ts';
import {NORMALIZATION_FIELDS} from './scene/normalization.ts';
import './style.css';
import { paintForm } from './ui/visualControls.ts';
import { updateUIAppearance } from './ui/appearance.ts';
import { addStructure, bind, locate, resolve, sameOrigin, setInvariant, type Binding, type Origin, type Vec3, type World } from './core/model.ts';
import { capabilities, translate } from './core/capabilities.ts';
import { createSelection } from './core/selection.ts';
import { createStore } from './core/store.ts';
import { createWorld, type Edge } from './world.ts';
import { moveBranch, inherited } from './core/lattice.ts';
import { adoptNodes, childNode, copyNode, detachNode, removeNodes } from './core/nodeOperations.ts';
import type { editDocument } from './text/editor.ts';
import { scenePanel } from './scene/panel.ts';
import { validateAsset, MAX_ASSET_BYTES, type VisualAsset } from './graph/assets.ts';
import { workspacePanel } from './ui/workspace.ts';
import { field } from './ui/fields.ts';
import { liveForm } from './ui/liveForm.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tools = element('tools'), status = element('status'), search = element<HTMLInputElement>('find');
type Target = Origin | Edge;
const isNode = (target: Target): target is Origin => 'born' in target;
const selection = createSelection<Target>((a, b) => isNode(a) && isNode(b) ? sameOrigin(a, b) : !isNode(a) && !isNode(b) && JSON.stringify(a) === JSON.stringify(b));
const selectedOrigins = () => selection.values.filter(isNode);
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const store = createStore(storage);
let message = '', menuPoint = { x: 20, y: 60 }, shown: Set<string> | undefined;
const key = (origin: Origin) => JSON.stringify(origin);
function feedback(text: string) { message = text; refresh(); }
function attempt(action: () => void) { try { action(); } catch (error) { feedback(error instanceof Error ? error.message : String(error)); } }
function close() { tools.hidden = true; view?.update(store.world, selectedOrigins(), shown, selection.values.filter((target): target is Edge => !isNode(target))); }
function pick(origin: Origin, extend = false, toggle = false) { selection.pick(origin, extend, toggle); refresh(); }
function selectedNodes(world: World) { return world.nodes.filter(node => selection.has(node.origin)); }
const view = (() => {
  try {
    return createWorld(element('world'), {
      pick, picking: () => selection.requesting,
      range(origins, extend) { if (!selection.requesting) { selection.set(extend ? [...selectedOrigins(), ...origins] : origins); refresh(); } },
      clear() { if (selection.requesting) return; close(); selection.set([]); refresh(); },
      menu(origin, point, position, edge) { if (selection.requesting) return; message = ''; if (edge) selection.set([edge]); else if (origin && !selection.has(origin)) pick(origin); menuPoint = point; refresh(); context(position); },
      move(origins, delta) { store.change(world => translate(world, origins, delta)); },
      adopt(origins, owner, delta) { store.change(world => adoptNodes(world, origins, owner, delta)); },
      park(origin, position) { message = ''; store.change(world => moveBranch(world, origin, position)); return store.world; },
      paint(positions, source) { store.change(world => { const node = source && locate(world, source); for (const position of positions) { if (node) copyNode(world, node, position).parts = []; else addStructure(world, position); } }); },
      expand(origin) { store.change(world => { const node = locate(world, origin)!; node.collapsed = !node.collapsed; }); },
      edge(edge) { selection.set([edge]); refresh(); },
      feedback,
    });
  } catch { status.textContent = 'The 3D renderer could not start. WebGL is required; your saved world is preserved.'; return undefined; }
})();

function refresh() {
  updateUIAppearance(store.world.appearance);
  for (const document of documents.values()) document?.refreshAppearance();
  const query = search.value.trim().toLocaleLowerCase();
  shown = query ? new Set(store.world.nodes.filter(node => node.label.toLocaleLowerCase().includes(query)).map(node => key(node.origin))) : undefined;
  selection.set(selection.values.filter(target => isNode(target) ? !!locate(store.world, target) : target.kind === 'part' ? !!locate(store.world, target.owner)?.parts[target.index] : target.kind === 'variant' ? !!locate(store.world,target.owner)?.variantOf : !!store.world.relationships?.[target.index]));
  view?.update(store.world, selectedOrigins(), shown, selection.values.filter((target): target is Edge => !isNode(target)));
  element('empty').hidden = store.world.nodes.length > 0;
  element<HTMLButtonElement>('undo').disabled = !store.canUndo;
  element<HTMLButtonElement>('redo').disabled = !store.canRedo;
  if (view) status.textContent = store.message || message || (selection.requesting ? 'Choose a reference · Esc cancels' : selectedOrigins().length ? `${selectedOrigins().length} selected` : 'Drag to move · Alt-click to ride · Alt-drag to paint');
}
store.subscribe(refresh);
function open(title: string) {
  tools.replaceChildren(); tools.hidden = false;
  const row = document.createElement('div'); row.className = 'title';
  const caption = document.createElement('span'); caption.textContent = title;
  const back = document.createElement('button'); back.textContent = '×'; back.setAttribute('aria-label', 'Close'); back.onclick = close;
  row.append(caption, back); tools.append(row);
  const find = document.createElement('input'); find.type = 'search'; find.placeholder = 'Search…'; find.setAttribute('aria-label', 'Search operations');
  const filter = () => {
    const query = find.value.trim().toLocaleLowerCase();
    for (const item of Array.from(tools.children)) if (item instanceof HTMLButtonElement) item.hidden = item.dataset.searchOnly === 'true' && !query || !!query && !`${item.textContent} ${item.dataset.keywords ?? ''}`.toLocaleLowerCase().includes(query);
    positionMenu();
  };
  find.oninput = filter;
  find.onkeydown = event => { if (event.key === 'Enter') { const match = Array.from(tools.children).find(item => item instanceof HTMLButtonElement && !item.hidden) as HTMLButtonElement | undefined; if (match) { event.preventDefault(); match.click(); } } };
  tools.append(find);
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
function create(position: Vec3) {
  let origin: Origin | undefined;
  store.change(world => { origin = addStructure(world, position).origin; });
  selection.set([origin!]); search.value = ''; close(); message = ''; refresh();
}
function editCapability(capabilityKey: string) {
  const origins = [...selectedOrigins()], first = locate(store.world, origins[0]); if (!first) return;
  const capability = capabilities(inherited(first, store.world)).find(item => item.key === capabilityKey); if (!capability) return;
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
  tools.append(form); positionMenu(); inputs[0].focus(); if (inputs[0].type === 'text') inputs[0].select();
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
function parts() {
  const origin = selectedOrigins()[0], node = origin && locate(store.world, origin); if (!node) return;
  open(node.label || 'Composition');
  if (!node.parts.length) { const text = document.createElement('div'); text.className = 'muted'; text.textContent = '•'; tools.append(text); }
  node.parts.forEach((binding, index) => {
    const row = document.createElement('div'); row.className = 'part';
    const targets = resolve(binding, store.world), mark = binding.mode === 'follow' ? '↫' : binding.mode === 'position' ? '●' : '⚬';
    const target = button(`${index + 1} ${mark} ${targets.length ? targets.map(n => n.label || '•').join(', ') : 'Unresolved'}`, () => {
      if (targets.length) { selection.set(targets.map(node => node.origin)); close(); refresh(); }
    }, row); target.className = `target${targets.length ? '' : ' warning'}`; target.title = JSON.stringify(binding);
    for (const [symbol, offset] of [['↑', -1], ['↓', 1]] as const) {
      const b = button(symbol, () => { store.change(world => { const owner = locate(world, origin)!; const [part] = owner.parts.splice(index, 1); owner.parts.splice(index + offset, 0, part); }); parts(); }, row);
      b.disabled = index + offset < 0 || index + offset >= node.parts.length; b.title = offset < 0 ? 'Earlier in composition' : 'Later in composition';
    }
    button('×', () => { store.change(world => { locate(world, origin)!.parts.splice(index, 1); }); parts(); }, row).title = 'Remove this reference';
    tools.append(row);
  });
  button('Include…', chooseReference); positionMenu();
}
function chooseReference() {
  open('Reference');
  button('↫ Follow chosen structure', () => reference('follow'));
  button('● Match this position', () => reference('position'));
  button('⚬ Shared structure', () => reference('structure'));
}
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
function context(position: Vec3) {
  const edge = selection.values.find((target): target is Edge => !isNode(target));
  if (edge) { edgeContext(edge); return; }
  open(selectedOrigins().length ? `${selectedOrigins().length} selected` : 'Omnium');
  if (!selectedOrigins().length) { button('Create structure', () => create(position)); button('👁', appearance).setAttribute('aria-label', 'Appearance'); return; }
  const node = selectedNodes(store.world)[0]; if (!node) return;
  for (const capability of capabilities(node).filter(c => !['color','carrier'].includes(c.key))) button(capability.label, () => editCapability(capability.key));
  button('👁', appearance).setAttribute('aria-label', 'Appearance');
  for (const capability of capabilities(node).filter(c => ['color','carrier'].includes(c.key))) {
    const shortcut = button(`👁 ${capability.label}`, () => editCapability(capability.key)); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = capability.properties.map(p => p.property.label).join(' ');
  }
  if (selectedOrigins().length === 1) { const shortcut = button('👁 Visual', visuals); shortcut.dataset.searchOnly = 'true'; shortcut.dataset.keywords = 'image SVG GLB character size text'; }
  if (selectedOrigins().length === 1) { button('Composition', parts); button('Document', openDocument); button('Node tools…', nodeTools); }
  button('Include…', chooseReference);
  button(node.invariant ? '⚬ Release invariant' : '⚬ Activate invariant', () => {
    store.change(world => { for (const target of selectedNodes(world)) setInvariant(world, target, !node.invariant); }); close();
  });
  for (const [name, action] of [['Scene', openScene], ['World', worldControls]] as const) { const shortcut = button(`👁 ${name}`, action); shortcut.dataset.searchOnly = 'true'; }
  button('Focus', () => { view?.focus(selectedOrigins(), true); close(); });
  button('Remove', remove);
}
function searchSettings() {
  open('Settings');tools.querySelector('input[type=search]')?.remove();
  const input=document.createElement('input');input.type='search';input.placeholder='Search settings';input.setAttribute('aria-label','Search settings');
  const results=document.createElement('div');tools.append(input,results);
  const origins=[...selectedOrigins()],selected=origins[0]&&locate(store.world,origins[0]);
  const nodeEntries=selected?capabilities(inherited(selected,store.world)).flatMap(capability=>capability.properties.map((binding,index)=>({label:`${capability.label} · ${binding.property.label}`,keywords:'selected node',definition:binding.property,read:()=>binding.read(),write:(world:World,value:string|number|boolean)=>{if(capability.key==='move'){const first=locate(world,origins[0]);if(first){const delta:Vec3=[0,0,0];delta[index]=Number(value)-first.position[index];translate(world,origins,delta);}return;}for(const origin of origins){const node=locate(world,origin);if(!node)continue;const target=capabilities(node).find(item=>item.key===capability.key);if(!target)continue;target.properties[index].write(String(value));if(node.variantOf)node.overrides=[...new Set([...(node.overrides??[]),binding.property.key])];}}}))):[];
  const visualEntries=(['text','background',...(origins.length?['nodeText' as const,'nodes' as const]:[])] as const).flatMap(target=>visualProperties(target==='text'||target==='nodeText').map(definition=>({label:`${target} · ${definition.label}`,keywords:'appearance visual color',definition,read:()=>readPaint(store.world,target,origins[0])[definition.key as keyof Paint]!,write:(world:World,value:string|number|boolean)=>writePaint(world,target,origins,{[definition.key]:value})})));
  const worldEntries=[
    {label:'Lattice scale',keywords:'world lattice',definition:{key:'latticeScale',label:'Lattice scale',kind:'number' as const,min:1e-9},read:()=>store.world.settings?.latticeScale??1,write:(world:World,value:string|number|boolean)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.latticeScale=Number(value);}},
    {label:'Names',keywords:'world names',definition:{key:'names',label:'Names',kind:'select' as const,options:[{id:'expanded',label:'Expanded'},{id:'all',label:'All'},{id:'selection',label:'Selected'}]},read:()=>store.world.settings?.names??'expanded',write:(world:World,value:string|number|boolean)=>{world.settings??={latticeScale:1,names:'expanded'};world.settings.names=value as 'all'|'expanded'|'selection';}},
  ];
  const entries=[...nodeEntries,...visualEntries,...worldEntries,
    ...Object.entries(vfxFunction.inputs).map(([key,binding])=>({label:binding.definition.label,keywords:`scene ${key}`,definition:{...binding.definition,key},read:()=>binding.read({sceneVfx:(store.world.scene??defaultScene()).vfx}),write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx=binding.write({sceneVfx:world.scene.vfx},value).sceneVfx;}})),
    ...audioDefinitions.map(d=>({label:d.property.label,keywords:'scene audio',definition:d.property,read:()=>((store.world.scene??defaultScene()).vfx.audioResponse[d.key] as number)*d.scale,write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();world.scene.vfx.audioResponse[d.key]=Number(value)/d.scale;}})),
    ...NORMALIZATION_FIELDS.map(d=>({label:d.label,keywords:'scene normalization',definition:{key:`normalize.${d.key}`,label:d.label,kind:d.kind,...(d.kind==='number'?{min:d.min,max:d.max,step:.01}:{})},read:()=>(store.world.scene??defaultScene()).normalization[d.key],write:(world:World,value:string|number|boolean)=>{world.scene??=defaultScene();(world.scene.normalization as unknown as Record<string,number|boolean>)[d.key]=value as number|boolean;}})),
  ];
  const render=()=>{results.replaceChildren();const query=input.value.trim().toLocaleLowerCase();if(!query)return;
    for(const item of entries.filter(item=>`${item.label} ${item.keywords}`.toLocaleLowerCase().includes(query))){
      const form=document.createElement('form'),control=field(item.definition,item.read());form.append(control.row);results.append(form);
      liveForm(form,group=>attempt(()=>store.change(world=>item.write(world,control.value()),group)));
    }
  };
  input.addEventListener('input',render);input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();results.querySelector<HTMLElement>('input,select')?.focus();}});
  positionMenu();input.focus();
}
let workspaceView: ReturnType<typeof workspacePanel> | undefined;
function openWorkspace() {
  close(); if (workspaceView?.root.isConnected) { workspaceView.root.focus(); return; }
  workspaceView = workspacePanel({ read: () => store.world, replace: world => { store.replace(world); selection.set([]); search.value = ''; refresh(); }, recover: () => { store.recover(); selection.set([]); search.value = ''; refresh(); }, beforeReplace: () => {
    documentEpoch++; view?.cancel(); close(); selection.cancel(); sceneView?.close();
    for (const document of documents.values()) document?.close();
    if ([...documents.values()].some(document => document?.root.isConnected)) throw Error('An open document could not close. Preserve it before importing.');
  } });
}
let sceneView: ReturnType<typeof scenePanel> | undefined;
function openScene() {
  close(); if (!view) return; sceneView?.close();
  sceneView = scenePanel({ subscribe:store.subscribe, read: () => store.world, selected: selectedOrigins, change: (edit, group) => store.change(edit, group), preview: candidate => view.session.update(candidate, selectedOrigins()[0]), session: view.session, feedback });
}
const documents = new Map<string, ReturnType<typeof editDocument>>(), openingDocuments = new Set<string>();
let documentEpoch = 0;
function openDocument() {
  const origin = selectedOrigins()[0]; if (!origin) return; close();
  const id = key(origin), existing = documents.get(id);
  if (existing?.root.isConnected) { existing.root.querySelector<HTMLElement>('.cm-content')?.focus(); return; }
  if (openingDocuments.has(id)) return;
  openingDocuments.add(id); const epoch = documentEpoch;
  void import('./text/editor.ts').then(({ editDocument }) => {
    if (epoch !== documentEpoch || !locate(store.world, origin)) return;
    documents.set(id, editDocument(origin, () => store.world, text => store.change(world => {
      const node = locate(world, origin); if (!node) throw Error('This node was removed. Copy the document before closing.'); node.text = text;
      if (node.variantOf) node.overrides = [...new Set([...(node.overrides ?? []), 'text'])];
    }, `document:${id}`), feedback, () => documents.delete(id)));
  }).catch(error => feedback(error instanceof Error ? error.message : String(error))).finally(() => openingDocuments.delete(id));
}

function requestNode(accept: (target: Origin) => void) {
  close(); selection.request(target => { if (!isNode(target)) return false; try { accept(target); message = ''; return true; } catch (error) { message = error instanceof Error ? error.message : String(error); return false; } });
  message = 'Choose a node · Esc cancels'; refresh();
}
function nodeTools() {
  const origin = selectedOrigins()[0], node = origin && locate(store.world, origin); if (!node) return;
  open(node.label || 'Node');
  button('Add child', () => { let child: Origin | undefined; store.change(world => { child = childNode(world, origin).origin; locate(world, origin)!.collapsed = false; }); selection.set([child!]); close(); refresh(); });
  button('Variants', () => { view?.variants(origin); close(); });
  button('Add variant', () => { let child: Origin | undefined; store.change(world => { child = childNode(world, origin, true).origin; }); selection.set([child!]); view?.variants(origin, true); close(); refresh(); });
  button(node.collapsed ? 'Expand children' : 'Collapse children', () => { store.change(world => { locate(world, origin)!.collapsed = !node.collapsed; }); close(); });

  button('Copy', () => { let result: Origin | undefined; store.change(world => { const source = locate(world, origin)!; result = copyNode(world, source, source.position).origin; }); selection.set([result!]); close(); refresh(); });
  button('Connect to…', () => requestNode(target => store.change(world => { world.relationships ??= []; world.relationships.push({ from: bind(locate(world, origin)!, 'follow', world), to: bind(locate(world, target)!, 'follow', world), label: '', kind: 'relation' }); })));
  button('Attach to…', () => requestNode(target => store.change(world => { const source = locate(world, origin)!; source.parent = structuredClone(target); })));
  if (node.parent || node.variantOf) button('Detach', () => { store.change(world => detachNode(world, origin)); close(); });
  button('Hide', () => { store.change(world => { locate(world, origin)!.hidden = true; }); selection.set([]); close(); refresh(); });
}
function appearance() {
  open('👁');
  button('Scene', openScene); button('World', worldControls);
  button('Visuals', () => {
    open('👁 Visuals');
    const origins=[...selectedOrigins()];
    for(const [target,title] of [['nodes','Nodes'],['nodeText','Node text'],['text','Text'],['background','UI backgrounds']] as const){
      if((target==='nodes'||target==='nodeText')&&!origins.length)continue;
      button(title,()=>{open(title);tools.append(paintForm(target,origins,()=>store.world,(edit,group)=>store.change(edit,group),feedback));positionMenu();});
    }
    if(origins.length===1)button('Node visual',visuals);
    positionMenu();
  });
}

function worldControls() {
  open('World');
  const form = document.createElement('form'), scale = field({ key:'latticeScale',label:'Lattice scale',kind:'number',min:1e-9 }, store.world.settings?.latticeScale ?? 1);
  const names = field({ key:'names',label:'Names',kind:'select',options:[{id:'expanded',label:'Expanded'},{id:'all',label:'All'},{id:'selection',label:'Selected'}] }, store.world.settings?.names ?? 'expanded');
  form.append(scale.row,names.row);
  liveForm(form, group => attempt(() => store.change(world => { world.settings = { latticeScale:Number(scale.value()),names:names.value() as 'all'|'expanded'|'selection' }; }, group))); tools.append(form);
  button('Show all nodes', () => { store.change(world => { for (const node of world.nodes) {node.hidden=false;node.collapsed=false;} });search.value='';close();refresh(); });
  button('Fit all', () => { view?.focus(store.world.nodes.map(node => node.origin),true);close(); });positionMenu();
}
function visuals() {
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
  liveForm(form, group=>attempt(()=>store.change(world=>{const target=locate(world,origin)!,text=String(character.value());target.visual={...(text?{character:text}:node.visual),size:Number(size.value()),showText:Boolean(showText.value())};if(target.variantOf)target.overrides=[...new Set([...(target.overrides??[]),'visual'])];}, group)));tools.append(form);
  if(node.visual)button('Clear visual',()=>{store.change(world=>{delete locate(world,origin)!.visual;});close();});positionMenu();
}
function edgeContext(edge: Edge) {
  open('Connection');
  const relation=edge.kind==='relationship'?store.world.relationships?.[edge.index]:undefined;
  if(relation && edge.kind === 'relationship'){
    const form=document.createElement('form'),label=field({key:'relation.label',label:'Label',kind:'text'},relation.label),kind=field({key:'relation.kind',label:'Type',kind:'text'},relation.kind);form.append(label.row,kind.row);
    liveForm(form, group=>attempt(()=>store.change(world=>{const r=world.relationships![edge.index];r.label=String(label.value());r.kind=String(kind.value());}, group)));tools.append(form);
    button('Reverse',()=>{store.change(world=>{const r=world.relationships![edge.index];[r.from,r.to]=[r.to,r.from];});close();});
    for(const [key,label] of [['from','Reconnect source…'],['to','Reconnect target…']] as const)button(label,()=>requestNode(target=>store.change(world=>{world.relationships![edge.index][key]=bind(locate(world,target)!,'follow',world);})));
  }else if(edge.kind==='part')button('Reconnect target…',()=>requestNode(target=>store.change(world=>{locate(world,edge.owner)!.parts[edge.index]=bind(locate(world,target)!,'follow',world);})));
  button('Remove',remove);positionMenu();
}
element('workspace').onclick = openWorkspace;
element<HTMLButtonElement>('create').disabled = !view;
element('create').onclick = () => attempt(() => create(view!.center()));
element('undo').onclick = () => { view?.cancel(); close(); selection.cancel(); store.undo(); };
element('redo').onclick = () => { view?.cancel(); close(); selection.cancel(); store.redo(); };
search.oninput = () => { close(); refresh(); };
search.onkeydown = event => { if (event.key === 'Enter' && shown && !selection.requesting) { selection.set(store.world.nodes.filter(node => shown!.has(key(node.origin))).map(node => node.origin)); search.blur(); refresh(); } };
document.addEventListener('pointerdown', event => {
  if (!tools.hidden && !tools.contains(event.target as Node)) { close(); if (event.button !== 2) { event.preventDefault(); event.stopPropagation(); } }
}, true);
tools.addEventListener('contextmenu', event => { event.preventDefault(); event.stopPropagation(); });
document.addEventListener('keydown', event => {
  const editing = event.target instanceof Element && (!!event.target.closest('[data-input-owner]') || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement);
  if (event.target instanceof Element && event.target.closest('[data-input-owner]')) return;
  if (event.key === 'Escape') {
    const gesture = view?.cancel(), popup = !tools.hidden; close();
    if (!selection.cancel() && !gesture && !popup) selection.set([]);
    message = ''; refresh(); return;
  }
  if (editing) return;
  if(event.key.toLowerCase()==='s'&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.repeat){event.preventDefault();searchSettings();return;}
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); element<HTMLButtonElement>(event.shiftKey ? 'redo' : 'undo').click(); }
  if (event.key === 'Delete' && selection.values.length && !selection.requesting) { event.preventDefault(); attempt(remove); }
});
refresh();
