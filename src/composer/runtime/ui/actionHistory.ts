import { sameValue } from "../valueEquality.ts";
import { createTransientStore } from "./transientStore.ts";

export type HistoryMode = "recent" | "context" | "selective";
export type HistoryCategory = "omnium" | "ui" | "appearance" | "settings" | "camera";
export type HistoryOptions = { mode: HistoryMode; categories: HistoryCategory[]; steps: number; limit: number; minimum: number };
type Patch = { path: string[]; before: unknown; after: unknown };
type Adapter = { read: () => unknown; write: (value: any) => void };
type Entry = { id: number; owner: string; categories: HistoryCategory[]; contexts: string[]; patches: Patch[]; undone: boolean; group?: string; at: number };
const equal = (a: unknown, b: unknown) => sameValue(a, b);
function diff(before: any, after: any, path: string[] = [], out: Patch[] = []): Patch[] {
  if (before === after) return out;
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before) && !Array.isArray(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], [...path, key], out);
  } else if (!equal(before, after)) out.push({ path, before, after });
  return out;
}
const atPath = (value: any, path: string[]) => path.reduce((node, key) => node?.[key], value);
function put(value: any, path: string[], next: unknown): any {
  if (!path.length) return next;
  const [key, ...tail] = path, copy = { ...value };
  if (!tail.length && next === undefined) delete copy[key];
  else copy[key] = put(value?.[key], tail, next);
  return copy;
}
export type ActionHistory = {
  getSnapshot: () => number; subscribe: (listener: () => void) => () => void; set: (value: number) => void;
  activeContext: string; contextPath: string[]; options: HistoryOptions; message: string;
  register: (owner: string, adapter: Adapter) => () => void;
  configure: (patch: Partial<HistoryOptions>) => void;
  record: (owner: string, before: unknown, after: unknown, categories: HistoryCategory[], contexts: string[], group?: string) => void;
  candidates: (direction: "undo" | "redo", options?: HistoryOptions) => Entry[];
  travel: (direction: "undo" | "redo", options?: HistoryOptions) => number;
};
export function createActionHistory(initial?: Partial<HistoryOptions>): ActionHistory {
  const store = createTransientStore(0), adapters = new Map<string, Adapter>();
  let entries: Entry[] = [], redoOrder: number[] = [], sequence = 0, replaying = false;
  const api: ActionHistory = {
    ...store,
    activeContext: "omnium", contextPath: ["omnium"],
    options: { mode: "recent", categories: ["ui"], steps: 1, limit: 10, minimum: 1 } as HistoryOptions,
    message: "",
    register(owner: string, adapter: Adapter) { adapters.set(owner, adapter); return () => { if (adapters.get(owner) === adapter) adapters.delete(owner); }; },
    configure(patch: Partial<HistoryOptions>) {
      const next = { ...api.options, ...patch };
      next.limit = Math.max(1, Math.min(10, Math.floor(Number(next.limit) || 1)));
      next.minimum = Math.max(1, Math.min(next.limit, Math.floor(Number(next.minimum) || 1)));
      next.steps = Math.max(next.minimum, Math.min(next.limit, Math.floor(Number(next.steps) || 1)));
      api.options = next; store.set(store.getSnapshot() + 1);
    },
    record(owner: string, before: unknown, after: unknown, categories: HistoryCategory[], contexts: string[], group?: string) {
      if (replaying) return;
      const patches = diff(before, after); if (!patches.length) return;
      entries = entries.filter(entry => !entry.undone); redoOrder = [];
      const previous = entries.at(-1), now = Date.now();
      if (group && previous?.group === group && previous.owner === owner && now - previous.at < 700) {
        let original = before;
        for (const patch of previous.patches) original = put(original, patch.path, patch.before);
        previous.patches = diff(original, after); previous.at = now;
        previous.contexts = [...new Set([...previous.contexts, ...contexts])];
        previous.categories = [...new Set([...previous.categories, ...categories])];
      } else entries.push({ id: ++sequence, owner, categories, contexts, patches, undone: false, group, at: now });
      entries = entries.filter(entry => entry.patches.length).slice(-100);
      api.message = ""; store.set(store.getSnapshot() + 1);
    },
    candidates(direction: "undo" | "redo", options = api.options) {
      const ordered = direction === "undo" ? [...entries].reverse() : redoOrder.map(id => entries.find(entry => entry.id === id)!).filter(Boolean);
      return ordered.filter(entry => entry.undone === (direction === "redo") && (options.mode === "recent" || options.mode === "context" && entry.contexts.includes(api.activeContext) || options.mode === "selective" && entry.categories.some(category => options.categories.includes(category))));
    },
    travel(direction: "undo" | "redo", options = api.options) {
      let count = 0; api.message = "";
      const steps = Math.max(options.minimum ?? 1, Math.min(10, options.limit, options.steps));
      for (const entry of api.candidates(direction, options).slice(0, steps)) {
        const adapter = adapters.get(entry.owner); if (!adapter) break;
        let value = adapter.read();
        const expected = direction === "undo" ? "after" : "before", replacement = direction === "undo" ? "before" : "after";
        if (entry.patches.some(patch => !equal(atPath(value, patch.path), patch[expected]))) {
          api.message = "A later edit overlaps this action. Undo the newer overlapping action first."; break;
        }
        for (const patch of entry.patches) value = put(value, patch.path, patch[replacement]);
        replaying = true;
        try { adapter.write(value); } catch { api.message = "This action could not be restored safely; history was left unchanged."; break; } finally { replaying = false; }
        entry.undone = direction === "undo";
        redoOrder = redoOrder.filter(id => id !== entry.id); if (entry.undone) redoOrder.unshift(entry.id);
        count++;
      }
      store.set(store.getSnapshot() + 1); return count;
    },
  };
  if (initial) api.configure({
    ...(initial.mode && ["recent", "context", "selective"].includes(initial.mode) ? { mode: initial.mode } : {}),
    ...(Array.isArray(initial.categories) ? { categories: initial.categories.filter(id => ["omnium", "ui", "appearance", "settings", "camera"].includes(id)) } : {}),
    steps: initial.steps ?? 1, limit: initial.limit ?? 10, minimum: initial.minimum ?? 1,
  });
  return api;
}

