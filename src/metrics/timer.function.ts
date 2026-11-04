import { defineFunction } from '../properties/function.ts';
import type { WorkspaceSettings } from '../workspaceActions';
export const TIMER_CONSUMER = 'metrics.timer';
export const TIMER_MODE = 'metrics.timer.mode';
export const TIMER_DURATION = 'metrics.timer.duration';
const category = { id: 'metrics', label: '♾️' };
/** Preferences use the existing functionValues owner, UI history and templates.
 * Scores, clock samples and runs are deliberately transient. */
export default defineFunction<WorkspaceSettings>({
  id: TIMER_CONSUMER, label: 'Score tracker timer', owner: 'settings', controls: ['metrics.start'],
  group: [{ ...category, self: true }], inputs: {
    [TIMER_MODE]: {
      definition: { id: TIMER_MODE, label: 'Timer mode', kind: 'select', initial: 'stopwatch', category,
        options: [{ id: 'stopwatch', label: 'Stopwatch' }, { id: 'countdown', label: 'Countdown' }] },
      read: settings => settings.functionValues[TIMER_CONSUMER]?.[TIMER_MODE] ?? 'stopwatch',
      write: (settings, value) => ({ ...settings, functionValues: { ...settings.functionValues, [TIMER_CONSUMER]: { ...settings.functionValues[TIMER_CONSUMER], [TIMER_MODE]: value } } }),
    },
    [TIMER_DURATION]: {
      definition: { id: TIMER_DURATION, label: 'Duration', kind: 'number', initial: 10, min: 1, max: 86400, step: 1, unit: 'seconds', category },
      read: settings => settings.functionValues[TIMER_CONSUMER]?.[TIMER_DURATION] ?? 10,
      write: (settings, value) => ({ ...settings, functionValues: { ...settings.functionValues, [TIMER_CONSUMER]: { ...settings.functionValues[TIMER_CONSUMER], [TIMER_DURATION]: value } } }),
    },
  },
});
