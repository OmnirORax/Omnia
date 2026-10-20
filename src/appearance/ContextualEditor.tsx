import { useState } from "react";
import { useAppearance, basesForOwner } from "./Context";
import { instanceId } from "./registry";
import { toggleRule } from "./model";
import { valueFor } from "./resolve";
import { LockControl } from "./LockControl";
import { PropertyTree } from "./PropertyTree";
import { PropertyEditor } from "./Controls";

export function ContextualAppearance({
  owner,
  label,
  control = false,
}: {
  owner: string;
  label: string;
  control?: boolean;
}) {
  const ctx = useAppearance();
  const [part, setPart] = useState(""),
    [property, setProperty] = useState("color");
  if (!ctx) return null;
  const choices = [
    ...basesForOwner(owner, control),
    ...ctx.targets.filter(
      (t) => !t.instance && (t.id.startsWith("text.ui.") || t.id === "symbols.ui"),
    ),
  ];
  const base = choices.find((t) => t.id === part) ?? choices[0];
  if (!base) return null;
  const id = instanceId(base.id, owner),
    instance = ctx.targets.find((t) => t.id === id),
    target = instance ?? base;
  const props = base.properties ?? [],
    p = props.includes(property) ? property : props[0];
  const initialize = () => {
    const next = structuredClone(ctx.state);
    if (!next.instances[id]) {
      const path: string[] = [];
      const element = owner.startsWith("function:")
        ? [...document.querySelectorAll<HTMLElement>("[data-ui-function]")].find(
            (el) =>
              el.dataset.uiFunction === owner.slice(9) &&
              !el.closest("[data-ui-palette],[data-shortcut-runner]"),
          )
        : [...document.querySelectorAll<HTMLElement>("[data-ui-resident-root]")].find(
            (el) => el.dataset.uiResidentRoot === owner,
          );
      let root = element?.closest<HTMLElement>("[data-ui-resident-root]");
      while (root) {
        path.unshift(root.dataset.uiResidentRoot!);
        root = root.parentElement?.closest<HTMLElement>("[data-ui-resident-root]") ?? null;
      }
      next.instances[id] = { base: base.id, owner, label, path };
    }
    for (const key of props)
      next.values[id] = { ...next.values[id], [key]: valueFor(ctx.base, ctx.state, base, key) };
    return next;
  };
  const lock = () => {
    if (instance) ctx.lock(id);
    else ctx.commit(toggleRule(initialize(), "locks", id));
  };
  const rule = ctx.state.locks[id];
  return (
    <fieldset className="contextual-appearance">
      <legend>Appearance</legend>
      <label>
        Part
        <select
          aria-label="Local appearance part"
          value={base.id}
          onChange={(e) => setPart(e.target.value)}
        >
          {choices.map((t) => (
            <option key={t.id} value={t.id}>
              {t.id.startsWith("text.")
                ? `Text · ${t.label}`
                : t.id === "symbols.ui"
                  ? "Icons"
                  : t.id.split(".").slice(1, -1).join(" / ") + " · " + t.label}
            </option>
          ))}
        </select>
      </label>
      <PropertyTree
        scope="local"
        selected={p}
        onSelect={setProperty}
        available={props}
        renderEditor={(id) => (
          <PropertyEditor
            property={id}
            effectKinds={target.effectKinds}
            label={`${label} local ${id}`}
            value={valueFor(ctx.base, ctx.state, target, id)}
            onPreview={(v) => ctx.customize(base.id, owner, label, id, v, true)}
            onCommit={(v) => ctx.customize(base.id, owner, label, id, v)}
          />
        )}
      />
      <div className="appearance-local-value">
        <LockControl
          label={`local ${label}`}
          rule={rule}
          properties={props}
          onToggle={(key) => {
            if (!key) lock();
            else if (instance) ctx.lock(id, key);
            else ctx.commit(toggleRule(initialize(), "locks", id, key));
          }}
        />
      </div>
      <button
        disabled={!instance}
        onClick={() => {
          const next = structuredClone(ctx.state);
          delete next.values[id];
          delete next.instances[id];
          delete next.refined[id];
          delete next.locks[id];
          delete next.disconnected[id];
          ctx.commit(next);
        }}
      >
        Use shared defaults
      </button>
      {instance && <small>Appears in the master controller under its shared part category.</small>}
    </fieldset>
  );
}
