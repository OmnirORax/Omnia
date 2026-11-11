import { emptyWorld, validateWorld, type World } from './model.ts';
import { startHistory, recordHistory, undoHistory, redoHistory } from './history.ts';

const slot = 'omnium.v2.world.2';
export function createStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  let recovery = false, message = '';
  let world = emptyWorld();
  try {
    const saved = storage.getItem(slot) ?? storage.getItem('omnium.v2.world.1');
    if (saved !== null) {
      if (saved.length > 4e6) throw new Error('Saved world exceeds this version’s limit.');
      world = validateWorld(JSON.parse(saved));
      world = { ...emptyWorld(), ...world, version: 2 };
    }
  } catch (error) { recovery = true; message = `${error instanceof Error ? error.message : 'Storage unavailable.'} The original save is preserved; saving is paused.`; }
  let history = startHistory(world);
  const listeners = new Set<() => void>();
  function publish() {
    if (!recovery) {
      try { storage.setItem(slot, JSON.stringify(history.present)); message = ''; }
      catch { message = 'Saving failed. This world remains in this tab; keep it open.'; }
    }
    listeners.forEach(listener => listener());
  }
  return {
    get world() { return history.present; },
    get message() { return message; },
    get canUndo() { return history.past.length > 0; },
    get canRedo() { return history.future.length > 0; },
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    change(edit: (candidate: World) => void, group?: string) {
      const candidate = structuredClone(history.present); edit(candidate); validateWorld(candidate);
      const next = recordHistory(history, candidate, group);
      if (next !== history) { history = next; publish(); }
    },
    undo() { const next = undoHistory(history); if (next !== history) { history = next; publish(); } },
    redo() { const next = redoHistory(history); if (next !== history) { history = next; publish(); } },
  };
}
