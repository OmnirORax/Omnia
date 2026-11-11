import { panel } from './panel.ts';
import { checkedWorld, sceneReferences, encodeBytes, decodeScene, parseWorkspaceFile, rebindScenes, TRANSFER_BYTES, type WorkspaceFile } from '../core/transfer.ts';
import type { World } from '../core/model.ts';
import { listLocalScenes, localSceneBlob, prepareLocalScene, saveLocalScenes, downloadScene, deleteLocalScene, type StoredScene } from '../scene/library.ts';

type Host = { read: () => World; replace: (world: World) => void; recover: () => void; beforeReplace: () => void };
export function workspacePanel(host: Host) {
  let live = true, busy = false;
  const view = panel('Workspace', () => { if (busy) return false; live = false; });
  const actions = document.createElement('div'), output = document.createElement('output'); output.setAttribute('role', 'status'); view.body.append(actions, output);
  const buttons: HTMLButtonElement[] = [];
  async function run(action: () => void | Promise<void>) {
    if (busy) return;
    busy = true; buttons.forEach(button => button.disabled = true); output.textContent = '';
    try { await action(); } catch (error) { output.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; buttons.forEach(button => button.disabled = false); }
  }
  function button(label: string, action: () => void) { const b = document.createElement('button'); b.textContent = label; b.onclick = action; buttons.push(b); actions.append(b); }
  button('Export', () => void run(async () => {
    const world = structuredClone(checkedWorld(host.read())), references = sceneReferences(world);
    const metadata = new Map((references.size ? await listLocalScenes() : []).map(item => [item.id, item]));
    const file: WorkspaceFile = { format: 'omnium-v2-workspace', version: 1, world, scenes: [] };
    // Encode each referenced original once; no normalized cache or device credentials.
    for (const id of references) {
      const item = metadata.get(id); if (!item) throw Error('A scene image is missing. Restore or clear it before exporting.');
      const blob = await localSceneBlob(id);
      file.scenes.push({ id, name: item.name, type: item.type, data: encodeBytes(new Uint8Array(await blob.arrayBuffer())) });
    }
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    if (blob.size > TRANSFER_BYTES) throw Error('Workspace file exceeds 145 MiB.');
    downloadScene(blob, 'omnium-workspace.json'); output.textContent = 'Exported';
  }));
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'; input.hidden = true; view.body.append(input);
  button('Import', () => input.click());
  input.onchange = () => {
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    void run(async () => {
      if (file.size > TRANSFER_BYTES) throw Error('Workspace file exceeds 145 MiB.');
      const baseline = host.read(), source = parseWorkspaceFile(await file.text());
      if (!live) return;
      if (!confirm('Replace this workspace? The previous workspace is kept for recovery.')) return;
      const prepared: StoredScene[] = [], ids = new Map<string, string>();
      for (const image of source.scenes) {
        const bytes = decodeScene(image);
        const item = await prepareLocalScene(new File([bytes as Uint8Array<ArrayBuffer>], image.name, { type: image.type }), null);
        prepared.push(item); ids.set(image.id, item.id);
      }
      const world = rebindScenes(source.world, ids);
      if (host.read() !== baseline) throw Error('Workspace changed during import. Retry.');
      const existing = new Set((prepared.length ? await listLocalScenes() : []).map(item => item.id));
      await saveLocalScenes(prepared);
      try {
        if (host.read() !== baseline) throw Error('Workspace changed during import. Retry.');
        host.beforeReplace(); host.replace(world); output.textContent = 'Imported';
      } catch (error) {
        if (host.read() === baseline) await Promise.allSettled([...new Set(prepared.map(item => item.id))].filter(id => !existing.has(id)).map(deleteLocalScene));
        throw error;
      }
    });
  };
  button('Recover previous', () => void run(() => {
    if (!confirm('Restore the workspace from before the last replacement?')) return;
    host.beforeReplace(); host.recover(); output.textContent = 'Recovered';
  }));
  return view;
}
