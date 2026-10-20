import { transientReveal, type RevealSession } from "../ui/transientReveal";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppearance } from "./Context";
import { ancestry, applyValue, cycleTarget, included, ruleHas, type Value } from "./model";
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
import { useUI } from "../ui/context";
import { APPEARANCE_HIERARCHY_ID } from "./propertyTree";

export function MasterController() {
  const ctx = useAppearance()!;
  const ui = useUI();
  const hierarchyOpen = !!ctx.location || !(ui.layout.windows[APPEARANCE_HIERARCHY_ID]?.collapsed ?? false);
  const { state, targets } = ctx;
  const [selectedProperty, setProperty] = useState("color"),
    [savedQuery, setQuery] = useState(""),
    [expanded, setExpanded] = useState<Set<string>>(() => new Set(["all", "ui", "text", "omnium"]));
  const property = ctx.location?.property ?? selectedProperty,
    query = ctx.location ? "" : savedQuery;
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
  useEffect(() => () => revealSession.current?.stop(), []);
  const reveal = (target: RegisteredTarget, on: boolean) => {
    revealSession.current?.stop();
    revealSession.current = null;
    if (on && target.instance)
      revealSession.current = transientReveal({
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
      lit = can && included(active, targets, target.id),
      isolated = active.only === target.id;
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
          onMouseEnter={() => target.instance && reveal(target, true)}
          onMouseLeave={() => target.instance && reveal(target, false)}
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
            aria-label={`Target ${target.label}`}
            title={
              isolated
                ? "Only this branch · click to restore other targets"
                : lit
                  ? "Branch on · click to exclude"
                  : "Branch off · click to isolate"
            }
            disabled={!can}
            onClick={() => ctx.commit(cycleTarget(state, targets, target.id))}
          >
            {isolated ? "◎" : lit ? "●" : "○"}
          </button>
          <button
            className={`appearance-plug ${off ? "is-disconnected" : ""}`}
            aria-label={`${off ? "Connect" : "Disconnect"} ${target.label}`}
            title="Connect / bypass saved property application; values are retained"
            disabled={!can}
            onClick={() => ctx.plug(target.id)}
          >
            ⏻
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
          {target.properties?.includes(property) && (
            <PropertyEditor
              property={property}
              effectKinds={target.effectKinds}
              label={`${target.label} ${property}`}
              value={valueFor(ctx.base, state, target, property)}
              onPreview={(v) => change(v, true, target.id)}
              onCommit={(v) => change(v, false, target.id)}
            />
          )}
          <LockControl
            label={target.label}
            rule={locks}
            properties={properties}
            inherited={ancestorLock}
            onToggle={(p) => ctx.lock(target.id, p)}
          />
        </div>
        {open && nested.map((child) => row(child, depth + 1))}
      </div>
    );
  };
  return (
    <section className="appearance-controller" aria-label="Master appearance controller">
      <div className="appearance-sets" role="group" aria-label="Appearance targeting sets">
        <select
          aria-label="Appearance set"
          value={active.id}
          onChange={(e) => ctx.commit({ ...state, activeSet: e.target.value })}
        >
          {state.sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          title="Add appearance targeting set"
          onClick={() => {
            const id = crypto.randomUUID();
            ctx.commit({
              ...state,
              sets: [
                ...state.sets,
                { id, name: `Set ${state.sets.length + 1}`, selection: { ...active.selection } },
              ],
              activeSet: id,
            });
          }}
        >
          +
        </button>
        <input
          aria-label="Appearance set name"
          value={active.name}
          onChange={(e) =>
            ctx.commit({
              ...state,
              sets: state.sets.map((s) =>
                s.id === active.id ? { ...s, name: e.target.value } : s,
              ),
            })
          }
        />
        <button
          disabled={state.sets.length < 2}
          title="Remove targeting set; appearance values are retained"
          onClick={() =>
            ctx.commit({
              ...state,
              sets: state.sets.filter((s) => s.id !== active.id),
              activeSet: state.sets.find((s) => s.id !== active.id)!.id,
            })
          }
        >
          ×
        </button>
      </div>
      <NameVisibilityControl />
      <PropertyTree
        selected={property}
        onSelect={(id) => {
          ctx.preview(null);
          ctx.locate(null, true);
          setProperty(id);
        }}
        renderEditor={(id) => <FunctionControl id={`ui:master:${id}`} />}
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
        <input
          type="search"
          aria-label="Find appearance branch"
          placeholder="Find a branch…"
          value={query}
          onChange={(e) => {
            ctx.locate(null, true);
            setQuery(e.target.value);
          }}
        />
        <small>● include · ○ exclude · ◎ only · ⏻ plug · ◆ local refinement</small>
        <div className="appearance-tree" role="tree" aria-label="Appearance hierarchy">
          {(children.get("") ?? []).map((t) => row(t, 0))}
        </div>
      </EmbeddedGroup>
    </section>
  );
}
