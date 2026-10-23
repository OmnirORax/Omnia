import { useContext, useLayoutEffect, useRef, useState } from "react";
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

export function FrameBranchButton({ container, title }: { container: string; title: string }) {
  const ui = useUI();
  const [collapseNext, setCollapseNext] = useState(true);
  const saved = getContainer(ui.layout, container)?.chrome;
  const style = saved?.controlStyles?.branch, position = saved?.controls?.branch;
  const asset = ui.layout.assets.find(asset => asset.id === style?.assetId);
  return <button type="button" className="ui-frame-branch-toggle" data-ui-id="expand-descendants" data-ui-control="branch" data-ui-control-owner={container}
    style={position ? { position: "absolute", left: position.x, top: position.y, right: "auto" } : undefined}
    onContextMenu={event => { event.preventDefault(); event.stopPropagation(); ui.configureControl(container, "branch"); }}
    aria-label={`Collapse / expand all descendants of ${title}`}
    title="Collapse all descendants if any are open; otherwise expand all"
    onPointerDown={event => event.stopPropagation()} onClick={event => {
      event.stopPropagation(); setCollapseNext(ui.frameActions.get(container)?.onBranchToggle?.() ?? toggleFrameDescendants(ui, container));
    }}>{style?.mode === "icon" ? asset ? <img src={asset.dataUrl} alt="" /> : style.character || (collapseNext ? "→←" : "←→") : collapseNext ? "→←" : "←→"}</button>;
}
