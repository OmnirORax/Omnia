import type { PropertySnapshot } from "../properties/clipboard";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUI } from "../ui/context";
import { ownerOf } from "../ui/layout";
import {
  ancestry,
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
  renderBase: Appearance;
  activatePreview: (request: ActivityPreview) => () => void;
  targets: RegisteredTarget[];
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
  const read = useMemo(() => createValueResolver(activeBridge.base, state, targets), [activeBridge.base, state, targets]);
  const renderRead = useMemo(() => renderBase === activeBridge.base ? read
    : createValueResolver(renderBase, renderBase.controller ?? state), [renderBase, activeBridge.base, read, state]);
  const freeze = (next: Controller, id: string, property?: string) => {
    for (const target of targets) {
      if (!ancestry(targets, target.id).includes(id)) continue;
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
            .filter((t) => ancestry(targets, t.id).includes(id))
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
    value: Value,
    preview = false,
  ) => {
    const id = instanceId(baseId, owner),
      next = structuredClone(state),
      path: string[] = [];
    let element = [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root]")].find(
      (e) => e.dataset.uiResidentRoot === owner,
    );
    if (owner.startsWith("function:"))
      element = [...document.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-native-hidden])")].find(
        (e) => e.dataset.uiFunction === owner.slice(9),
      );
    let root = element?.closest<HTMLElement>("[data-ui-resident-root]");
    while (root) {
      path.unshift(root.dataset.uiResidentRoot!);
      root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
    }
    const names = path.map(
      (key) =>
        ui.frameActions.get(key)?.title ?? key.replace(/^(window:panel:|window:|frame:)/, ""),
    );
    next.instances[id] = { base: baseId, owner, label: label || names.at(-1) || owner, path };
    for (const channel of propertyChannels(property))
      if (TARGETS.find((t) => t.id === baseId)?.properties?.includes(channel)) {
        next.values[id] = { ...next.values[id], [channel]: value };
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
    activatePreview,
    targets,
    read,
    renderRead,
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
