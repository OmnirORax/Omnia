import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type RefObject } from "react";
import { useUI, useOptionalUITracked, type UIContextValue } from "./context";
import { activeFrame, parentContext, contextStackFromScopes, dismissContextDials, UI_CANCEL_EDIT, type ActiveContextEntry, type ActiveContextStack } from "./activeContextModel";
import { getContainer, ownerOf, floatResident } from "./layout";
import { useFeatureActions } from "./useFeatureActions";
import { UISection } from "./UISection";
import { FunctionControl } from "./UIWorkspace";
import { ACTIONS } from '../workspaceActions';
import { contextTargets } from './contextTargets';
import { claimUIPress, uiPointerHeld } from "./pointerOwnership";

const fieldSelector = 'input:not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]';
const controllerSelector = '[data-context-controller],[data-ui-function^="context."],[data-shortcut-runner],omnium-appearance-recovery';
const frameElement = (key: string) => document.querySelector<HTMLElement>(`[data-ui-resident-root="${CSS.escape(key)}"]`);
function frameChain(ui: UIContextValue, key: string): ActiveContextEntry[] {
  const layout = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  const chain: ActiveContextEntry[] = [], seen = new Set<string>();
  let current: string | undefined = key;
  while (current && !seen.has(current)) {
    seen.add(current); chain.unshift({ kind: "frame", key: current, element: frameElement(current) ?? undefined });
    current = ownerOf(layout, current);
  }
  return chain;
}
function stackAt(ui: UIContextValue, element: HTMLElement): ActiveContextStack {
  const scopes: HTMLElement[] = [];
  for (let node: HTMLElement | null = element; node; node = node.parentElement)
    if (node.hasAttribute("data-ui-resident-root") || ui.contextLayers.has(node)) scopes.unshift(node);
  return contextStackFromScopes(scopes.map(node => ({ element: node,
    frame: node.getAttribute("data-ui-resident-root") ?? undefined, layer: ui.contextLayers.get(node),
  })), key => frameChain(ui, key), element.closest<HTMLElement>(fieldSelector));
}
export function activateFrameContext(ui: UIContextValue, key: string) {
  publish(ui, frameChain(ui, key));
}
function sameStack(a: ActiveContextStack, b: ActiveContextStack) {
  return a.length === b.length && a.every((entry, i) => entry.kind === b[i].kind && (entry.kind === "frame" && b[i].kind === "frame" ? entry.key === b[i].key : entry.element === b[i].element));
}
function publish(ui: UIContextValue, stack: ActiveContextStack) {
  if (!sameStack(ui.activeContext.getSnapshot(), stack)) ui.activeContext.set(stack);
}
function focusParent(ui: UIContextValue, stack: ActiveContextStack) {
  publish(ui, stack);
  const top = stack.at(-1), element = top?.element;
  if (!element?.isConnected) return;
  if (!element.hasAttribute("tabindex") && !element.matches(fieldSelector)) element.tabIndex = -1;
  element.focus({ preventScroll: true });
  // Focusing an ancestor must not reactivate the child just exited.
  publish(ui, stack);
}
/** Draft-owning shared controls cancel through one event before focus leaves. */
export function useCancelValueEdit<T extends HTMLElement>(ref: RefObject<T | null>, cancel: () => void, identity?: unknown) {
  const current = useRef(cancel); current.current = cancel;
  useLayoutEffect(() => {
    const node = ref.current;
    const handler = (event: Event) => { event.preventDefault(); current.current(); };
    node?.addEventListener(UI_CANCEL_EDIT, handler);
    return () => node?.removeEventListener(UI_CANCEL_EDIT, handler);
  }, [ref, identity]);
}
/** Shared popup adapters add a real intermediate level, including portalled ones. */
export function useActiveLayer(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void, parent?: string, dismiss?:()=>void) {
  const ui = useOptionalUITracked(()=>[]), current = useRef(close), dismissal=useRef(dismiss); current.current = close;dismissal.current=dismiss;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!ui || !open || !node) return;
    const saved = ui.activeContext.getSnapshot(), owner = parent ?? activeFrame(saved)?.key;
    ui.contextLayers.set(node, { parent: owner, close: () => current.current(),dismiss:dismiss?()=>dismissal.current?.():undefined });
    const focused = document.activeElement;
    // Nested portalled controllers retain their existing context ancestors.
    // Rebuilding only the frame chain drops the parent popup from Esc/Back.
    const ancestors = parent === undefined && activeFrame(saved)?.key === owner
      ? saved.filter(entry => entry.kind !== "field" && (entry.kind === "frame" || entry.element.isConnected))
      : owner ? frameChain(ui, owner) : saved.filter(entry => entry.kind !== "field");
    publish(ui, focused instanceof HTMLElement && node.contains(focused) ? stackAt(ui, focused)
      : [...ancestors, { kind: "layer", element: node }]);
    return () => {
      ui.contextLayers.delete(node);
      const stack = ui.activeContext.getSnapshot(), index = stack.findIndex(entry => entry.kind === "layer" && entry.element === node);
      if (index >= 0) publish(ui, stack.slice(0, index));
    };
  }, [open, ui?.activeContext, parent, ref, !!dismiss]);
}

export function ActiveContextSystem() {
  const ui = useUI(), latest = useRef(ui); latest.current = ui;
  const stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot);
  useLayoutEffect(()=>{contextTargets.setIntermediate(stack.at(-1)?.kind==='layer'||stack.at(-1)?.kind==='field');},[stack]);
  const popField = () => {
    const current = latest.current, entries = current.activeContext.getSnapshot(), field = entries.at(-1);
    if (field?.kind !== "field") return false;
    field.element.dispatchEvent(new Event(UI_CANCEL_EDIT, { cancelable: true }));
    field.element.blur(); focusParent(current, parentContext(entries)); return true;
  };
  const back = () => {
    const current = latest.current, entries = current.activeContext.getSnapshot(), top = entries.at(-1);
    if (!top || popField()) return;
    if (top.kind === "layer") {
      current.contextLayers.get(top.element)?.close(); focusParent(current, parentContext(entries));
    } else if (top.kind === "frame") {
      const frame = current.frameActions.get(top.key);
      if (frame && frame.onChange({ collapsed: true }) !== false) focusParent(current, parentContext(entries));
    }
  };
  const close = () => {
    const current = latest.current, entries = current.activeContext.getSnapshot(), top = entries.at(-1);
    if (!top || popField()) return;
    if (top.kind === "layer") { current.contextLayers.get(top.element)?.close(); focusParent(current, parentContext(entries)); }
    else if (top.kind === "frame") {
      const action = current.frameActions.get(top.key)?.onClose;
      if (action && action() !== false) focusParent(current, parentContext(entries));
    }
  };
  const frame = activeFrame(stack), actions = frame && ui.frameActions.get(frame.key);
  const shortcuts = useFeatureActions("activeContext", {
    "context.back": { enabled: stack.length > 0, run: back },
    "context.close": { enabled: stack.length > 0, run: close },
    "context.float": { enabled: !!frame && ui.canMove(frame.key), run: () => {
      const current = latest.current, target = activeFrame(current.activeContext.getSnapshot());
      if (!target || !current.canMove(target.key)) return;
      const rect = frameElement(target.key)?.getBoundingClientRect();
      current.update(layout => floatResident({ ...layout, windows: { ...Object.fromEntries(current.defaults), ...layout.windows } }, target.key, rect?.x ?? 320, rect?.y ?? 160));
    } },
    "context.minimize": { enabled: !!frame, run: () => {
      const current = latest.current, entries = current.activeContext.getSnapshot(), active = activeFrame(entries);
      if (!active) return;
      const frame = current.frameActions.get(active.key);
      frame?.onChange({ collapsed: !frame.state.collapsed });
    } },
    "context.descendants": { enabled: !!actions?.onBranchToggle, run: () => { const key = activeFrame(latest.current.activeContext.getSnapshot())?.key; if (key) latest.current.frameActions.get(key)?.onBranchToggle?.(); } },
  });
  const api = useRef(shortcuts); api.current = shortcuts;
  useEffect(() => {
    const activate = (event: Event) => {
      let element = event.target instanceof Element ? event.target : null;
      if(event instanceof PointerEvent&&event.button===0&&latest.current.contextLayers.size>0&&element&&!element.closest('button,a,input,textarea,select,label,summary,[role="button"],[role="textbox"],[contenteditable="true"],[data-ui-function],[data-range-control],[data-omnic-role]')&&dismissContextDials(latest.current.contextLayers.values())) {
        claimUIPress(event.pointerId,event.pointerType,event.buttons);
        event.preventDefault();event.stopImmediatePropagation();return;
      }
      while (element && !(element instanceof HTMLElement)) element = element.parentElement;
      if (!(element instanceof HTMLElement) || element.closest(controllerSelector)) return;
      const next=stackAt(latest.current,element);
      contextTargets.context(activeFrame(next)?.key,element,next.at(-1)?.kind==='layer'||next.at(-1)?.kind==='field');
      publish(latest.current,next);
    };
    const key = (event: KeyboardEvent) => {
      // The held UI gesture gets first refusal (notably Esc cancellation).
      // Minimizing here can rerender the source before its drag is restored.
      if (uiPointerHeld()) return;
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
      if (api.current.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener("pointerdown", activate, true);
    window.addEventListener("focusin", activate, true);
    window.addEventListener("keydown", key, true);
    return () => { window.removeEventListener("pointerdown", activate, true); window.removeEventListener("focusin", activate, true); window.removeEventListener("keydown", key, true); };
  }, []);
  useEffect(() => {
    const current = ui.activeContext.getSnapshot();
    const invalid = current.findIndex(entry => entry.kind === "frame"
      ? getContainer(ui.layout, entry.key)?.closed || entry.element && !entry.element.isConnected
      : !entry.element.isConnected);
    if (invalid >= 0) publish(ui, current.slice(0, invalid));
  }, [ui.layout]);
  return null;
}

/** Remote actions preserve the target while the user interacts with the controller. */
export function ActiveContextControls() {
  const ui = useUI(), stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot), top = stack.at(-1);
  useSyncExternalStore(contextTargets.subscribe,contextTargets.getSnapshot);
  const target=contextTargets.targets()[0];
  const label = target?.label ?? (top?.kind === "frame" ? ui.frameActions.get(top.key)?.title ?? top.key : top?.element.getAttribute("aria-label") ?? (top?.kind === "field" ? "Value field" : "Popup"));
  return <div data-context-controller onPointerDown={event => {
    if ((event.target as Element).closest("button")) event.preventDefault();
  }}><UISection id="active-context-actions" title="Active context">
    <p role="status">{top ? label : "Click a frame to activate it"}</p>
    {ACTIONS.filter(action=>action.category==='Active context'||'contextControl' in action&&(action.contextControl===true||contextTargets.active())).filter(action=>!('contextual' in action)||!contextTargets.override(action.id)||contextTargets.available(action.id)).map(action=><FunctionControl key={action.id} id={action.id} mirror/>)}
  </UISection></div>;
}
