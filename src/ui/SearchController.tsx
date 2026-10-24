import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useUI, type UIContextValue } from "./context";
import { useFeatureActions } from "./useFeatureActions";
import { useConfigurationInteraction } from "./ConfigurationInteraction";
import { searchScopes, searchScope } from "./searchScopes";
import { searchFrame } from "./frameSearchActions";
import type { PropertyBindings } from "../properties/CoupledProperties";
import { preparePropertyChanges } from "../properties/registry";
import { PROPERTY_REGISTRY } from "../appearance/registry";
const framePath = (ui: UIContextValue) => ui.activeContext.getSnapshot().flatMap(entry => entry.kind === "frame" ? [entry.key] : []);
function openSearch(key: string) {
  if (key === "workspace" || !searchFrame(key)) window.dispatchEvent(new CustomEvent("omnium:invoke-button", { detail: "button:searchUI" }));
}
export function SearchController({ bindings }: { bindings: PropertyBindings }) {
  const ui = useUI();
  const shortcuts = useFeatureActions("searchController", { "context.search": {
    enabled: true, configuration: <SearchConfiguration bindings={bindings} />,
    run: () => openSearch(searchScope(framePath(ui), Number(bindings.values["ui.search"]?.["operation.level"] ?? 1)).key),
  } });
  const latest = useRef(shortcuts); latest.current = shortcuts;
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (latest.current.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); } };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }, []);
  return null;
}
function SearchConfiguration({ bindings }: { bindings: PropertyBindings }) {
  const ui = useUI();
  const stack = useSyncExternalStore(ui.activeContext.subscribe, ui.activeContext.getSnapshot);
  const scopes = searchScopes(stack.flatMap(entry => entry.kind === "frame" ? [entry.key] : []));
  const saved = Number(bindings.values["ui.search"]?.["operation.level"] ?? 1);
  const [choice, setChoice] = useState(() => scopes.findIndex(scope => scope.level >= saved));
  const selected = useRef(choice);
  const select = (index: number) => { selected.current = Math.max(0, Math.min(scopes.length - 1, index)); setChoice(selected.current); };
  const save = (level: number) => bindings.commit(preparePropertyChanges(PROPERTY_REGISTRY, "operation.level", level, ["ui.search"]));
  useConfigurationInteraction({ cycle: () => select((selected.current + 1) % scopes.length), select,
    apply: () => { const key = scopes[selected.current]?.key ?? "workspace"; requestAnimationFrame(() => openSearch(key)); },
    lock: () => save(scopes[selected.current]?.level ?? 1), reset: () => { select(0); save(1); },
  });
  return <div className="configuration-options search-scopes" data-scroll-configuration role="group" aria-label="Search scope" onWheel={event => {
    event.preventDefault(); event.stopPropagation(); select((selected.current + (event.deltaY > 0 ? 1 : scopes.length - 1)) % scopes.length);
  }}>{scopes.map((scope, index) => <button key={scope.key} data-configuration-option={index} aria-pressed={choice === index}
    title="Repeat shortcut or scroll to choose; release Shift to search. Right-click locks; left-click resets to nearest scope.">
    {index + 1} · {scope.key === "workspace" ? "All UI" : ui.frameActions.get(scope.key)?.title ?? "Active frame"}
  </button>)}</div>;
}
