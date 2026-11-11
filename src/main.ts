import './style.css';
import { addStructure, bind, locate, resolve, sameOrigin, setInvariant, type Binding, type Origin, type Vec3, type World } from './core/model.ts';
import { capabilities, translate } from './core/capabilities.ts';
import { createSelection } from './core/selection.ts';
import { createStore } from './core/store.ts';
import { createWorld } from './world.ts';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const tools = element('tools'), status = element('status'), search = element<HTMLInputElement>('find');
const selection = createSelection<Origin>(sameOrigin);
const storage = { getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value) };
const store = createStore(storage);
let message = '', menuPoint = { x: 20, y: 60 }, shown: Set<string> | undefined;
const key = (origin: Origin) => JSON.stringify(origin);
function feedback(text: string) { message = text; refresh(); }
function attempt(action: () => void) { try { action(); } catch (error) { feedback(error instanceof Error ? error.message : String(error)); } }
function close() { tools.hidden = true; view?.update(store.world, selection.values, shown); }
function pick(origin: Origin, extend = false, toggle = false) { selection.pick(origin, extend, toggle); refresh(); }
function selectedNodes(world: World) { return world.nodes.filter(node => selection.has(node.origin)); }
const view = (() => {
  try {
    return createWorld(element('world'), {
      pick, picking: () => selection.requesting,
      range(origins, extend) { if (!selection.requesting) { selection.set(extend ? [...selection.values, ...origins] : origins); refresh(); } },
      clear() { if (selection.requesting) return; close(); selection.set([]); refresh(); },
      menu(origin, point, position) { if (selection.requesting) return; if (origin && !selection.has(origin)) pick(origin); menuPoint = point; context(position); },
      move(origins, delta) { store.change(world => translate(world, origins, delta)); },
      feedback,
    });
  } catch { status.textContent = 'The 3D renderer could not start. WebGL is required; your saved world is preserved.'; return undefined; }
})();

function refresh() {
  const query = search.value.trim().toLocaleLowerCase();
  shown = query ? new Set(store.world.nodes.filter(node => node.label.toLocaleLowerCase().includes(query)).map(node => key(node.origin))) : undefined;
  selection.set(selection.values.filter(origin => !!locate(store.world, origin)));
  view?.update(store.world, selection.values, shown);
  element('empty').hidden = store.world.nodes.length > 0;
  element<HTMLButtonElement>('undo').disabled = !store.canUndo;
  element<HTMLButtonElement>('redo').disabled = !store.canRedo;
  if (view) status.textContent = store.message || message || (selection.requesting ? 'Choose a reference · Esc cancels' : selection.values.length ? `${selection.values.length} selected` : 'Drag to pan · Right-drag to orbit · Scroll to zoom');
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
  const origins = [...selection.values], first = locate(store.world, origins[0]); if (!first) return;
  const capability = capabilities(first).find(item => item.key === capabilityKey); if (!capability) return;
  open(capability.label);
  const form = document.createElement('form'), inputs: HTMLInputElement[] = [];
  for (const binding of capability.properties) {
    const label = document.createElement('label'), text = document.createElement('span'), input = document.createElement('input');
    text.textContent = `${capabilityKey === 'move' && origins.length > 1 ? 'Δ' : ''}${binding.property.label}`;
    input.type = binding.property.kind === 'text' ? 'text' : binding.property.kind;
    input.required = binding.property.kind !== 'text';
    input.value = capabilityKey === 'move' && origins.length > 1 ? '0' : String(binding.read());
    if (input.type === 'number') { input.step = 'any'; input.min = '-10000000'; input.max = '10000000'; }
    if (input.type === 'text') input.maxLength = 160;
    input.setAttribute('aria-label', text.textContent); inputs.push(input); label.append(text, input); form.append(label);
  }
  const apply = (world: World) => {
    if (capabilityKey === 'move') {
      const before = locate(world, origins[0])!.position;
      translate(world, origins, inputs.map((input, axis) => Number(input.value) - (origins.length === 1 ? before[axis] : 0)) as Vec3);
    } else for (const origin of origins) {
      const node = locate(world, origin); if (!node) continue;
      const coupled = capabilities(node).find(item => item.key === capabilityKey)!;
      coupled.properties.forEach((binding, i) => binding.write(inputs[i].value));
    }
  };
  if (capabilityKey === 'color') inputs[0].oninput = () => attempt(() => { const preview = structuredClone(store.world); apply(preview); view?.update(preview, selection.values, shown); });
  const confirm = document.createElement('button'); confirm.type = 'submit'; confirm.textContent = 'Apply'; form.append(confirm);
  form.onsubmit = event => { event.preventDefault(); attempt(() => { store.change(apply); close(); }); };
  tools.append(form); positionMenu(); inputs[0].focus(); if (inputs[0].type === 'text') inputs[0].select();
}
function reference(mode: Binding['mode']) {
  const owners = [...selection.values]; close();
  selection.request(target => {
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
  const origin = selection.values[0], node = origin && locate(store.world, origin); if (!node) return;
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
  store.change(world => { world.nodes = world.nodes.filter(node => !selection.has(node.origin)); });
  selection.set([]); close(); refresh();
}
function context(position: Vec3) {
  open(selection.values.length ? `${selection.values.length} selected` : 'Omnium');
  if (!selection.values.length) { button('Create structure', () => create(position)); return; }
  const node = selectedNodes(store.world)[0]; if (!node) return;
  for (const capability of capabilities(node)) button(capability.label, () => editCapability(capability.key));
  if (selection.values.length === 1) button('Composition', parts);
  button('Include…', chooseReference);
  button(node.invariant ? '⚬ Release invariant' : '⚬ Activate invariant', () => {
    store.change(world => { for (const target of selectedNodes(world)) setInvariant(world, target, !node.invariant); }); close();
  });
  button('Focus', () => { view?.focus(selection.values); close(); });
  button('Remove', remove);
}
element<HTMLButtonElement>('create').disabled = !view;
element('create').onclick = () => attempt(() => create(view!.center()));
element('undo').onclick = () => { view?.cancel(); close(); selection.cancel(); store.undo(); };
element('redo').onclick = () => { view?.cancel(); close(); selection.cancel(); store.redo(); };
search.oninput = () => { close(); refresh(); };
search.onkeydown = event => { if (event.key === 'Enter' && shown && !selection.requesting) { selection.set(store.world.nodes.filter(node => shown!.has(key(node.origin))).map(node => node.origin)); search.blur(); refresh(); } };
document.addEventListener('pointerdown', event => {
  if (!tools.hidden && !tools.contains(event.target as Node)) { close(); event.preventDefault(); event.stopPropagation(); }
}, true);
document.addEventListener('keydown', event => {
  const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
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
