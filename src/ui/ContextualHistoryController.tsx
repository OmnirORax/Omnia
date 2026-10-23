import { ConfigurationInteractionContext, useConfigurationInteraction } from "./ConfigurationInteraction";
import { useContext, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const session = useContext(ConfigurationInteractionContext);
  const [draftMode, setDraftMode] = useState(history.options.mode), modeRef = useRef(draftMode);
  const selectMode = (index: number) => {
    const mode = modes[(index + modes.length) % modes.length].id;
    modeRef.current = mode; setDraftMode(mode);
    if (!session) history.configure({ mode });
  };
  const choice = session ? draftMode : history.options.mode;
  const execute = () => history.travel(session?.id.replace(/^button:/, "").endsWith("redo") ? "redo" : "undo", { ...history.options, mode: modeRef.current });
  useConfigurationInteraction({
    cycle: () => selectMode(modes.findIndex(mode => mode.id === modeRef.current) + 1), select: selectMode,
    apply: execute, lock: () => history.configure({ mode: modeRef.current }),
    reset: () => { selectMode(0); history.configure({ mode: "recent" }); },
  });
  const options = { ...history.options, mode: choice };
  const undo = history.candidates("undo", options), redo = history.candidates("redo", options);
  return <div data-context-controller data-scroll-configuration className="history-controls" onWheel={event => {
    if ((event.target as Element).closest("input,select,[data-history-value]")) return;
    event.preventDefault(); event.stopPropagation(); const index = modes.findIndex(mode => mode.id === choice);
    selectMode(index + (event.deltaY > 0 ? 1 : 2));
  }} title="Scroll scope; hover a category or number to scroll that value. Release Shift to apply; right-click locks, left-click resets to 1.">
    <div className="history-step-row"><label data-history-value>Steps<input aria-label="History steps" type="number" min="1" max={history.options.limit} value={history.options.steps}
      onFocus={event => event.currentTarget.select()} onChange={event => history.configure({ steps: Number(event.target.value) })}
      onWheel={event => { event.preventDefault(); event.stopPropagation(); history.configure({ steps: history.options.steps + (event.deltaY > 0 ? -1 : 1) }); }} /></label>
    <label data-history-value title="Locked maximum · edit to change, up to 10">Max<input aria-label="History step maximum" type="number" min="1" max="10" value={history.options.limit}
      onFocus={event => event.currentTarget.select()} onChange={event => history.configure({ limit: Number(event.target.value) })}
      onWheel={event => { event.preventDefault(); event.stopPropagation(); history.configure({ limit: history.options.limit + (event.deltaY > 0 ? -1 : 1) }); }} /></label>
    </div>
    <div className="configuration-options history-scope" role="group" aria-label="History scope">
      {modes.map((mode, index) => <button key={mode.id} data-configuration-option={index} aria-pressed={choice === mode.id}
        title={`${mode.label} · right-click to apply and lock; left-click resets to 1`}
        onClick={() => { if (!session) { selectMode(0); history.configure({ mode: "recent" }); } }}
        onContextMenu={event => { if (session) return; event.preventDefault(); modeRef.current = mode.id; history.configure({ mode: mode.id }); execute(); }}>
        {mode.label}
      </button>)}
    </div>
    {choice === "context" && <p>Target: {ui.frameActions.get(history.activeContext)?.title ?? (history.activeContext === "omnium" ? "Omnium" : history.activeContext)}</p>}
    {choice === "selective" && <fieldset data-history-value onWheel={event => {
      event.preventDefault(); event.stopPropagation(); const index = categories.findIndex(category => history.options.categories.includes(category.id));
      history.configure({ categories: [categories[(index + (event.deltaY > 0 ? 1 : categories.length - 1) + categories.length) % categories.length].id] });
    }}><legend>Categories</legend>{categories.map(category => <label key={category.id}>
      <input type="checkbox" checked={history.options.categories.includes(category.id)} onChange={event => history.configure({ categories: event.target.checked ? [...history.options.categories, category.id] : history.options.categories.filter(id => id !== category.id) })} />{category.label}
    </label>)}</fieldset>}
    {!session && <><div className="history-action-row">
      <button disabled={!undo.length} onClick={() => { history.travel("undo", options); }}>Undo <small>{undo.length}</small></button>
      <button disabled={!redo.length} onClick={() => { history.travel("redo", options); }}>Redo <small>{redo.length}</small></button>
    </div>
    <p className="history-next" title="Next action to undo">Next: {undo[0]?.categories.map(id => categories.find(category => category.id === id)?.label).join(" / ") || "None"}</p></>}
    {history.message && <p role="alert">{history.message}</p>}
  </div>;
}
