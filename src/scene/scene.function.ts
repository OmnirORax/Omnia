import { defineFunction } from '../properties/function.ts';
import type { WorkspaceSettings } from '../workspaceActions';
import { DEFAULT_SCENE_PROMPT } from '../../supabase/functions/_shared/contracts.ts';

export const SCENE_FUNCTION = 'scene.generate';
export function sceneInput(settings: WorkspaceSettings, id: string, initial: string) {
  return String(settings.functionValues[SCENE_FUNCTION]?.[id] ?? initial);
}
const write = (settings: WorkspaceSettings, id: string, value: string) => ({ ...settings,
  functionValues: { ...settings.functionValues, [SCENE_FUNCTION]: { ...settings.functionValues[SCENE_FUNCTION], [id]: value } } });
export default defineFunction<WorkspaceSettings>({
  id: SCENE_FUNCTION, label: 'Scene generation', owner: 'settings', controls: ['scene.copyPrompt', 'scene.generate', 'scene.prompt', 'scene.variable', 'scene.source'],
  group: [{ id: 'scene', label: 'Scene' }], inputs: {
    'scene.prompt': {
      definition: { id: 'scene.prompt', label: 'Image prompt', kind: 'text', maxLength: 4000, multiline: true, initial: DEFAULT_SCENE_PROMPT, category: { id: 'scene', label: 'Scene' } },
      read: settings => sceneInput(settings, 'scene.prompt', DEFAULT_SCENE_PROMPT),
      write: (settings, value) => write(settings, 'scene.prompt', String(value).slice(0, 4000)),
    },
    'scene.variable': {
      definition: { id: 'scene.variable', label: 'Prompt variable', kind: 'text', maxLength: 32, initial: 'subject', category: { id: 'scene', label: 'Scene' } },
      read: settings => sceneInput(settings, 'scene.variable', 'subject'),
      write: (settings, value) => write(settings, 'scene.variable', String(value).slice(0, 32)),
    },
    'scene.source': {
      definition: { id: 'scene.source', label: 'Active node input', kind: 'select', initial: 'label-and-notes',
        options: [{ id: 'label-and-notes', label: 'Label and notes' }, { id: 'label', label: 'Label' }, { id: 'notes', label: 'Notes' }],
        category: { id: 'scene', label: 'Scene' } },
      read: settings => sceneInput(settings, 'scene.source', 'label-and-notes'),
      write: (settings, value) => write(settings, 'scene.source', String(value)),
    },
  },
});
