import type { ActionHistory } from "../ui/actionHistory.ts";
import { validateRecipe, type Recipe } from "./model.ts";
export type ComposerDraft = { recipe: Recipe; baseRevision: number | null };
type StorageAdapter = Pick<Storage,"getItem"|"setItem">;
const closed = new Map<string,()=>ComposerDraft>();
const cleanups = new Map<string,()=>void>();
export const closedComposerDraft = (owner: string) => closed.get(owner)?.();
export const forgetClosedComposerDraft = (owner: string) => { cleanups.get(owner)?.(); closed.delete(owner); };
const browserStorage = ():StorageAdapter|undefined => { try { return typeof localStorage === "undefined" ? undefined : localStorage; } catch { return undefined; } };
const normalized = (recipe: Recipe) => ({...recipe,revision:0});
/** A closed composer remains an undoable owner without keeping React callbacks or
 * rendering state alive. Browser storage is primary; one recipe is the fallback. */
export function preserveClosedComposerHistory(history: ActionHistory, owner: string, key: string, initial: ComposerDraft, storage: StorageAdapter | undefined = browserStorage()) {
  let memory = initial, storageBroken = !storage;
  // React can unmount before its last persistence effect. Flush the actual live
  // snapshot first so a stale storage value cannot block the latest undo patch.
  if (storage) { try { storage.setItem(key,JSON.stringify(initial)); } catch { storageBroken = true; } }
  // The journal is capped at 100 entries. Keep closed adapters only for owners
  // still present there, rather than retaining every object ever inspected.
  const recent = {...history.options,mode:"recent" as const};
  const owners = new Set([...history.candidates("undo",recent),...history.candidates("redo",recent)].map(entry=>entry.owner));
  for (const prior of closed.keys()) if (!owners.has(prior)) cleanups.get(prior)?.();
  if (!owners.has(owner)) return () => {};
  const read = ():ComposerDraft => {
    if (!storageBroken && storage) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const value = JSON.parse(raw);
          memory = {recipe:validateRecipe(value.recipe),baseRevision:Number.isSafeInteger(value.baseRevision)?value.baseRevision:null};
        }
      } catch { storageBroken = true; }
    }
    return memory;
  };
  const stop = history.register(owner, {
    read: () => normalized(read().recipe),
    write: value => {
      const before = read();
      memory = {...before,recipe:validateRecipe({...value,revision:before.recipe.revision})};
      if (!storageBroken && storage) {
        try { storage.setItem(key,JSON.stringify(memory)); }
        catch { storageBroken = true; }
      }
      if (storageBroken) history.message = "Omnic draft restored in memory; reopen and export it before leaving this page.";
    },
  });
  closed.set(owner,read);
  const cleanup = () => { stop(); if (closed.get(owner) === read) closed.delete(owner); if (cleanups.get(owner) === cleanup) cleanups.delete(owner); };
  cleanups.set(owner,cleanup);
  return cleanup;
}
