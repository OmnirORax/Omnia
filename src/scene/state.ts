import { normalizeSceneVfx, type SceneVfx } from './vfx.ts';
import { defaultNormalizationPreferences, type NormalizationPreferences } from './normalization.ts';
import { DEFAULT_SCENE_PROMPT, type SceneSource } from './contracts.ts';
export type SceneSettings = { image: string | null; vfx: SceneVfx; normalization: NormalizationPreferences; presets: Record<string, string | number | boolean>; prompt: string; variable: string; source: SceneSource };
export const defaultScene = (): SceneSettings => ({ image: null, vfx: normalizeSceneVfx(undefined), normalization: defaultNormalizationPreferences(), presets: {}, prompt: DEFAULT_SCENE_PROMPT, variable: 'subject', source: 'label-and-notes' });
