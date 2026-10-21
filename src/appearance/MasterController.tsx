import { transientReveal, type RevealSession } from "../ui/transientReveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "./Context";
import { ancestry, applyValue, toggleTarget, included, blocked, connected, ruleHas, type Value } from "./model";
import { type RegisteredTarget } from "./registry";
import { valueFor } from "./resolve";
import { PropertyTree } from "./PropertyTree";
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
import { useUI } from "../ui/context";
import { APPEARANCE_HIERARCHY_ID } from "./propertyTree";
import { UI_RIGIDITY_PROPERTY, rigidityIncluded, rigidityTargets, toggleRigidity } from "../ui/rigidity";
import { highlightHierarchy } from "./highlight";
import { residentPinned } from "../ui/layout";

export function MasterController() {
  const ctx = useAppearance()!;
  const ui = useUI();
  const hierarchyOpen = !!ctx.location || !(ui.layout.windows[APPEARANCE_HIERARCHY_ID]?.collapsed ?? false);
  const { state } = ctx;
  const [selectedProperty, setProperty] = useState("color"),
    [savedQuery, setQuery] = useState(""),
    [expanded, setExpanded] = useState<Set<string>>(() => new Set(["all", "ui", "text", "omnium"]));
  const property = ctx.location?.property ?? selectedProperty,
    query = ctx.location ? "" : savedQuery;
  const rigidity = property === UI_RIGIDITY_PROPERTY;
  const effectiveLayout = { ...ui.layout, windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows } };
  const targets = rigidity ? rigidityTargets(ctx.targets, effectiveLayout, ui.functions, ui.frameActions) : ctx.targets;
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
    for (const t of targets) map.set(t.parent ?? "", [...(map.get(t.parent ?? "") ?? []), t]);
    return map;
  }, [structureKey]);
  const currentEffect = active.adjustments?.effect ?? "off";
  const applicable = (t: RegisteredTarget): boolean =>
    (descendants.get(t.id) ?? []).some(
      (child) =>
        child.properties?.includes(property) &&
        (property !== "effect" ||
          !child.effectKinds ||
          child.effectKinds.includes(String(currentEffect))),
    );
  const matches = (t: RegisteredTarget): boolean =>
    !query ||
    t.label.toLowerCase().includes(query.toLowerCase()) ||
    (children.get(t.id) ?? []).some(matches);
  const change = (value: Value, preview = false, origin?: string) => {
    const next = applyValue(
      state,
      targets,
      property,
      value,
      origin,
      !!targets.find((t) => t.id === origin)?.instance,
    );
    if (preview) ctx.preview(next);
    else ctx.commit(next);
  };
  const revealSession = useRef<RevealSession | null>(null);
  const highlighted = useRef<ReturnType<typeof highlightHierarchy> | null>(null),
    hovered = useRef<string | null>(null);
  const highlight = (id: string) => {
    highlighted.current?.stop();
    const eligible = (descendants.get(id) ?? []).filter(target => target.properties?.includes(property) &&
      (property !== "effect" || !target.effectKinds || target.effectKinds.includes(String(currentEffect))));
    highlighted.current = eligible.length ? highlightHierarchy(eligible.map(target => ({ target,
      active: rigidity ? !target.instance || !residentPinned(effectiveLayout, target.instance.owner)
        : !ctx.safe && included(active, targets, target.id) && !blocked(state, targets, target.id, property, active.only ?? "all") && connected(state, targets, target.id, property),
    })), targets, property) : null;
  };
  useEffect(() => {
    if (hovered.current) highlight(hovered.current);
  }, [property, currentEffect, state, structureKey, ctx.safe, ui.layout.uiRigidity]);
  useEffect(() => () => { revealSession.current?.stop(); highlighted.current?.stop(); }, []);
  useEffect(() => {
    if (!hierarchyOpen) {
      hovered.current = null; highlighted.current?.stop(); revealSession.current?.stop();
    }
  }, [hierarchyOpen]);
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
    if (!matches(target)) return null;
    const nested = children.get(target.id) ?? [],
      can = applicable(target),
      lit = rigidity ? rigidityIncluded(effectiveLayout, targets, target.id, ui.functions) : included(active, targets, target.id);
    const locks = state.locks[target.id],
      ancestorLock = paths
        .get(target.id)!
        .slice(0, -1)
        .some((id) => ruleHas(state.locks[id], property));
    const off = paths.get(target.id)!.some((id) => ruleHas(state.disconnected[id], property));
    const refined = state.refined[target.id]?.includes(property),
      open =
        expanded.has(target.id) ||
        !!query ||
        (!!ctx.location && ancestry(targets, ctx.location.target).includes(target.id));
    const properties = [
      ...new Set((descendants.get(target.id) ?? []).flatMap((t) => t.properties ?? [])),
    ];
    return (
      <div key={target.id} className="appearance-branch" data-appearance-target={target.id}>
        <div
          className={`appearance-row ${lit ? "is-included" : "is-excluded"} ${can ? "" : "not-applicable"}`}
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
            className="appearance-target"
            aria-label={rigidity ? `${target.label}: ${lit ? "fixed" : "movable"} outside UI edit mode` : `Target ${target.label}`}
            title={rigidity ? `${lit ? "Allow moving" : "Fix"} ${target.label} outside UI edit mode` : `${lit ? "Exclude" : "Include"} ${target.label}`}
            aria-pressed={lit}
            disabled={!can}
            onMouseEnter={() => reveal(target, true)}
            onMouseLeave={() => reveal(target, false)}
            onFocus={() => reveal(target, true)}
            onBlur={() => reveal(target, false)}
            onClick={() => rigidity
              ? ui.update(layout => toggleRigidity({ ...layout, windows: { ...Object.fromEntries(ui.defaults), ...layout.windows } }, targets, target.id, ui.functions))
              : ctx.commit(toggleTarget(state, targets, target.id))}
          >
            <svg className="appearance-toggle-icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="6" fill={lit ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            className={`appearance-plug ${off ? "is-disconnected" : ""}`}
            aria-label={`${off ? "Connect" : "Disconnect"} ${target.label}`}
            title="Connect / bypass saved property application; values are retained"
            aria-pressed={!off}
            disabled={rigidity || !can}
            onClick={() => ctx.plug(target.id)}
          >
            <svg className="appearance-toggle-icon" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v6M4 4.3a5.5 5.5 0 1 0 8 0" />
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
          {!rigidity && target.properties?.includes(property) && (
            <UIField id={`ui:appearance:target:${stableUIHash(target.id)}:${property}`} label={`${target.label} ${property}`} category="Appearance"><PropertyEditor
              property={property}
              effectKinds={target.effectKinds}
              label={`${target.label} ${property}`}
              value={valueFor(ctx.base, state, target, property)}
              onPreview={(v) => change(v, true, target.id)}
              onCommit={(v) => change(v, false, target.id)}
            /></UIField>
          )}
          {!rigidity && <LockControl
            label={target.label}
            rule={locks}
            properties={properties}
            inherited={ancestorLock}
            onToggle={(p) => ctx.lock(target.id, p)}
          />}
        </div>
        {open && nested.map((child) => row(child, depth + 1))}
      </div>
    );
  };
  return (
    <section className="appearance-controller" aria-label="Master appearance controller">
      <UISection id="appearance-targeting-sets" title="Appearance targeting sets">
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
      </UISection>
      <NameVisibilityControl />
      <PropertyTree
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
      <EmbeddedGroup
        id={APPEARANCE_HIERARCHY_ID}
        title="Visual hierarchy"
        className="appearance-hierarchy"
        expanded={hierarchyOpen}
        onToggle={() => {
          ctx.locate(null, true);
          ui.update(layout => {
            const windows = { ...Object.fromEntries(ui.defaults), ...layout.windows };
            return { ...layout, windows: {
              ...windows,
              [APPEARANCE_HIERARCHY_ID]: { ...windows[APPEARANCE_HIERARCHY_ID], collapsed: hierarchyOpen },
            } };
          });
        }}
      >
        <UIField id="ui:appearance:findBranch" label="Find appearance branch" category="Appearance"><label>Find appearance branch<input
          type="search"
          aria-label="Find appearance branch"
          placeholder="Find a branch…"
          value={query}
          onChange={(e) => {
            ctx.locate(null, true);
            setQuery(e.target.value);
          }}
        /></label></UIField>
        <small>{rigidity ? "⬤ fixed outside UI edit mode · ○ movable outside UI edit mode · explicit pins still apply" : "⬤ included · ○ excluded · ⏻ apply / bypass saved appearance · ◆ local refinement"}</small>
        <div className="appearance-tree" role="tree" aria-label="Appearance hierarchy">
          {(children.get("") ?? []).map((t) => row(t, 0))}
        </div>
      </EmbeddedGroup>
    </section>
  );
}
