import { emptyWorld, validateWorld, type World } from './model.ts';
import { checkedWorld } from './transfer.ts';
import { startHistory, recordHistory, undoHistory, redoHistory } from './history.ts';

const slot2 = 'omnium.v2.world.2',slot3='omnium.v2.world.3';

export function createStore(storage: Pick<Storage, 'getItem' | 'setItem'>) {
  let recovery = false, message = '';
  let world = emptyWorld();
  try {
    const saved = storage.getItem(slot3) ?? storage.getItem(slot2) ?? storage.getItem('omnium.v2.world.1');
    if (saved !== null) {
      if (saved.length > 4e6) throw new Error('Saved world exceeds this version’s limit.');
      world = validateWorld(JSON.parse(saved));
      world = { ...emptyWorld(), ...world, version: world.version===3?3:2 };
    }
  } catch (error) { recovery = true; message = `${error instanceof Error ? error.message : 'Storage unavailable.'} The original save is preserved; saving is paused.`; }
  let history = startHistory(world),promoted=world.version===3;
  const retainVersion=(next:typeof history)=>{if(next.present.version===3)promoted=true;return promoted&&next.present.version!==3?{...next,present:{...next.present,version:3 as const}}:next;};
  const listeners = new Set<() => void>();
  const slot=()=>promoted?slot3:slot2;
  function publish() {
    if (!recovery) {
      try { storage.setItem(slot(), JSON.stringify(history.present)); message = ''; }
      catch { message = 'Saving failed. This world remains in this tab; keep it open.'; }
    }
    listeners.forEach(listener => listener());
  }
  function replace(value: unknown) {
    const candidate = structuredClone(checkedWorld(value));
    if(promoted)candidate.version=3;
    // Save recovery first. A quota/storage failure must leave the active world untouched.
    const before = recovery ? storage.getItem(slot3) ?? storage.getItem(slot2) ?? storage.getItem('omnium.v2.world.1') ?? JSON.stringify(history.present) : JSON.stringify(history.present);
    const targetSlot=candidate.version===3?slot3:slot2;
    storage.setItem(`${targetSlot}.before-import`, before);
    storage.setItem(candidate.version===3?slot3:slot2, JSON.stringify(candidate));
    history = retainVersion(recordHistory(history, candidate)); recovery = false; message = '';
    listeners.forEach(listener => listener());
  }
  return {
    replace,
    recover() {
      const saved = storage.getItem(`${slot()}.before-import`);
      if (saved === null) throw Error('No workspace replacement backup exists.');
      replace(JSON.parse(saved));
    },
    get world() { return history.present; },
    get message() { return message; },
    get canUndo() { return history.past.length > 0; },
    get canRedo() { return history.future.length > 0; },
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener); },
    change(edit: (candidate: World) => void, group?: string) {
      const candidate = structuredClone(history.present); edit(candidate); validateWorld(candidate);
      const next = recordHistory(history, candidate, group);
      if (next !== history) { history = retainVersion(next); publish(); }
    },
    undo() { const next = undoHistory(history); if (next !== history) { history = retainVersion(next); publish(); } },
    redo() { const next = redoHistory(history); if (next !== history) { history = retainVersion(next); publish(); } },
  };
}
