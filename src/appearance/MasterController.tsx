import { copyPropertyValues, type PropertySource } from "../properties/clipboard";
import { preparePropertyChanges, validateValue, type PropertyChange } from "../properties/registry";
import { useFeatureActions } from "../ui/useFeatureActions";
import { HistoryControls } from "../ui/ContextualHistoryController";
import type { ActionHistory } from "../ui/actionHistory";
import { ActiveContextControls } from "../ui/ActiveContext";
import { ConsumerProperties } from "../properties/ConsumerProperties";
import { resolvePropertyTarget } from "../properties/registry";
import { CoupledProperties, type PropertyBindings } from "../properties/CoupledProperties";
import { transientReveal, type RevealSession } from "../ui/transientReveal";
import { useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAppearance } from "./Context";
import { nativeContextMenuKey } from "../featureActions";
import { ancestry, propertyChannels, adjustmentTargets, createTargetIndex, applyValue, toggleTarget, included, blocked, connected, ruleHas, type Value } from "./model";
import { type RegisteredTarget } from "./registry";
import { PropertyTree } from "./PropertyTree";
import { SelectedProperties } from "./SelectionController";
import { SelectorFeedbackSample } from "./VisualSelectionOverlay";
import { useVisualSelection, SelectionPreviewToggle } from "./VisualSelector";
import { describeSelectedParts } from "./selectedParts";
import { collectVisualParts } from "./visualSelection";
import { applySelectedValue, selectedPartTarget, selectedPartPolicy, selectedPartId } from "./selectionCoupling";
import { PROPERTY_REGISTRY } from "./registry";
import { PropertyEditor } from "./Controls";
import { LockControl } from "./LockControl";
import { rootFor } from "../ui/FrameSearch";
import { FunctionControl } from "../ui/UIWorkspace";
import { EditableLabel } from "../ui/EditableLabel";
import { NameVisibilityControl } from "../ui/NamePresentation";
import { EmbeddedGroup } from "../ui/EmbeddedGroup";
import { UISection } from "../ui/UISection";
import { UIField } from "../ui/UIField";
import { stableUIHash } from "../ui/identity";
import { UIAction } from "../ui/UIAction";
import { useUI, UIContainerContext, UIHomeContext } from "../ui/context";
import { APPEARANCE_HIERARCHY_ID } from "./propertyTree";
import { UI_RIGIDITY_PROPERTY, rigidityIncluded, rigidityRowVisible, rigidityTargets, toggleRigidity } from "../ui/rigidity";
import { highlightHierarchy } from "./highlight";
import { useFrameExpansion } from "../ui/frameExpansion";
import { residentPinned } from "../ui/layout";

export function MasterController({ bindings, visualStatus, history, children: visualTools }: { bindings?: PropertyBindings; visualStatus?: ReactNode; history?: ActionHistory; children?: ReactNode }) {
  const ctx = useAppearance()!;
  const ui = useUI();
  const visualSelection = useVisualSelection();
  const logicalTargets = (visualSelection?.objects ?? []).map(id => resolvePropertyTarget(PROPERTY_REGISTRY, id));
  const selectingObject = logicalTargets.length > 0;
  const selectedFunctionKey = [...ui.selectedFunctions].sort().join("|");
  const selectedParts = useMemo(() => {
    const picked = selectingObject ? [] : [...(visualSelection?.parts ?? [])];
    if (!selectingObject && ui.selectedFunctions.size) picked.push(...collectVisualParts().filter(part => {
      const functionId = part.element.closest("[data-ui-function]")?.getAttribute("data-ui-function");
      return !!functionId && ui.selectedFunctions.has(functionId);
    }));
    return describeSelectedParts(picked);
  }, [visualSelection?.parts, selectedFunctionKey, selectingObject]);
  const selectedFunctions = new Set([...(selectingObject ? [] : ui.selectedFunctions),
    ...selectedParts.flatMap(part => part.owner.startsWith("function:") ? [part.owner.slice(9)] : [])]);
  const selectedConsumers = [...new Set([...logicalTargets.flatMap(target => target.consumers),
    ...PROPERTY_REGISTRY.consumers.filter(consumer => selectedFunctions.has(consumer.id) || consumer.controls?.some(id => selectedFunctions.has(id))).map(consumer => consumer.id)])];
  const appearanceConsumers = selectedConsumers.filter(id => PROPERTY_REGISTRY.consumer(id)?.owner === "appearance" && !ctx.targets.find(target => target.id === id)?.hidden);
  const scopeKey = [visualSelection?.inspectionKey ?? "", visualSelection?.boundary?.key ?? "", ...selectedParts.map(selectedPartId), ...selectedConsumers, ...ui.selectedFunctions].filter(Boolean).sort().join("|");
  const [dismissedScope, dismissScope] = useState<string | null>(null);
  const inspecting = !!scopeKey && dismissedScope !== scopeKey;
  useEffect(() => { if (!scopeKey) dismissScope(null); }, [scopeKey]);
  const originalParent = useContext(UIContainerContext), originalHome = useContext(UIHomeContext);
  const selectionKey = visualSelection?.inspectionKey ?? "";
  const [selectionHierarchy, setSelectionHierarchy] = useState<{ key: string; open: boolean } | null>(null);
  useEffect(() => {
    setSelectionHierarchy(selectionKey ? { key: selectionKey, open: true } : null);
  }, [selectionKey]);
  // Selection reveals the existing hierarchy without writing layout or history.
  // A manual collapse applies only to this selection; the next one reveals it again.
  const hierarchyOpen = !!ctx.location || (selectionKey
    ? selectionHierarchy?.key !== selectionKey || selectionHierarchy.open
    : !(ui.layout.windows[APPEARANCE_HIERARCHY_ID]?.collapsed ?? false));
  const { state } = ctx;
  const [selectedProperty, setProperty] = useState("color"),
    [expanded, setExpanded] = useState<Set<string>>(() => new Set(["all", "ui", "text", "omnium"]));
  const property = ctx.location?.property ?? selectedProperty;
  const rigidity = property === UI_RIGIDITY_PROPERTY;
  const showIndividuals = !!ui.layout.panels["@appearanceShowIndividuals"];
  const effectiveLayout = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  const targets = rigidity ? rigidityTargets(ctx.targets, effectiveLayout, ui.functions, ui.frameActions) : ctx.targets;
  const editableProperties = useMemo(() => {
    if (ctx.safe) return [];
    const index = createTargetIndex(ctx.targets);
    return [...new Set(ctx.targets.flatMap(target => target.properties ?? []))]
      .filter(id => adjustmentTargets(state, ctx.targets, id, undefined, index).length > 0);
  }, [state, ctx.targets, ctx.safe]);
  const active = state.sets.find((s) => s.id === state.activeSet) ?? state.sets[0];
  const structureKey = JSON.stringify(
    targets.map((t) => [t.id, t.parent, t.label, t.properties, t.instance]),
  );
  const paths = useMemo(
    () => new Map(targets.map((t) => [t.id, ancestry(targets, t.id)])),
    [structureKey],
  );
  const descendants = useMemo(
    () =>
      new Map(
        targets.map((t) => [t.id, targets.filter((child) => paths.get(child.id)!.includes(t.id))]),
      ),
    [structureKey],
  );
  const children = useMemo(() => {
    const map = new Map<string, RegisteredTarget[]>();
    const byId = new Map(targets.map(target => [target.id, target]));
    const individualGroups = new Set(ctx.targets.flatMap(target =>
      target.instance ? [`${target.instance.base}.custom`] : []));
    for (const t of targets) {
      if (t.hidden) continue;
      if (!showIndividuals && (t.instance || individualGroups.has(t.id))) continue;
      if (rigidity && !rigidityRowVisible(t, ctx.targets, effectiveLayout)) continue;
      let parent = t.parent;
      while (parent && byId.get(parent)?.hidden) parent = byId.get(parent)?.parent;
      map.set(parent ?? "", [...(map.get(parent ?? "") ?? []), t]);
    }
    return map;
  }, [structureKey, rigidity, showIndividuals, ctx.targets, ui.layout.uiRigidity]);
  const [scopeExclusions, setScopeExclusions] = useState<{ key: string; ids: Set<string> }>({ key: "", ids: new Set() });
  const excludedItems = scopeExclusions.key === scopeKey ? scopeExclusions.ids : new Set<string>();
  const scopeItems = useMemo(() => {
    const items = selectedParts.map(part => {
      const target = selectedPartTarget(part);
      return { id: target.id, target, part, path: paths.get(target.id) ?? [...(paths.get(part.base) ?? []), target.id] };
    });
    return [...items, ...selectedConsumers.filter(id => !items.some(item => item.id === id)).map(id => ({
      id, target: targets.find(target => target.id === id), part: undefined,
      path: paths.get(id) ?? [],
    }))];
  }, [selectedParts, selectedConsumers.join("|"), structureKey]);
  const editingParts = selectedParts.filter(part => !excludedItems.has(selectedPartId(part)));
  const editingConsumers = selectedConsumers.filter(id => !excludedItems.has(id));
  const scopeBranches = useMemo(() => {
    const branches = new Map<string, typeof scopeItems>();
    for (const item of scopeItems) for (const id of item.path) {
      const items = branches.get(id);
      if (items) items.push(item); else branches.set(id, [item]);
    }
    return branches;
  }, [scopeItems]);
  const inBranch = (id: string) => scopeBranches.get(id) ?? [];
  useEffect(() => {
    if (!inspecting) return;
    setExpanded(previous => new Set([...previous, ...scopeBranches.keys()]));
  }, [scopeKey, inspecting]);
  const toggleScopeBranch = (id: string) => {
    // Explicitly choosing a parent can broaden the live pattern selection within
    // its existing work area. Logical/individual scopes retain their local mask.
    if (!selectingObject && visualSelection?.boundary && visualSelection.targetSelection.has(id)) {
      ctx.preview(null); visualSelection.selectTarget(id); return;
    }
    const items = inBranch(id), exclude = items.some(item => !excludedItems.has(item.id));
    ctx.preview(null);
    setScopeExclusions(previous => {
      const ids = new Set(previous.key === scopeKey ? previous.ids : []);
      for (const item of items) { if (exclude) ids.add(item.id); else ids.delete(item.id); }
      return { key: scopeKey, ids };
    });
  };
  const scopedPolicy = (id: string, field: "locks" | "disconnected", selectedProperty?: string) => {
    const items = inBranch(id).filter(item => item.target && !excludedItems.has(item.id));
    if (!items.length) return;
    const next = { ...state, instances: { ...state.instances }, values: { ...state.values }, [field]: { ...state[field] } };
    const enable = items.some(item => !ruleHas(state[field][item.id], selectedProperty ?? "color"));
    for (const item of items) {
      if (item.part && item.id !== item.part.base && !next.instances[item.id]) next.instances[item.id] = item.part;
      const old = next[field][item.id];
      if (!selectedProperty) {
        if (enable) next[field][item.id] = { all: true }; else delete next[field][item.id];
      } else {
        const properties = new Set(old?.all ? item.target!.properties ?? [] : old?.properties ?? []);
        if (enable) properties.add(selectedProperty); else properties.delete(selectedProperty);
        next[field][item.id] = { properties: [...properties] };
      }
      if (field === "locks" && enable) {
        const properties = selectedProperty ? propertyChannels(selectedProperty) : item.target!.properties ?? [];
        next.values[item.id] = { ...next.values[item.id], ...Object.fromEntries(properties.map(property => [property, ctx.read(item.target!, property)])) };
      }
    }
    ctx.commit(next);
  };
  useFrameExpansion(true, expanded.size > 0, expand => {
    ctx.locate(null, true);
    setExpanded(new Set(expand ? targets.filter(target => children.has(target.id)).map(target => target.id) : []));
  }, `window:${APPEARANCE_HIERARCHY_ID}`);
  const currentEffect = active.adjustments?.effect ?? "off";
  const applicable = (t: RegisteredTarget): boolean =>
    (descendants.get(t.id) ?? []).some(
      (child) =>
        child.properties?.includes(property) &&
        (property !== "effect" ||
          !child.effectKinds ||
          child.effectKinds.includes(String(currentEffect))),
    );
  const change = (value: Value, preview = false, origin?: string) => {
    let next = inspecting ? applySelectedValue(state, editingParts.filter(part => !origin || inBranch(origin).some(item => item.id === selectedPartId(part))), property, value) : applyValue(
      state,
      targets,
      property,
      value,
      origin,
      !!targets.find((t) => t.id === origin)?.instance,
    );
    if (inspecting) for (const id of appearanceConsumers.filter(id => editingConsumers.includes(id) && (!origin || inBranch(origin).some(item => item.id === id))))
      next = applyValue(next, targets, property, value, id);
    if (preview) ctx.preview(next);
    else ctx.commit(next);
  };
  const [clipboardNotice, setClipboardNotice] = useState("");
  const copyProperties = () => {
    const sources: PropertySource[] = [];
    if (inspecting) {
      for (const part of editingParts) {
        const target = selectedPartTarget(part);
        sources.push({ properties: target.properties ?? [], read: property => ctx.read(target, property) });
      }
      for (const id of editingConsumers) {
        const consumer = PROPERTY_REGISTRY.consumer(id); if (!consumer) continue;
        const target = targets.find(target => target.id === id);
        if (consumer.owner === "appearance" && target) {
          sources.push({ properties: target.properties ?? [], read: property => ctx.read(target, property) });
        } else if (consumer.owner !== "appearance" && bindings) {
          sources.push({ properties: consumer.properties, read: property => bindings.values[id][consumer.channels[property]] });
        }
      }
    } else {
      const index = createTargetIndex(targets), properties = new Map<string, Set<string>>();
      for (const property of editableProperties) for (const target of adjustmentTargets(state, targets, property, undefined, index)) {
        const set = properties.get(target.id) ?? new Set<string>(); set.add(property); properties.set(target.id, set);
      }
      for (const target of targets) if (properties.has(target.id)) sources.push({ properties: [...properties.get(target.id)!], read: property => ctx.read(target, property) });
    }
    const snapshot = copyPropertyValues(PROPERTY_REGISTRY, sources); ctx.copyProperties(snapshot);
    setClipboardNotice(`Copied ${Object.keys(snapshot.values).length}${snapshot.mixed.length ? ` · ${snapshot.mixed.length} mixed omitted` : ""}`);
  };
  const pasteProperties = () => {
    if (!ctx.propertyClipboard || ctx.safe) return;
    let next = state;
    const changes: PropertyChange[] = [];
    // Effect kind first; its channels then restore the exact copied tuning.
    const entries = Object.entries(ctx.propertyClipboard.values).sort(([a], [b]) => Number(b === "effect") - Number(a === "effect"));
    for (const [property, value] of entries) {
      if (inspecting) {
        next = applySelectedValue(next, editingParts, property, value);
        for (const id of appearanceConsumers.filter(id => editingConsumers.includes(id)))
          if (!blocked(next, targets, id, property, "all") && connected(next, targets, id, property)) next = applyValue(next, targets, property, value, id, false, true);
        if (bindings) for (const id of editingConsumers) {
          const consumer = PROPERTY_REGISTRY.consumer(id), channel = consumer?.channels[property];
          const definition = PROPERTY_REGISTRY.property(property);
          if (!consumer || consumer.owner === "appearance" || !channel || !definition || validateValue(definition, value) !== value ||
            consumer.choices[channel] && !consumer.choices[channel].includes(String(value))) continue;
          changes.push(...preparePropertyChanges(PROPERTY_REGISTRY, property, value, [id]));
        }
      } else if (editableProperties.includes(property)) next = applyValue(next, targets, property, value, undefined, false, true);
    }
    ctx.preview(null); if (next !== state) ctx.commit(next); if (changes.length) bindings?.commit(changes);
    setClipboardNotice("Pasted applicable properties");
  };
  useFeatureActions("propertyClipboard", {
    "properties.copy": { enabled: !ctx.safe && (inspecting ? editingParts.length + editingConsumers.length > 0 : editableProperties.length > 0), run: copyProperties },
    "properties.paste": { enabled: !ctx.safe && !!ctx.propertyClipboard && Object.keys(ctx.propertyClipboard.values).length > 0, run: pasteProperties },
  });
  const revealSession = useRef<RevealSession | null>(null);
  const highlighted = useRef<ReturnType<typeof highlightHierarchy> | null>(null),
    hovered = useRef<string | null>(null);
  const highlight = (id: string) => {
    highlighted.current?.stop();
    const sources = inspecting ? inBranch(id).filter(item => item.target && !excludedItems.has(item.id)).map(item => item.target!) : descendants.get(id) ?? [];
    const eligible = sources.filter(target => !target.aggregate && target.properties?.includes(property) &&
      (property !== "effect" || !target.effectKinds || target.effectKinds.includes(String(currentEffect))));
    const partPolicy = inspecting ? selectedPartPolicy(state) : null;
    highlighted.current = eligible.length ? highlightHierarchy(eligible.map(target => ({ target,
      active: rigidity ? !target.instance || !residentPinned(effectiveLayout, target.instance.owner)
        : inspecting && scopeItems.find(item => item.id === target.id)?.part
          ? !ctx.safe && partPolicy!(scopeItems.find(item => item.id === target.id)!.part!, property)
          : !ctx.safe && (inspecting ? true : included(active, targets, target.id)) && !blocked(state, targets, target.id, property, active.only ?? "all") && connected(state, targets, target.id, property),
    })), targets, property) : null;
  };
  useEffect(() => {
    if (hovered.current) highlight(hovered.current);
  }, [property, currentEffect, state, structureKey, ctx.safe, ui.layout.uiRigidity, scopeKey, scopeExclusions, inspecting]);
  useEffect(() => () => { revealSession.current?.stop(); highlighted.current?.stop(); }, []);
  useEffect(() => {
    if (!hierarchyOpen) {
      hovered.current = null; highlighted.current?.stop(); revealSession.current?.stop();
    }
  }, [hierarchyOpen]);
  useEffect(() => {
    const target = targets.find(target => target.id === hovered.current);
    if (!showIndividuals && target && (target.instance || target.id.endsWith(".custom"))) {
      hovered.current = null;
      highlighted.current?.stop();
      revealSession.current?.stop();
    }
  }, [showIndividuals]);
  const reveal = (target: RegisteredTarget, on: boolean) => {
    if (target.id === "all") on = false;
    revealSession.current?.stop();
    revealSession.current = null;
    highlighted.current?.stop();
    highlighted.current = null;
    hovered.current = on ? target.id : null;
    if (on) highlight(target.id);
    if (on && target.instance && applicable(target))
      revealSession.current = transientReveal({
        highlight: false,
        path: target.instance.path ?? [],
        reveal: (path) => ctx.reveal?.(path),
        locate: () => {
          const owner = target.instance!.owner;
          return owner.startsWith("function:")
            ? [...document.querySelectorAll<HTMLElement>("[data-ui-function]:not([data-ui-native-hidden])")].find(
                (el) =>
                  el.dataset.uiFunction === owner.slice(9) &&
                  !el.closest("[data-ui-palette],[data-shortcut-runner]"),
              )
            : rootFor(owner);
        },
      });
  };

  const row = (target: RegisteredTarget, depth: number): React.ReactNode => {
    const count = inspecting && !selectingObject && visualSelection?.boundary ? visualSelection.targetSelection.get(target.id) : undefined;
    const partial = !!count && count.included > 0 && count.included < count.total;
    const nested = children.get(target.id) ?? [],
      can = applicable(target) && (!inspecting || !!count?.total || inBranch(target.id).some(item => item.target?.properties?.includes(property))),
      lit = rigidity ? rigidityIncluded(effectiveLayout, targets, target.id, ui.functions) : inspecting
        ? count ? count.included === count.total : inBranch(target.id).some(item => !excludedItems.has(item.id)) : included(active, targets, target.id);
    const branchItems = inspecting ? inBranch(target.id).filter(item => !excludedItems.has(item.id)) : [];
    const scopedLocks = branchItems.map(item => state.locks[item.id]);
    const locks = inspecting ? (scopedLocks.some(Boolean) ? {
      all: scopedLocks.length > 0 && scopedLocks.every(rule => rule?.all),
      properties: [...new Set(scopedLocks.flatMap(rule => rule?.properties ?? []))],
    } : undefined) : state.locks[target.id],
      ancestorLock = paths
        .get(target.id)!
        .slice(0, -1)
        .some((id) => ruleHas(state.locks[id], property));
    const off = !rigidity && (inspecting ? branchItems.length > 0 && branchItems.every(item => !connected(state, targets, item.id, property)) : !connected(state, targets, target.id, property));
    const refined = state.refined[target.id]?.includes(property),
      open =
        expanded.has(target.id) ||
        (!!ctx.location && ancestry(targets, ctx.location.target).includes(target.id));
    const properties = [
      ...new Set((descendants.get(target.id) ?? []).flatMap((t) => t.properties ?? [])),
    ];
    return (
      <div key={target.id} className="appearance-branch" data-appearance-target={target.id}>
        <div
          className={`appearance-row ${partial ? "is-partial" : lit ? "is-included" : "is-excluded"} ${can ? "" : "not-applicable"}`}
          style={{ paddingLeft: depth * 12 }}
        >
          <button
            className="appearance-expand"
            aria-label={`${open ? "Collapse" : "Expand"} ${target.label}`}
            disabled={!nested.length}
            onClick={() =>
              setExpanded((old) => {
                const next = new Set(old);
                if (next.has(target.id)) next.delete(target.id);
                else next.add(target.id);
                return next;
              })
            }
          >
            {nested.length ? (open ? "▾" : "▸") : "·"}
          </button>
          <button
            className={`appearance-target ${off ? "is-disconnected" : ""}`}
            data-ui-preserve-title
            aria-label={rigidity ? `${target.label}: ${lit ? "fixed" : "movable"} outside UI edit mode` : `${target.label}: ${partial ? "partially included" : lit ? "included" : "excluded"}, ${off ? "bypassed" : "connected"}`}
            title={rigidity ? `${lit ? "Allow moving" : "Fix"} ${target.label} outside UI edit mode` : `Left-click: ${lit ? "exclude" : "include"} ${target.label}. Right-click: toggle saved appearance bypass. Filled / hollow = included / excluded; bright / dark = connected / bypassed. Parent bypasses also apply. Shift+F10 toggles bypass with the keyboard.`}
            aria-pressed={partial ? "mixed" : lit}
            aria-keyshortcuts={rigidity ? undefined : "Shift+F10"}
            disabled={!can}
            onMouseEnter={() => reveal(target, true)}
            // Feedback belongs only to pointer hover on this circle, never focus or editor activity.
            onMouseLeave={() => reveal(target, false)}
            onContextMenuCapture={event => {
              if (rigidity || !can) return;
              event.preventDefault();
              event.stopPropagation();
              if (inspecting) scopedPolicy(target.id, "disconnected"); else ctx.plug(target.id);
            }}
            onKeyDown={event => {
              if (rigidity || !can || !nativeContextMenuKey(event)) return;
              event.preventDefault();
              event.stopPropagation();
              if (inspecting) scopedPolicy(target.id, "disconnected"); else ctx.plug(target.id);
            }}
            onClick={() => rigidity
              ? ui.update(layout => toggleRigidity({ ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } }, targets, target.id, ui.functions))
              : inspecting ? toggleScopeBranch(target.id) : ctx.commit(toggleTarget(state, targets, target.id))}
          >
            <svg className="appearance-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill={lit ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <span className="appearance-row-name">
            <EditableLabel id={`appearance:target:${target.id}`} fallback={target.label} />
            {refined && (
              <span
                className="appearance-refined"
                title="Locally refined; an unlocked categorical adjustment can overwrite it"
              >
                ◆
              </span>
            )}
          </span>
          {!rigidity && !inspecting && target.properties?.includes(property) && (
            <UIField id={`ui:appearance:target:${stableUIHash(target.id)}:${property}`} label={`${target.label} ${property}`} category="Appearance"><PropertyEditor
              property={property}
              previewTargets={[target]}
              effectKinds={target.effectKinds}
              label={`${target.label} ${property}`}
              value={ctx.read(target, property)}
              onPreview={(v) => change(v, true, target.id)}
              onCommit={(v) => change(v, false, target.id)}
            /></UIField>
          )}
          {!rigidity && (!inspecting || branchItems.length > 0) && <LockControl
            label={target.label}
            rule={locks}
            properties={properties}
            inherited={ancestorLock}
            onToggle={(p) => inspecting ? scopedPolicy(target.id, "locks", p) : ctx.lock(target.id, p)}
          />}
        </div>
        {open && nested.map((child) => row(child, depth + 1))}
      </div>
    );
  };
  return (
    <section data-appearance-editor className="appearance-controller" aria-label="Master controller"
      onPointerLeave={() => {
        const target = targets.find(target => target.id === hovered.current);
        if (target) reveal(target, false);
      }}>
      <ActiveContextControls />
      {history && <UISection id="history-controls" title="History"><HistoryControls history={history} /></UISection>}
      <SelectionPreviewToggle />
      {bindings && !inspecting && <CoupledProperties bindings={bindings} />}
      <UISection id="master-category:visual" title="Visuals" reveal={inspecting} defaultExpanded={inspecting} expanded={ctx.location || inspecting ? true : undefined}>
      {visualStatus}

      <EmbeddedGroup id={`section:${stableUIHash(originalParent ?? originalHome)}:appearance-targeting-sets`} title="Appearance targeting sets" className="ui-section" nativeTag="transparent">
        <div className="appearance-sets">
          <UIField id="ui:appearance:activeSet" label="Active targeting set" category="Appearance">
            <label>Targeting set<select aria-label="Appearance set" value={active.id}
              onChange={e => ctx.commit({ ...state, activeSet: e.target.value })}>
              {state.sets.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}
            </select></label>
          </UIField>
          <UIAction id={`ui:native:${stableUIHash("window:theme")}:${stableUIHash("DIV:0/SECTION:0/DIV:0/BUTTON:0")}`} label="Add targeting set" symbol="+" category="Appearance" onClick={() => {
            const id = crypto.randomUUID();
            ctx.commit({ ...state, sets: [...state.sets, { id, name: `Set ${state.sets.length + 1}`, selection: { ...active.selection } }], activeSet: id });
          }} />
          <UIField id="ui:appearance:setName" label="Targeting set name" category="Appearance">
            <label>Set name<input aria-label="Appearance set name" value={active.name} onChange={e => ctx.commit({
              ...state, sets: state.sets.map(set => set.id === active.id ? { ...set, name: e.target.value } : set),
            })} /></label>
          </UIField>
          <UIAction id={`ui:native:${stableUIHash("window:theme")}:${stableUIHash("DIV:0/SECTION:0/DIV:0/BUTTON:1")}`} label="Remove targeting set" symbol="×" category="Appearance"
            disabled={state.sets.length < 2} onClick={() => ctx.commit({ ...state,
              sets: state.sets.filter(set => set.id !== active.id), activeSet: state.sets.find(set => set.id !== active.id)!.id,
            })} />
        </div>
      </EmbeddedGroup>
      <NameVisibilityControl />
      <UISection id="master-properties" title="Properties">
      <div className="property-clipboard-tools" data-context-controller>
        <FunctionControl id="properties.copy" mirror /><FunctionControl id="properties.paste" mirror />
        {clipboardNotice && <small role="status">{clipboardNotice}</small>}
      </div>
      {inspecting ? <div data-visual-selector data-selection-editor>
        <UIAction id="ui:controller:showAll" label="Show all controls" category="Master controller" onClick={() => dismissScope(scopeKey)} />
        {editingParts.length > 0 && <SelectedProperties parts={editingParts} scope="master-selection" selectedProperty={property}
          onSelectProperty={id => { ctx.preview(null); ctx.locate(null, true); setProperty(id); }} />}
        {appearanceConsumers.some(id => editingConsumers.includes(id)) && <><SelectorFeedbackSample targets={appearanceConsumers.filter(id => editingConsumers.includes(id))} />
          <ConsumerProperties consumers={appearanceConsumers.filter(id => editingConsumers.includes(id))} selectedProperty={property}
            onSelectProperty={id => { ctx.preview(null); ctx.locate(null, true); setProperty(id); }} /></>}
        {bindings && editingConsumers.length > 0 && <CoupledProperties bindings={bindings} selectedConsumers={editingConsumers} scope="inspection" />}
      </div> : <>
      {bindings && <CoupledProperties bindings={bindings} category="visual" />}
      <PropertyTree
        available={[...new Set(targets.flatMap(target => target.properties ?? [])), UI_RIGIDITY_PROPERTY]}
        editable={[...editableProperties, UI_RIGIDITY_PROPERTY]}
        extraProperties={[{ id: UI_RIGIDITY_PROPERTY, property: UI_RIGIDITY_PROPERTY, label: "UI rigidity",
          tooltip: "Included parts stay fixed outside UI edit mode. Exclude a branch or individual item to let it move freely. Normal clicks and field editing stay available.",
        }]}
        selected={property}
        onSelect={(id) => {
          ctx.preview(null);
          ctx.locate(null, true);
          setProperty(id);
        }}
        renderEditor={(id) => id === UI_RIGIDITY_PROPERTY ? <>
          <UIAction id="ui:rigidity:editMode" label={ui.layout.panels["@devMode"] ? "Exit UI edit mode" : "Enter UI edit mode"}
            category="Interface" onClick={() => ui.update(layout => ({ ...layout, panels: { ...layout.panels, "@devMode": !layout.panels["@devMode"] } }))} />
        </> : <FunctionControl id={`ui:master:${id}`} />}
      />
      </>}
      </UISection>
      <EmbeddedGroup
        id={APPEARANCE_HIERARCHY_ID}
        title="Visual hierarchy"
        className="appearance-hierarchy"
        reveal={!!selectionKey || !!ctx.location}
        expanded={hierarchyOpen}
        onToggle={() => {
          ctx.locate(null, true);
          if (selectionKey) { setSelectionHierarchy({ key: selectionKey, open: !hierarchyOpen }); return; }
          ui.update(layout => {
            const windows = { ...Object.fromEntries(ui.defaults), ...layout.windows };
            return { ...layout, windows: {
              ...windows,
              [APPEARANCE_HIERARCHY_ID]: { ...windows[APPEARANCE_HIERARCHY_ID], collapsed: hierarchyOpen },
            } };
          });
        }}
      >
        <UIField id="ui:appearance:showIndividuals" label="Show individuals" category="Appearance">
          <label><input type="checkbox" checked={showIndividuals} onChange={event => {
            const show = event.target.checked;
            ui.update(layout => ({ ...layout, panels: { ...layout.panels, "@appearanceShowIndividuals": show } }));
          }} /> Show individuals</label>
        </UIField>
        <div className="appearance-tree" role="tree" aria-label="Appearance hierarchy">
          {(children.get("") ?? []).map((t) => row(t, 0))}
        </div>
      </EmbeddedGroup>
      {visualTools}
      </UISection>
    </section>
  );
}
