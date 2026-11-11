import type { createWallpaper } from './wallpaper.ts';
import { localSceneBlob } from './library.ts';
import { createNormalizationProcessor, normalizeSceneBlob } from './normalizationCache.ts';
import { normalizationKey, type NormalizationReport } from './normalization.ts';
import { defaultScene } from './state.ts';
import { startRememberedSystemAudio } from './audio.ts';
import { locate, type Origin, type World } from '../core/model.ts';

export function createSceneSession(wallpaper: ReturnType<typeof createWallpaper>, feedback: (message: string) => void) {
  let source: string | null | undefined, original: Blob | undefined, url: string | undefined, epoch = 0, running = false;
  let controller = new AbortController(), processor = createNormalizationProcessor();
  let preferences = defaultScene().normalization, wanted = '', completed = '', vfx = '';
  let report: NormalizationReport | null = null;
  const stopAudio = startRememberedSystemAudio();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  async function normalize() {
    if (running || !original || wanted === completed) return;
    running = true; const mine = epoch;
    try {
      while (original && mine === epoch && wanted !== completed) {
        const settings = preferences, stamp = wanted;
        if (!settings.enabled) { wallpaper.setCorrection(null); report = null; completed = stamp; publish(); continue; }
        const result = await normalizeSceneBlob(original, settings, { preview: true, persistent: false, processor, signal: controller.signal });
        if (mine !== epoch) return;
        report = result.report; completed = stamp; wallpaper.setCorrection(report.corrections); publish();
      }
    } catch (error) { if (mine === epoch) { completed = wanted; wallpaper.setCorrection(null); feedback(error instanceof Error ? error.message : String(error)); } }
    finally { if (mine === epoch) running = false; }
  }
  return {
    get report() { return report; },
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    update(world: World, selected?: Origin) {
      const settings = world.scene ?? defaultScene(), stamp = JSON.stringify(settings.vfx);
      if (stamp !== vfx) { vfx = stamp; wallpaper.configure(settings.vfx); }
      preferences = settings.normalization; wanted = `${preferences.enabled}:${normalizationKey(preferences)}`;
      const node = selected && locate(world, selected), next = node && node.scene !== undefined ? node.scene : settings.image;
      if (next !== source) {
        source = next; const mine = ++epoch; controller.abort(); processor.dispose(); controller = new AbortController(); processor = createNormalizationProcessor();
        original = undefined; report = null; completed = ''; running = false;
        if (url) URL.revokeObjectURL(url); url = undefined; void wallpaper.setURL(null); publish();
        if (next) void localSceneBlob(next).then(async blob => {
          if (mine !== epoch) return;
          original = blob; url = URL.createObjectURL(blob); await wallpaper.setURL(url);
          if (mine === epoch) void normalize();
        }).catch(error => { if (mine === epoch) feedback(error instanceof Error ? error.message : String(error)); });
      } else void normalize();
    },
    dispose() { ++epoch; controller.abort(); processor.dispose(); if (url) URL.revokeObjectURL(url); stopAudio(); wallpaper.dispose(); },
  };
}
