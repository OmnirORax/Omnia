import { useEffect, useRef, useState } from "react";
import { ColorInput } from "../ui/ColorInput";
import { PROPERTIES, propertyFor } from "./registry";
import type { Value } from "./model";
import { applyValue, included } from "./model";
import { useAppearance } from "./Context";
import { valueFor } from "./resolve";
/** One editor implementation is shared by the controller, rows and contextual UI. */
export function PropertyEditor({
  property,
  value,
  onPreview,
  onCommit,
  disabled = false,
  label,
  effectKinds,
}: {
  property: string;
  value: Value;
  onPreview: (value: Value) => void;
  onCommit: (value: Value) => void;
  disabled?: boolean;
  label?: string;
  effectKinds?: readonly string[];
}) {
  const ctx = useAppearance();
  const p = propertyFor(property)!;
  const input = useRef<HTMLInputElement>(null),
    draft = useRef(value),
    editing = useRef(false),
    callbacks = useRef({ onCommit });
  callbacks.current = { onCommit };
  const [number, setNumber] = useState(Number(value));
  useEffect(() => {
    draft.current = value;
    setNumber(Number(value));
  }, [value]);
  useEffect(() => {
    if (p.kind !== "number") return;
    const node = input.current!;
    const commit = () => {
      if (editing.current) {
        editing.current = false;
        callbacks.current.onCommit(draft.current);
      }
    };
    node.addEventListener("change", commit);
    node.addEventListener("blur", commit);
    return () => {
      node.removeEventListener("change", commit);
      node.removeEventListener("blur", commit);
    };
  }, [p.kind]);
  if (p.kind === "color")
    return (
      <ColorInput
        aria-label={label ?? p.label}
        value={String(value)}
        disabled={disabled}
        onPreview={onPreview}
        onChange={onCommit}
      />
    );
  if (p.kind === "select")
    return (
      <select
        aria-label={label ?? p.label}
        disabled={disabled}
        value={String(value)}
        onChange={(e) => onCommit(e.target.value)}
      >
        {p.options
          ?.filter((o) => p.id !== "effect" || !effectKinds || effectKinds.includes(o.id))
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        {p.id === "font" &&
          ctx?.fonts?.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        {p.id === "font" &&
          !p.options?.some((o) => o.id === value) &&
          !ctx?.fonts?.some((o) => o.id === value) && (
            <option value={String(value)}>Imported font (not loaded)</option>
          )}
      </select>
    );
  return (
    <span className="appearance-number">
      <input
        ref={input}
        aria-label={label ?? p.label}
        disabled={disabled}
        type="range"
        min={p.min}
        max={p.max}
        step={p.step}
        value={number}
        onChange={(e) => {
          const next = Number(e.currentTarget.value);
          editing.current = true;
          draft.current = next;
          setNumber(next);
          onPreview(next);
        }}
      />
      <output>{Number(number.toFixed(2))}</output>
    </span>
  );
}
/** Also registered as normal UI functions, so shared adjusters can be moved or found. */
export function AppearanceAdjustment({ property, target }: { property: string; target?: string }) {
  const ctx = useAppearance();
  if (!ctx) return null;
  const { state, targets } = ctx,
    active = state.sets.find((s) => s.id === state.activeSet) ?? state.sets[0];
  const chosen = targets.find(
    (t) =>
      t.properties?.includes(property) &&
      (target ? t.id === target || t.id.startsWith(target + ".") : included(active, targets, t.id)),
  );
  const current =
    (!target ? active.adjustments?.[property] : undefined) ??
    (chosen ? valueFor(ctx.base, state, chosen, property) : propertyFor(property)!.initial);
  const change = (v: Value, preview = false) => {
    const next = applyValue(state, targets, property, v, target);
    if (preview) ctx.preview(next);
    else ctx.commit(next);
  };
  return (
    <PropertyEditor
      property={property}
      label={`Adjust selected ${property}`}
      disabled={!chosen}
      value={current}
      onPreview={(v) => change(v, true)}
      onCommit={(v) => change(v)}
    />
  );
}
export function PropertySelect({
  value,
  onChange,
  available,
}: {
  value: string;
  onChange: (id: string) => void;
  available?: string[];
}) {
  return (
    <select
      aria-label="Appearance adjuster"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {PROPERTIES.filter((p) => !available || available.includes(p.id)).map((p) => (
        <option value={p.id}>{p.label}</option>
      ))}
    </select>
  );
}
