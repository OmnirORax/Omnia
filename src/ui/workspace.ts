import { panel } from './panel.ts';
import { checkedWorld, sceneReferences, encodeBytes, decodeScene, rebindScenes, TRANSFER_BYTES } from '../core/transfer.ts';
import { availableChoice, createPartsFile, fullChoice, hasChoice, parsePartsFile, preparePartsImport, scenesForChoice, type PartsFile, type TransferChoice } from '../core/transferParts.ts';
import type { World } from '../core/model.ts';
import { listLocalScenes, localSceneBlob, prepareLocalScene, saveLocalScenes, downloadScene, deleteLocalScene, type StoredScene } from '../scene/library.ts';

type Host = { omnic?:()=>void;atlas?:()=>void;draft?: HTMLButtonElement; read: () => World; replace: (world: World) => void; recover: () => void; beforeReplace: () => void; selected?: () => string[] };
export function workspacePanel(host: Host) {
  let live = true, busy = false;
  const view = panel('Workspace', () => { if (busy) return false; live = false; });
  const actions = document.createElement('div'), output = document.createElement('output'); output.setAttribute('role', 'status'); view.body.append(actions, output);
  const buttons: HTMLButtonElement[] = [];
  if(host.draft){actions.append(host.draft);buttons.push(host.draft);}
  const options = document.createElement('fieldset'), filename = document.createElement('input');
  options.className = 'transfer-parts';
  filename.value = 'omnium-workspace'; filename.setAttribute('aria-label', 'File name'); filename.maxLength = 100;
  view.body.prepend(filename, options);
  let source: PartsFile | undefined, baseline: World | undefined, choice: TransferChoice, replace = false;
  function choices() {
    options.replaceChildren();
    const world = source?.world ?? host.read(), available = source ? availableChoice(source) : fullChoice(world);
    choice = structuredClone(available);
    function check(label: string, checked: boolean, change: (value: boolean) => void) {
      const row = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.checked = checked;
      input.onchange = () => change(input.checked); row.append(input, document.createTextNode(label)); options.append(row); return input;
    }
    const availableNodes = new Set(available.nodes), nodeInputs = new Map<string, HTMLInputElement>();
    const partInputs = new Map<'settings' | 'scene' | 'appearance', HTMLInputElement>();
    const all = check('All', true, value => { choice = value ? structuredClone(available) : { nodes: [], settings: false, scene: false, appearance: false }; draw(); });
    const rows = document.createElement('div'); options.append(rows);
    world.nodes.forEach((node, index) => {
      const id = JSON.stringify(node.origin); if (!availableNodes.has(id)) return;
      const input = check(node.label || `Node ${index + 1}`, true, value => { choice.nodes = value ? [...choice.nodes, id] : choice.nodes.filter(key => key !== id); draw(); });
      rows.append(input.parentElement!); nodeInputs.set(id, input);
    });
    for (const [part, label] of [['settings','World settings'],['scene','Scene settings'],['appearance','Appearance']] as const) if (available[part]) {
      const input = check(label, true, value => { choice[part] = value; draw(); }); rows.append(input.parentElement!); partInputs.set(part, input);
    }
    function draw() {
      all.checked = choice.nodes.length === available.nodes.length && ['settings','scene','appearance'].every(part => choice[part as 'settings'] === available[part as 'settings']);
      all.indeterminate = hasChoice(choice) && !all.checked;
      const chosen = new Set(choice.nodes);
      nodeInputs.forEach((input, id) => { input.checked = chosen.has(id); });
      partInputs.forEach((input, part) => { input.checked = choice[part]; });
    }
    draw();
    if (!source && host.selected) {
      const selected = document.createElement('button'); selected.textContent = 'Current selection'; selected.onclick = () => { choice = { nodes: host.selected!().filter(id => available.nodes.includes(id)), settings: false, scene: false, appearance: false }; draw(); }; options.append(selected);
    }
    if (source && source.parts?.complete !== false) check('Replace content', replace, value => { replace = value; });
  }
  choices();
  async function run(action: () => void | Promise<void>) {
    if (busy) return;
    busy = true; options.disabled = true; filename.disabled = true; buttons.forEach(button => button.disabled = true); output.textContent = '';
    try { await action(); } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; options.disabled = false; filename.disabled = false; buttons.forEach(button => button.disabled = false); }
  }
  function button(label: string, action: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = action; buttons.push(b); actions.append(b); }
  if(host.omnic)button('Omnic',host.omnic);if(host.atlas)button('Atlas',host.atlas);
  button('Export', () => void run(async () => {
    if (source) throw Error('Choose New export first.');
    const file = createPartsFile(structuredClone(checkedWorld(host.read())), choice), references = sceneReferences(file.world);
    const metadata = new Map((references.size ? await listLocalScenes() : []).map(item => [item.id, item]));
    // Encode each referenced original once; no normalized cache or device credentials.
    for (const id of references) {
      const item = metadata.get(id); if (!item) throw Error('A scene image is missing. Restore or clear it before exporting.');
      const blob = await localSceneBlob(id);
      file.scenes.push({ id, name: item.name, type: item.type, data: encodeBytes(new Uint8Array(await blob.arrayBuffer())) });
    }
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    if (blob.size > TRANSFER_BYTES) throw Error('Workspace file exceeds 145 MiB.');
    downloadScene(blob, `${filename.value.trim().replace(/[^a-zA-Z0-9 _.-]/g, '_').replace(/\.json$/i, '') || 'omnium-workspace'}.json`); output.textContent = 'Exported';
  }));
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; view.body.append(input);
  button('Import', () => input.click());
  input.onchange = () => {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    void run(async () => {
      if (file.size > TRANSFER_BYTES) throw Error('Workspace file exceeds 145 MiB.');
      const candidate = parsePartsFile(await file.text());
      if (!live) return;
      source = candidate; baseline = host.read(); replace = false; choices(); output.textContent = 'Choose parts, then Import selected';
    });
  };
  button('New export', () => { source = undefined; baseline = undefined; choices(); output.textContent = ''; });
  button('Import selected', () => void run(async () => {
      if (!source || !baseline) throw Error('Open an import file first.');
      if (!hasChoice(choice)) throw Error('Choose at least one part.');
      if (replace && !confirm('Replace workspace content? The previous workspace is kept for recovery.')) return;
      const required = scenesForChoice(source, choice);
      const prepared: StoredScene[] = [], ids = new Map<string, string>();
      for (const image of source.scenes.filter(image => required.has(image.id))) {
        const bytes = decodeScene(image);
        const item = await prepareLocalScene(new File([bytes as Uint8Array<ArrayBuffer>], image.name, { type: image.type }), null);
        prepared.push(item); ids.set(image.id, item.id);
      }
      const selectedFile = { ...source, world: rebindScenes(createPartsFile(source.world, choice).world, ids) };
      const world = preparePartsImport(baseline, selectedFile, choice, replace);
      if (host.read() !== baseline) throw Error('Workspace changed during import. Retry.');
      const existing = new Set((prepared.length ? await listLocalScenes() : []).map(item => item.id));
      await saveLocalScenes(prepared);
      try {
        if (host.read() !== baseline) throw Error('Workspace changed during import. Retry.');
        host.beforeReplace(); host.replace(world); baseline = host.read(); output.textContent = 'Imported';
      } catch (error) {
        if (host.read() === baseline) await Promise.allSettled([...new Set(prepared.map(item => item.id))].filter(id => !existing.has(id)).map(deleteLocalScene));
        throw error;
      }
    }));
  button('Recover previous', () => void run(() => {
    if (!confirm('Restore the workspace from before the last replacement?')) return;
    host.beforeReplace(); host.recover(); output.textContent = 'Recovered';
  }));
  return view;
}
