import { DEFAULT_BACKGROUND } from './defaultBackground.ts';
import { audioControls } from './audioControls.ts';
import { normalizeSceneVfx } from './vfx.ts';
import { panel } from '../ui/panel.ts';
import { field } from '../ui/fields.ts';
import { liveForm } from '../ui/liveForm.ts';
import { property, type Property, type Value } from '../properties/pool.ts';
import vfxFunction from './vfx.function.ts';
import { defaultScene, type SceneSettings } from './state.ts';
import { NORMALIZATION_FIELDS, normalizationProperty, normalizationPreferences } from './normalization.ts';
import { WAVE_CONTROLS, WAVE_PRESETS, serializeSceneVfx } from './vfx.ts';
import { readWavePresets, appendWavePreset } from './wavePresets.ts';
import { importLocalScene, listLocalScenes, localSceneBlob, downloadScene, deleteLocalScene, saveCopiedPrompt, type ScenePromptSnapshot } from './library.ts';
import { sceneAudioSnapshot, subscribeSceneAudio, toggleSceneSystemAudio, forgetSceneSystemAudio } from './audio.ts';
import { readSystemAudioPreference } from './systemAudioPreference.ts';
import { resolveScenePrompt } from './contracts.ts';
import { locate, sameOrigin, type Origin, type World } from '../core/model.ts';
import type { createSceneSession } from './session.ts';

type Host = { subscribe:(listener:()=>void)=>()=>void; read: () => World; selected: () => readonly Origin[]; change: (edit: (world: World) => void, group?: string) => void; preview: (world: World) => void; session: ReturnType<typeof createSceneSession>; feedback: (text: string) => void };
export function scenePanel(host: Host) {
  let live = true; let target: Origin | undefined = host.selected()[0];
  const subscriptions: (() => void)[] = [];
  const view = panel('Scene', () => { live = false; for (const stop of subscriptions.splice(0)) stop(); host.preview(host.read()); });
  const navigation = document.createElement('nav'), body = document.createElement('div'); navigation.className = 'scene-tabs'; body.className = 'scene-content'; view.body.append(navigation, body);
  function attempt(action: () => void | Promise<void>) { void Promise.resolve().then(action).catch(error => host.feedback(error instanceof Error ? error.message : String(error))); }
  function button(label: string, action: () => void | Promise<void>, parent: HTMLElement = body) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => attempt(action); parent.append(b); return b; }
  function clear() { for (const stop of subscriptions.splice(0)) stop(); body.replaceChildren(); }
  function update(edit: (settings: SceneSettings) => void, group?: string) { host.change(world => { world.scene ??= defaultScene(); edit(world.scene); }, group); }
  function currentImage() { const w = host.read(), node = target && locate(w, target); return node?.scene !== undefined ? node.scene : w.scene?.image ?? null; }
  function assign(image: string | null) { host.change(world => { if (target) { const node = locate(world, target); if (!node) throw Error('Image destination no longer exists.'); node.scene = image; } else { world.scene ??= defaultScene(); world.scene.image = image; } }); }
  function promptSnapshot(): ScenePromptSnapshot {
    const world = host.read(), node = target && locate(world, target); if (!node) throw Error('Select a node for the prompt input.');
    const settings = world.scene ?? defaultScene(), input = { id: JSON.stringify(node.origin), label: node.label, notes: node.text?.content.map(part => typeof part === 'string' ? part : part.word ?? '').join('') ?? '' };
    return { prompt: settings.prompt, variable: settings.variable, source: settings.source, node: input, resolved: resolveScenePrompt(settings.prompt, settings.variable, settings.source, input), copiedAt: new Date().toISOString() };
  }
  async function receive(file: File, captured: Origin | undefined, previous: string | null) {
    const input = captured ? (() => { try { return promptSnapshot(); } catch { return null; } })() : null;
    const image = await importLocalScene(file, input);
    if (!live) return;
    if ((captured === undefined && target === undefined || captured && target && sameOrigin(captured, target)) && currentImage() === previous && (!captured || locate(host.read(), captured))) assign(image.id);
    else host.feedback('Image saved in the library; its destination changed. Apply it when ready.');
    await images();
  }
  async function images() {
    clear();
    const scope = document.createElement('select'); scope.setAttribute('aria-label', 'Scene destination');
    for (const [value, label] of [['default','Default background'],['node','Selected node']]) { const option = document.createElement('option'); option.value = value; option.textContent = label; if (value === 'node') option.disabled = !host.selected().length; scope.append(option); }
    scope.value = target ? 'node' : 'default'; scope.onchange = () => { target = scope.value === 'node' ? host.selected()[0] : undefined; void images(); }; body.append(scope);
    button('Import image', () => { const file = document.createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp'; const captured = target, previous = currentImage(); file.onchange = () => { if (file.files?.[0]) attempt(() => receive(file.files![0], captured, previous)); }; file.click(); });
    button('Paste image', async () => {
      const captured = target, previous = currentImage(), clipboard = await navigator.clipboard.read();
      for (const item of clipboard) { const type = item.types.find(type => ['image/png','image/jpeg','image/webp'].includes(type)); if (type) { await receive(new File([await item.getType(type)], 'Pasted scene', { type }), captured, previous); return; } }
      throw Error('No image found on the clipboard.');
    });
    button('Clear background', () => assign(null));
    if (target) button('Use default background', () => host.change(world => { const node = locate(world, target!); if (node) delete node.scene; }));
    const list = document.createElement('div'); body.append(list);
    const items = await listLocalScenes(); if (!live || !list.isConnected) return;
    for (const item of items) {
      const row = document.createElement('div'); row.className = 'scene-image-row';
      button(`${currentImage() === item.id ? '✓ ' : ''}${item.name}`, () => { assign(item.id); return images(); }, row);
      button('↓', async () => downloadScene(await localSceneBlob(item.id), item.name), row).title = 'Download original';
      if(item.id!==DEFAULT_BACKGROUND.id)button('×', async () => {
        if (!confirm(`Delete “${item.name}” from this browser? Download it first to retain the original image.`)) return;
        host.change(world => { if (world.scene?.image === item.id) world.scene.image = null; for (const node of world.nodes) if (node.scene === item.id) delete node.scene; });
        await deleteLocalScene(item.id); await images();
      }, row).title = 'Delete image'; list.append(row);
    }
  }
  function controls(group: 'waves' | 'pulse' | 'normalization' | 'prompt') {
    clear();
    if (group === 'waves') {
      const row = document.createElement('div'); row.className = 'preset-row';
      button('+', () => { update(settings => { settings.presets = appendWavePreset(settings.presets, settings.vfx.waves, settings.vfx); }); controls('waves'); }, row).title = 'Save current waves as preset';
      for (const [index, preset] of WAVE_PRESETS.entries()) button(String(index + 1), () => { update(settings => { Object.assign(settings.vfx, preset); }); controls('waves'); }, row);
      for (const preset of readWavePresets(host.read().scene?.presets)) button(preset.id.slice(6), () => { update(settings => { Object.assign(settings.vfx, preset.values, { waves: preset.waves }); }); controls('waves'); }, row);
      body.append(row);
    }
    const form = document.createElement('form'), values: { key: string; get: () => Value }[] = [];
    if (group === 'normalization') {
      const settings = host.read().scene ?? defaultScene();
      for (const definition of NORMALIZATION_FIELDS) {
        const p = property({ key: normalizationProperty(definition.key), label: definition.label, kind: definition.kind, ...(definition.kind === 'number' ? { min: definition.min, max: definition.max, step: .01 } : {}) });
        const input = field(p, settings.normalization[definition.key]); form.append(input.row); values.push({ key: p.key, get: input.value });
      }
    } else if (group === 'prompt') {
      const settings = host.read().scene ?? defaultScene();
      const definitions: Property[] = [{ key:'prompt',label:'Prompt',kind:'text' },{ key:'variable',label:'Variable',kind:'text' },{ key:'source',label:'Input',kind:'select',options:[{id:'label',label:'Label'},{id:'notes',label:'Document'},{id:'label-and-notes',label:'Label + document'}] }];
      for (const p of definitions) { const input = field(property({ ...p, key: `scene.${p.key}` }), settings[p.key as 'prompt' | 'variable' | 'source']); form.append(input.row); values.push({ key: p.key, get: input.value }); }
    } else {
      const state = { sceneVfx: host.read().scene?.vfx ?? defaultScene().vfx };
      for (const [key, binding] of Object.entries(vfxFunction.inputs)) {
        const wave = key === 'scene.waves' || key === 'scene.maxFps' || WAVE_CONTROLS.some(control => `scene.${control.key}` === key);
        if(wave !== (group === 'waves')) continue;
        const input = field({ ...binding.definition, key }, binding.read(state)); form.append(input.row); values.push({ key, get: input.value });

      }
    }
    const apply = (settings: SceneSettings) => {
      const entries = Object.fromEntries(values.map(input => [input.key, input.get()]));
      if (group === 'normalization') settings.normalization = normalizationPreferences(entries);
      else if (group === 'prompt') Object.assign(settings, entries);
      else for (const [key, value] of Object.entries(entries)) settings.vfx = vfxFunction.inputs[key].write({ sceneVfx: settings.vfx }, value).sceneVfx;
    };
    liveForm(form, undoGroup => { try { update(apply, undoGroup); } catch (error) { host.feedback(error instanceof Error ? error.message : String(error)); } });
    body.append(form);
    if (group === 'prompt') button('Copy resolved prompt', async () => { const input = promptSnapshot(); await navigator.clipboard.writeText(input.resolved); saveCopiedPrompt(input); host.feedback('Prompt copied. Import or paste the resulting image.'); });
    if (group === 'normalization') {
      const output = document.createElement('output'); body.append(output);
      const report = () => { const r = host.session.report; output.textContent = r ? `Luminance ${r.after.luminance.toFixed(2)} · Contrast ${r.after.contrast.toFixed(2)} · Saturation ${r.after.saturation.toFixed(2)}${r.unmet.length ? ` · Unmet: ${r.unmet.join(', ')}` : ''}` : ''; };
      const unsubscribe = host.session.subscribe(() => { if (!output.isConnected) unsubscribe(); else report(); }); subscriptions.push(unsubscribe); report();
    }
  }
  function audio() {
    clear();
    const code = document.createElement('input'); code.type = 'password'; code.placeholder = 'Helper pairing code'; code.setAttribute('aria-label', 'System audio pairing code'); code.autocomplete = 'off'; code.value = readSystemAudioPreference()?.code ?? ''; body.append(code);
    button('System audio', () => toggleSceneSystemAudio(code.value)); button('Forget connection', () => { forgetSceneSystemAudio(); code.value = ''; });
    button('Light settings',()=>controls('pulse'));
    const response=audioControls({
      read:()=>normalizeSceneVfx(host.read().scene?.vfx).audioResponse,
      write:(value,group)=>update(settings=>{settings.vfx={...normalizeSceneVfx(settings.vfx),audioResponse:value};},group),
      subscribe:host.subscribe,
      error:error=>host.feedback(error instanceof Error?error.message:String(error)),
    });
    body.append(response.root);subscriptions.push(()=>response.dispose());
    button('Copy settings',async()=>{await navigator.clipboard.writeText(serializeSceneVfx(host.read().scene?.vfx));host.feedback('Audio settings copied');});
    const output = document.createElement('output'); body.append(output);
    const statusUpdate = () => { output.textContent = sceneAudioSnapshot().status; };
    const unsubscribe = subscribeSceneAudio(() => { if (!output.isConnected) unsubscribe(); else statusUpdate(); }); subscriptions.push(unsubscribe); statusUpdate();
  }
  for (const [label, action] of [['Image', () => void images()],['Waves', () => controls('waves')],['Pulse', () => controls('pulse')],['Audio', audio],['Normalize', () => controls('normalization')],['Prompt', () => controls('prompt')]] as const) button(label, action, navigation);
  attempt(images); return view;
}
