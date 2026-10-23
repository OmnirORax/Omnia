import { useLayoutEffect, useSyncExternalStore } from "react";
import { openActionConfiguration } from "./shortcutConfiguration";
import { activeFrame } from "./activeContextModel";
import type { ActionHistory, HistoryCategory, HistoryMode } from "./actionHistory";
import { useUI } from "./context";
import { useFeatureActions } from "./useFeatureActions";

const modes: { id: HistoryMode; label: string }[] = [
  { id: "recent", label: "1 · Most recent action" },
  { id: "context", label: "2 · Active context" },
  { id: "selective", label: "3 · Categories" },
];
const categories: { id: HistoryCategory; label: string }[] = [
  { id: "omnium", label: "Omnium" }, { id: "ui", label: "UI arrangement" },
  { id: "appearance", label: "Appearance" }, { id: "settings", label: "Settings" },
];
/** A contextual projection of Master Controller, not a second settings inventory. */
export function HistoryActionBridge({ history }: { history: ActionHistory }) {
  const ui = useUI(), stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot);
  useLayoutEffect(() => {
    history.activeContext = activeFrame(stack)?.key ?? "omnium";
    history.contextPath = stack.flatMap(entry => entry.kind === "frame" ? [entry.key] : []);
  }, [stack, history]);
  useFeatureActions("historyController", { "history.configure": { enabled: true,
    configuration: <HistoryControls history={history} />, run: () => openActionConfiguration("undo") } });
  return history.message ? <div className="operation-banner" role="alert">{history.message}</div> : null;
}

export function HistoryControls({ history }: { history: ActionHistory }) {
  const ui = useUI();
  useSyncExternalStore(history.subscribe, history.getSnapshot);
  const undo = history.candidates("undo"), redo = history.candidates("redo");
  return <div data-context-controller data-scroll-configuration className="history-controls" onWheel={event => {
    if ((event.target as Element).closest("input,select,[data-history-value]")) return;
    event.preventDefault(); event.stopPropagation(); const index = modes.findIndex(mode => mode.id === history.options.mode);
    history.configure({ mode: modes[(index + (event.deltaY > 0 ? 1 : 2)) % modes.length].id });
  }} title="Scroll scope; hover a category or number to scroll that value. Release Shift to finish.">
    <label className="history-scope"><select onWheel={event => {
      event.preventDefault(); event.stopPropagation(); const index = modes.findIndex(mode => mode.id === history.options.mode);
      history.configure({ mode: modes[(index + (event.deltaY > 0 ? 1 : 2)) % modes.length].id });
    }} aria-label="History scope" value={history.options.mode} onChange={event => history.configure({ mode: event.target.value as HistoryMode })}>
      {modes.map(mode => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
    </select></label>
    {history.options.mode === "context" && <p>Target: {ui.frameActions.get(history.activeContext)?.title ?? (history.activeContext === "omnium" ? "Omnium" : history.activeContext)}</p>}
    {history.options.mode === "selective" && <fieldset data-history-value onWheel={event => {
      event.preventDefault(); event.stopPropagation(); const index = categories.findIndex(category => history.options.categories.includes(category.id));
      history.configure({ categories: [categories[(index + (event.deltaY > 0 ? 1 : categories.length - 1) + categories.length) % categories.length].id] });
    }}><legend>Categories</legend>{categories.map(category => <label key={category.id}>
      <input type="checkbox" checked={history.options.categories.includes(category.id)} onChange={event => history.configure({ categories: event.target.checked ? [...history.options.categories, category.id] : history.options.categories.filter(id => id !== category.id) })} />{category.label}
    </label>)}</fieldset>}
    <div className="history-step-row"><label data-history-value>Steps<input aria-label="History steps" type="number" min="1" max={history.options.limit} value={history.options.steps}
      onFocus={event => event.currentTarget.select()} onChange={event => history.configure({ steps: Number(event.target.value) })}
      onWheel={event => { event.preventDefault(); event.stopPropagation(); history.configure({ steps: history.options.steps + (event.deltaY > 0 ? -1 : 1) }); }} /></label>
    <label data-history-value title="Locked maximum · edit to change, up to 10">Max<input aria-label="History step maximum" type="number" min="1" max="10" value={history.options.limit}
      onFocus={event => event.currentTarget.select()} onChange={event => history.configure({ limit: Number(event.target.value) })}
      onWheel={event => { event.preventDefault(); event.stopPropagation(); history.configure({ limit: history.options.limit + (event.deltaY > 0 ? -1 : 1) }); }} /></label>
    </div>
    <div className="history-action-row">
      <button disabled={!undo.length} onClick={() => history.travel("undo")}>Undo <small>{undo.length}</small></button>
      <button disabled={!redo.length} onClick={() => history.travel("redo")}>Redo <small>{redo.length}</small></button>
    </div>
    <p className="history-next" title="Next action to undo">Next: {undo[0]?.categories.map(id => categories.find(category => category.id === id)?.label).join(" / ") || "None"}</p>
    {history.message && <p role="alert">{history.message}</p>}
  </div>;
}
