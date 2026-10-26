import { removedTargets, restoreTargetDraft } from "./draftTargets";
import { boundedNumber } from "../properties/numericRange";
import type { PropertySnapshot } from "../properties/clipboard";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUI } from "../ui/context";
import { ownerOf } from "../ui/layout";
import {
  createHierarchyIndex,
  ruleHas,
  toggleRule,
  propertyChannels,
  type Controller,
  type Value,
} from "./model";
import {
  controllerTargets,
  instanceId,
  TARGETS,
  loadController,
  validateProperty,
  type RegisteredTarget,
} from "./registry";
import { type Appearance, createValueResolver } from "./resolve";
import { activityPreview, type ActivityPreview } from "./activityPreview";
import { MouseTrail } from "./MouseTrail";
import { VisualSelectionProvider } from "./VisualSelector";
export type AppearanceLocation = { target: string; property?: string };
export type AppearanceBridge = {
  safe?: boolean;
  masterOpen?: boolean;
  activityPreview?: (requests: ActivityPreview[]) => void;
  subtreeModifier?: "shift" | "alt" | "ctrl" | "none";
  base: Appearance;
  applied?: Appearance;
  commit: (state: Controller) => void;
  preview: (state: Controller | null) => void;
  inspect?: (key: string) => void;
  reveal?: (path: string[] | null) => void;
  fonts?: { id: string; name: string }[];
};
type ContextValue = AppearanceBridge & {
  propertyClipboard: PropertySnapshot | null;
  copyProperties: (snapshot: PropertySnapshot) => void;
  state: Controller;
  retarget: (next: Controller) => void;
  restoreTargets: (ids: readonly string[]) => void;
  renderBase: Appearance;
  legacyBase: Appearance;
  activatePreview: (request: ActivityPreview) => () => void;
  targets: RegisteredTarget[];
  hierarchy: ReturnType<typeof createHierarchyIndex<RegisteredTarget>>;
  /** One indexed reader per appearance snapshot, shared by every editor/icon. */
  read: ReturnType<typeof createValueResolver>;
  renderRead: ReturnType<typeof createValueResolver>;
  location: AppearanceLocation | null;
  locate: (location: AppearanceLocation | null, keep?: boolean) => void;
  customize: (
    baseId: string,
    owner: string,
    label: string,
    property: string,
    value: Value,
    preview?: boolean,
  ) => void;
  lock: (id: string, property?: string) => void;
  plug: (id: string, property?: string) => void;
};
const Context = createContext<ContextValue | null>(null);
export const useAppearance = () => useContext(Context);
export function AppearanceProvider({
  bridge,
  children,
}: {
  bridge?: AppearanceBridge;
  children: ReactNode;
}) {
  const ui = useUI();
  const [propertyClipboard, copyProperties] = useState<PropertySnapshot | null>(null);
  const [location, setLocation] = useState<AppearanceLocation | null>(null),
    [hoverLocation, setHoverLocation] = useState<AppearanceLocation | null>(null);
  const bridgeFallback: AppearanceBridge = {
    base: {} as Appearance,
    commit: () => {},
    preview: () => {},
  };
  const activeBridge = bridge ?? bridgeFallback;
  const [activities, setActivities] = useState<Map<symbol, ActivityPreview>>(() => new Map());
  const activityCallback = useRef(activeBridge.activityPreview); activityCallback.current = activeBridge.activityPreview;
  const activatePreview = useCallback((request: ActivityPreview) => {
    const token = Symbol();
    setActivities(old => new Map(old).set(token, request));
    return () => setActivities(old => { const next = new Map(old); next.delete(token); return next; });
  }, []);
  useEffect(() => {
    activityCallback.current?.(activeBridge.safe ? [] : [...activities.values()]);
  }, [activities, activeBridge.safe]);
  useEffect(() => () => activityCallback.current?.([]), []);
  const renderBase = useMemo(() => activeBridge.safe ? activeBridge.base : activityPreview(activeBridge.base, [...activities.values()]), [activeBridge.base, activeBridge.safe, activities]);
  const [visualInspection, setVisualInspection] = useState("");
  const inspect = useRef(activeBridge.inspect); inspect.current = activeBridge.inspect;
  const inspectedFunctions = [...ui.selectedFunctions].sort().join("|");
  const inspectionKey = visualInspection || inspectedFunctions ? `${visualInspection}::${inspectedFunctions}` : "";
  useEffect(() => { inspect.current?.(inspectionKey); }, [inspectionKey]);
  const state = activeBridge.base.controller ?? loadController(undefined);
  // Function React elements change on every preview. Only identities/captions
  // affect target metadata; using the elements here rebuilds every local binding.
  const functionLabels = ui.functions.map(fn => `${fn.id}\0${fn.label}`).join("\n");
  const frameLabels = [...ui.frameActions].map(([id, frame]) => `${id}\0${frame.title}`).join("\n");
  const targets = useMemo(
    () =>
      controllerTargets(state).map((target) => {
        const customLabel = ui.layout.labels?.[`appearance:target:${target.id}`];
        if (!target.instance) return customLabel ? { ...target, label: customLabel } : target;
        const owner = target.instance.owner,
          path: string[] = [],
          seen = new Set<string>();
        let key: string | undefined = owner;
        while (key && !seen.has(key)) {
          seen.add(key);
          if (!key.startsWith("function:")) path.unshift(key);
          key = ownerOf(ui.layout, key);
        }
        // Native controls need the DOM home; moved residents use the saved ownership tree.
        if (owner.startsWith("function:") && !path.length)
          path.push(...(target.instance.path ?? []));
        const label = owner.startsWith("function:")
          ? ui.functions.find((f) => f.id === owner.slice(9))?.label
          : (ui.frameActions.get(owner)?.title ??
            ui.layout.frames.find((f) => `frame:${f.id}` === owner)?.name);
        return { ...target, label: customLabel ?? (target.instance.part ? target.label : label) ?? target.label, instance: { ...target.instance, path } };
      }),
    [state.instances, ui.layout, functionLabels, frameLabels],
  );
  const hierarchy = useMemo(() => createHierarchyIndex(targets), [targets]);
  // Target membership/locks are not paint inputs. Keep the legacy defaults and
  // resolved-value reader stable when only those UI policies change.
  const priorBase = useRef<Appearance | null>(null);
  const candidateBase = { ...activeBridge.base }; delete candidateBase.controller;
  if (!priorBase.current || Object.keys(candidateBase).length !== Object.keys(priorBase.current).length ||
      (Object.keys(candidateBase) as (keyof Appearance)[]).some(key => candidateBase[key] !== priorBase.current![key])) priorBase.current = candidateBase;
  const legacyBase = priorBase.current;
  const read = useMemo(() => createValueResolver(legacyBase, state, targets), [legacyBase, state.values, state.disconnected, targets]);
  const renderRead = useMemo(() => renderBase === activeBridge.base ? read
    : createValueResolver(renderBase, renderBase.controller ?? state), [renderBase, activeBridge.base, read, state]);
  const freeze = (input: Controller, id: string, property?: string) => {
    const next = { ...input, values: { ...input.values } };
    for (const target of targets) {
      if (!hierarchy.index.path(target.id).includes(id)) continue;
      for (const p of new Set((target.properties ?? []).map(property => target.couplings?.[property] ?? property))) {
        if (property && !propertyChannels(property).map(channel => target.couplings?.[channel] ?? channel).includes(p)) continue;
        next.values[target.id] = {
          ...next.values[target.id],
          [p]: read(target, p),
        };
      }
    }
    return next;
  };
  const lock = (id: string, property?: string) => {
    let next = toggleRule(state, "locks", id, property);
    if (property && state.locks[id]?.all) {
      const available = [
        ...new Set(
          targets
            .filter((t) => hierarchy.index.path(t.id).includes(id))
            .flatMap((t) => t.properties ?? []),
        ),
      ];
      next.locks[id] = { properties: available.filter((p) => p !== property) };
    }
    if (ruleHas(next.locks[id], property ?? "color")) next = freeze(next, id, property);
    activeBridge.commit(next);
  };
  const customize = (
    baseId: string,
    owner: string,
    label: string,
    property: string,
    input: Value,
    preview = false,
  ) => {
    const value = validateProperty(property, input);
    if (value === undefined) return;
    const id = instanceId(baseId, owner),
      next = { ...state, values: { ...state.values }, refined: { ...state.refined } },
      path: string[] = [];
    let element = document.querySelector<HTMLElement>(`[data-ui-resident-root="${CSS.escape(owner)}"]`) ?? undefined;
    if (owner.startsWith("function:"))
      element = document.querySelector<HTMLElement>(`[data-ui-function="${CSS.escape(owner.slice(9))}"]:not([data-ui-native-hidden])`) ?? undefined;
    let root = element?.closest<HTMLElement>("[data-ui-resident-root]");
    while (root) {
      path.unshift(root.dataset.uiResidentRoot!);
      root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
    }
    const names = path.map(
      (key) =>
        ui.frameActions.get(key)?.title ?? key.replace(/^(window:panel:|window:|frame:)/, ""),
    );
    const previous = state.instances[id], caption = label || names.at(-1) || owner;
    if (!previous || previous.label !== caption || previous.base !== baseId || previous.owner !== owner || (previous.path ?? []).join("\0") !== path.join("\0"))
      next.instances = { ...state.instances, [id]: { base: baseId, owner, label: caption, path } };
    const base = TARGETS.find(t => t.id === baseId);
    const target = targets.find(t => t.id === id) ?? (base ? { ...base, id, instance: next.instances[id] } : undefined);
    for (const channel of propertyChannels(property))
      if (target?.properties?.includes(channel)) {
        const spec = target.numberRanges?.[channel];
        const nextValue = typeof value === "number" && spec ? boundedNumber(spec, value, key => read(target, key)) : value;
        next.values[id] = { ...next.values[id], [channel]: nextValue };
        next.refined[id] = [...new Set([...(next.refined[id] ?? []), channel])];
      }
    if (preview) activeBridge.preview(next);
    else activeBridge.commit(next);
  };
  const value: ContextValue = {
    propertyClipboard, copyProperties,
    ...activeBridge,
    state,
    renderBase,
    legacyBase,
    activatePreview,
    targets,
    hierarchy,
    read,
    renderRead,
    retarget: next => { activeBridge.preview(null); activeBridge.commit(activeBridge.applied ? restoreTargetDraft(activeBridge.base, activeBridge.applied, targets, removedTargets(state, next, targets), next) : next); },
    restoreTargets: ids => { activeBridge.preview(null); if (activeBridge.applied) { const next = restoreTargetDraft(activeBridge.base, activeBridge.applied, targets, ids, state); if (next !== state) activeBridge.commit(next); } },
    location: hoverLocation ?? location,
    locate: (next, keep = false) => {
      if (keep) {
        setLocation(next);
        setHoverLocation(null);
      } else setHoverLocation(next);
    },
    customize,
    lock,
    plug: (id, property) => activeBridge.commit(toggleRule(state, "disconnected", id, property)),
  };
  return <Context.Provider value={bridge ? value : null}>{bridge
    ? <VisualSelectionProvider masterOpen={bridge.masterOpen} onInspect={setVisualInspection}>{children}<MouseTrail /></VisualSelectionProvider> : children}</Context.Provider>;
}
export function basesForOwner(owner: string, control = false): RegisteredTarget[] {
  const prefix = owner.startsWith("function:") ? (control ? "ui.fields." : "ui.buttons.") : "ui.";
  return TARGETS.filter((t) => !t.hidden && t.properties && t.id.startsWith(prefix));
}
