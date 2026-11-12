import './style.css';
import { addStructure, bind, locate, resolve, sameOrigin, setInvariant, type Binding, type Origin, type Vec3, type World } from './core/model.ts';
import { capabilities, translate } from './core/capabilities.ts';
import { createSelection } from './core/selection.ts';
import { createStore } from './core/store.ts';
import { createWorld, type Edge } from './world.ts';
import { moveBranch, inherited } from './core/lattice.ts';
import { adoptNodes, childNode, copyNode, detachNode, removeNodes } from './core/nodeOperations.ts';
import { editDocument } from './text/editor.ts';
import { scenePanel } from './scene/panel.ts';
import { validateAsset, MAX_ASSET_BYTES, type VisualAsset } from './graph/assets.ts';
import { workspacePanel } from './ui/workspace.ts';
import { field } from './ui/fields.ts';

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
  const apply = (world: World) => {
    if (capabilityKey === 'move') {
      const before = locate(world, origins[0])!.position;
      translate(world, origins, inputs.map((input, axis) => Number(input.value) - (origins.length === 1 ? before[axis] : 0)) as Vec3);
    } else for (const origin of origins) {
      const node = locate(world, origin); if (!node) continue;
      const coupled = capabilities(node).find(item => item.key === capabilityKey)!;
      coupled.properties.forEach((binding, i) => binding.write(inputs[i].value));
      if (node.variantOf) node.overrides = [...new Set([...(node.overrides ?? []), ...coupled.properties.map(binding => binding.property.key)])];
    }
  };
  if (capabilityKey === 'color') inputs[0].oninput = () => attempt(() => { const preview = { ...first }; capabilities(preview).find(c=>c.key==='color')!.properties[0].write(inputs[0].value); view?.previewColor(origins,preview.color); });
  const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.textContent = 'Apply'; form.append(confirm);
  form.onsubmit = event => { event.preventDefault(); attempt(() => { store.change(apply); close(); }); };
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
  if (!selectedOrigins().length) { button('Create structure', () => create(position)); button('Scene', openScene); button('World', worldControls); return; }
  const node = selectedNodes(store.world)[0]; if (!node) return;
  for (const capability of capabilities(node)) button(capability.label, () => editCapability(capability.key));
  if (selectedOrigins().length === 1) { button('Composition', parts); button('Document', openDocument); button('Node tools…', nodeTools); }
  button('Include…', chooseReference);
  button(node.invariant ? '⚬ Release invariant' : '⚬ Activate invariant', () => {
    store.change(world => { for (const target of selectedNodes(world)) setInvariant(world, target, !node.invariant); }); close();
  });
  button('Scene', openScene);
  button('World', worldControls);
  button('Focus', () => { view?.focus(selectedOrigins(), true); close(); });
  button('Remove', remove);
}
let workspaceView: ReturnType<typeof workspacePanel> | undefined;
function openWorkspace() {
  close(); if (workspaceView?.root.isConnected) { workspaceView.root.focus(); return; }
  workspaceView = workspacePanel({ read: () => store.world, replace: world => { store.replace(world); selection.set([]); search.value = ''; refresh(); }, recover: () => { store.recover(); selection.set([]); search.value = ''; refresh(); }, beforeReplace: () => {
    view?.cancel(); close(); selection.cancel(); sceneView?.close();
    for (const document of documents.values()) document?.close();
    if ([...documents.values()].some(document => document?.root.isConnected)) throw Error('An open document could not close. Preserve it before importing.');
  } });
}
let sceneView: ReturnType<typeof scenePanel> | undefined;
function openScene() {
  close(); if (!view) return; sceneView?.close();
  sceneView = scenePanel({ read: () => store.world, selected: selectedOrigins, change: edit => store.change(edit), preview: candidate => view.session.update(candidate, selectedOrigins()[0]), session: view.session, feedback });
}
const documents = new Map<string, ReturnType<typeof editDocument>>();
function openDocument() {
  const origin = selectedOrigins()[0]; if (!origin) return; close();
  const existing = documents.get(key(origin)); if (existing?.root.isConnected) { existing.root.focus(); return; }
  documents.set(key(origin), editDocument(origin, () => store.world, text => store.change(world => {
    const node = locate(world, origin); if (!node) throw Error('This node was removed. Copy the document before closing.'); node.text = text;
    if (node.variantOf) node.overrides = [...new Set([...(node.overrides ?? []), 'text'])];
  }, `document:${key(origin)}`), feedback, () => documents.delete(key(origin))));
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
  button('Visual…', visuals);
  button('Copy', () => { let result: Origin | undefined; store.change(world => { const source = locate(world, origin)!; result = copyNode(world, source, source.position).origin; }); selection.set([result!]); close(); refresh(); });
  button('Connect to…', () => requestNode(target => store.change(world => { world.relationships ??= []; world.relationships.push({ from: bind(locate(world, origin)!, 'follow', world), to: bind(locate(world, target)!, 'follow', world), label: '', kind: 'relation' }); })));
  button('Attach to…', () => requestNode(target => store.change(world => { const source = locate(world, origin)!; source.parent = structuredClone(target); })));
  if (node.parent || node.variantOf) button('Detach', () => { store.change(world => detachNode(world, origin)); close(); });
  button('Hide', () => { store.change(world => { locate(world, origin)!.hidden = true; }); selection.set([]); close(); refresh(); });
}
function worldControls() {
  open('World');
  const form = document.createElement('form'), scale = field({ key:'latticeScale',label:'Lattice scale',kind:'number',min:1e-9 }, store.world.settings?.latticeScale ?? 1);
  const names = field({ key:'names',label:'Names',kind:'select',options:[{id:'expanded',label:'Expanded'},{id:'all',label:'All'},{id:'selection',label:'Selected'}] }, store.world.settings?.names ?? 'expanded');
  form.append(scale.row,names.row); const apply = document.createElement('button'); apply.type='submit';apply.textContent='Apply';form.append(apply);
  form.onsubmit = event => { event.preventDefault(); attempt(() => { store.change(world => { world.settings = { latticeScale:Number(scale.value()),names:names.value() as 'all'|'expanded'|'selection' }; });close(); }); };tools.append(form);
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
  const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';form.append(apply);form.onsubmit=event=>{event.preventDefault();attempt(()=>{store.change(world=>{const target=locate(world,origin)!,text=String(character.value());target.visual={...(text?{character:text}:node.visual),size:Number(size.value()),showText:Boolean(showText.value())};if(target.variantOf)target.overrides=[...new Set([...(target.overrides??[]),'visual'])];});close();});};tools.append(form);
  if(node.visual)button('Clear visual',()=>{store.change(world=>{delete locate(world,origin)!.visual;});close();});positionMenu();
}
function edgeContext(edge: Edge) {
  open('Connection');
  const relation=edge.kind==='relationship'?store.world.relationships?.[edge.index]:undefined;
  if(relation && edge.kind === 'relationship'){
    const form=document.createElement('form'),label=field({key:'relation.label',label:'Label',kind:'text'},relation.label),kind=field({key:'relation.kind',label:'Type',kind:'text'},relation.kind);form.append(label.row,kind.row);
    const apply=document.createElement('button');apply.type='submit';apply.textContent='Apply';form.append(apply);form.onsubmit=event=>{event.preventDefault();attempt(()=>{store.change(world=>{const r=world.relationships![edge.index];r.label=String(label.value());r.kind=String(kind.value());});close();});};tools.append(form);
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
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); element<HTMLButtonElement>(event.shiftKey ? 'redo' : 'undo').click(); }
  if (event.key === 'Delete' && selection.values.length && !selection.requesting) { event.preventDefault(); attempt(remove); }
});
refresh();
