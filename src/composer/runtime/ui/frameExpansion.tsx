import { useContext, useLayoutEffect, useRef } from "react";
import { useUI, UIContainerContext, UIHomeContext, type UIContextValue } from "./context";
import { getContainer, residentBranch } from "./layout";

type ExpansionAdapter = { owner: string; expanded: () => boolean; set: (expanded: boolean) => void };
// Adapters supply local view state only; ownership still comes from the shared layout.
const adapters = new WeakMap<UIContextValue["defaults"], Map<symbol, ExpansionAdapter>>();
export function useFrameExpansion(enabled: boolean, expanded: boolean, set: (expanded: boolean) => void, ownerOverride?: string) {
  const ui = useUI(), parent = useContext(UIContainerContext), home = useContext(UIHomeContext);
  const current = useRef({ expanded, set }); current.current = { expanded, set };
  const owner = ownerOverride ?? parent ?? home;
  useLayoutEffect(() => {
    if (!enabled) return;
    let entries = adapters.get(ui.defaults);
    if (!entries) { entries = new Map(); adapters.set(ui.defaults, entries); }
    const key = Symbol();
    entries.set(key, { owner, expanded: () => current.current.expanded, set: value => current.current.set(value) });
    return () => { entries.delete(key); };
  }, [enabled, owner, ui.defaults]);
}

export function toggleFrameDescendants(ui: UIContextValue, root: string) {
  const effective = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  const branch = new Set(residentBranch(effective, root)); branch.add(root);
  const children = [...branch].filter(key => key !== root);
  const local = [...(adapters.get(ui.defaults)?.values() ?? [])].filter(adapter => branch.has(adapter.owner));
  const expanded = !(children.some(key => !(ui.frameActions.get(key)?.state.collapsed ?? getContainer(effective, key)?.collapsed ?? true)) || local.some(adapter => adapter.expanded()));
  // One persistent transaction/undo entry; transient editors keep local view state.
  if (children.length || getContainer(effective, root)?.collapsed) ui.update(layout => {
    const windows = { ...Object.fromEntries(ui.defaults), ...layout.windows };
    for (const child of children) if (child.startsWith("window:") && windows[child.slice(7)])
      windows[child.slice(7)] = { ...windows[child.slice(7)], collapsed: !expanded };
    if (root.startsWith("window:") && windows[root.slice(7)]) windows[root.slice(7)] = { ...windows[root.slice(7)], collapsed: false };
    return { ...layout, windows, frames: layout.frames.map(frame => {
      const key = `frame:${frame.id}`;
      return key === root ? { ...frame, collapsed: false } : branch.has(key) ? { ...frame, collapsed: !expanded } : frame;
    }) };
  });
  for (const adapter of local) adapter.set(expanded);
  return expanded;
}
