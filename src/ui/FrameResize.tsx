import { useConfigurationInteraction } from "./ConfigurationInteraction";
import { dragSurface } from "./liveDrag";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { activeFrame } from "./activeContextModel";
import { useUI, type UIContextValue } from "./context";
import { getContainer, residentPinned, updateContainer } from "./layout";
import { useFeatureActions } from "./useFeatureActions";
import { resizeLevels, type ResizeRect } from "./resizeGeometry";
import { PROPERTY_REGISTRY } from "../appearance/registry";
import { preparePropertyChanges } from "../properties/registry";
import type { PropertyBindings } from "../properties/CoupledProperties";
function snapshot(key: string) {
  const roots = [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root]")].filter(root => root.getClientRects().length);
  const root = roots.find(root => root.dataset.uiResidentRoot === key); if (!root) return [];
  const original = dragSurface(root).dataset.uiViewportOriginal;
  const current = original ? JSON.parse(original) as ResizeRect : root.getBoundingClientRect(), others = roots.filter(other => other !== root && !root.contains(other)).map(other => other.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0 && rect.right > 8 && rect.bottom > 8 && rect.left < innerWidth - 8 && rect.top < innerHeight - 8);
  return resizeLevels(current, others, { x: 8, y: 8, width: innerWidth - 16, height: innerHeight - 16 });
}
function applyResize(ui: UIContextValue, key: string, rect: ResizeRect) {
  const layout = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  if (!getContainer(layout, key) || residentPinned(layout, key)) return;
  ui.update(previous => updateContainer({ ...previous, windows: { ...Object.fromEntries(ui.defaults), ...previous.windows } }, key,
    { viewport: { ...rect, full: Math.abs(rect.width - (innerWidth - 16)) < 1 && Math.abs(rect.height - (innerHeight - 16)) < 1 }, collapsed: false }));
}
export function FrameResizeController({ bindings }: { bindings: PropertyBindings }) {
  const ui = useUI(), stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot), frame = activeFrame(stack);
  const latest = useRef({ ui, bindings }); latest.current = { ui, bindings };
  const run = () => {
    const { ui, bindings } = latest.current, target = activeFrame(ui.activeContext.getSnapshot()); if (!target) return;
    const layout = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
    const state = getContainer(layout, target.key); if (!state || residentPinned(layout, target.key)) return;
    const levels = snapshot(target.key), level = Number(bindings.values["ui.frame.resize"]?.["operation.level"] ?? 1);
    const rect = levels[Math.min(level, levels.length) - 1]; if (!rect && !state.viewport) return;
    ui.update(previous => updateContainer({ ...previous, windows: { ...Object.fromEntries(ui.defaults), ...previous.windows } }, target.key,
      { viewport: state.viewport ? undefined : { ...rect, full: Math.abs(rect.width - (innerWidth - 16)) < 1 && Math.abs(rect.height - (innerHeight - 16)) < 1 }, collapsed: false }));
  };
  const actions = useFeatureActions("frameResize", { "context.resize": {
    enabled: !!frame && !residentPinned({ ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } }, frame.key), run,
    configuration: <ResizeConfiguration bindings={bindings} />,
  } });
  const latestActions = useRef(actions); latestActions.current = actions;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (latestActions.current.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }, []);
  return null;
}
function ResizeConfiguration({ bindings }: { bindings: PropertyBindings }) {
  const ui = useUI(), stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot), key = activeFrame(stack)?.key;
  const levels = useMemo(() => key ? snapshot(key) : [], [key]);
  const [preview, setPreview] = useState<ResizeRect | null>(null);
  const [choice, setChoice] = useState(() => Math.max(0, Math.min(Number(bindings.values["ui.frame.resize"]?.["operation.level"] ?? 1), levels.length) - 1));
  const choiceRef = useRef(choice);
  const select = (index: number) => { choiceRef.current = Math.max(0, Math.min(levels.length - 1, index)); setChoice(choiceRef.current); setPreview(levels[choiceRef.current] ?? null); };
  const save = (level: number) => bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, "operation.level", level, ["ui.frame.resize"]));
  useConfigurationInteraction({
    cycle: () => select((choiceRef.current + 1) % Math.max(1, levels.length)), select,
    apply: () => { const rect = levels[choiceRef.current]; if (key && rect) applyResize(ui, key, rect); },
    lock: () => save(choiceRef.current + 1), reset: () => { select(0); save(1); },
  });
  return <div className="resize-levels" data-scroll-configuration onWheel={event => {
    if (!levels.length) return; event.preventDefault(); event.stopPropagation();
    select((choiceRef.current + (event.deltaY > 0 ? 1 : levels.length - 1)) % levels.length);
  }} onPointerLeave={() => setPreview(null)}>
    {levels.length ? levels.map((rect, index) => <button key={index} data-configuration-option={index} aria-pressed={choice === index}
      title={`${Math.round(rect.width)} × ${Math.round(rect.height)} · hover selects; release Shift applies · right-click to apply and lock; left-click resets to 1`} onPointerEnter={() => setPreview(rect)} onFocus={() => setPreview(rect)} onBlur={() => setPreview(null)}
>
      {index + 1} · {index === levels.length - 1 ? "Full viewport" : index === 0 ? "Nearest edges" : "Wider edges"}
    </button>) : <p>Activate a frame to see resize levels.</p>}
    {preview && <ResizePreview rect={preview} />}
  </div>;
}

function ResizePreview({ rect }: { rect: ResizeRect }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current!; node.setAttribute("popover", "manual"); node.showPopover();
    return () => { node.hidePopover(); node.removeAttribute("popover"); };
  }, []);
  return createPortal(<div ref={ref} className="frame-resize-preview" style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height }} aria-hidden />, document.body);
}
