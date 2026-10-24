import { RangeControl } from "../ui/RangeControl";
import { useCancelValueEdit } from "../ui/ActiveContext";
import { useEffect, useRef, useState } from "react";
import { ColorInput } from "../ui/ColorInput";
import { propertyFor, type RegisteredTarget } from "./registry";
import type { Value } from "./model";
import { applyValue, adjustmentTargets } from "./model";
import { useAppearance } from "./Context";
/** One editor implementation is shared by the controller, rows and contextual UI. */
export function PropertyEditor(props: Parameters<typeof PropertyInput>[0] & { previewTargets?: RegisteredTarget[] }) {
  const ctx = useAppearance();
  const [hover, setHover] = useState(false), [focus, setFocus] = useState(false);
  const targets = useRef(props.previewTargets); targets.current = props.previewTargets;
  const scope = JSON.stringify(props.previewTargets?.map(target => [target.id, target.instance]) ?? []);
  const activate = ctx?.activatePreview;
  useEffect(() => {
    if ((!hover && !focus) || props.disabled || ctx?.safe || !targets.current?.length) return;
    return activate?.({ property: props.property, targets: targets.current });
  }, [hover, focus, props.disabled, ctx?.safe, props.property, scope, activate]);
  return <span data-appearance-editor data-ui-native-tag="transparent" className="property-activity-preview" style={{ display: "contents" }}
    onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
    onFocusCapture={() => setFocus(true)} onBlurCapture={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocus(false);
    }}><PropertyInput {...props} /></span>;
}
function PropertyInput({
  property,
  value,
  onPreview,
  onCommit,
  disabled = false,
  label,
  effectKinds,
  choices,
}: {
  property: string;
  value: Value;
  onPreview: (value: Value) => void;
  onCommit: (value: Value) => void;
  disabled?: boolean;
  label?: string;
  effectKinds?: readonly string[];
  choices?: readonly string[];
}) {
  const ctx = useAppearance();
  const p = propertyFor(property)!;
  const beforeRange = useRef(value);
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
  const cancelRange = () => {
    if (!editing.current) return;
    editing.current = false; draft.current = beforeRange.current;
    setNumber(Number(beforeRange.current));
    onPreview(beforeRange.current);
  };
  useCancelValueEdit(input, cancelRange, p.kind);
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
  if (p.kind === "toggle")
    return (
      <label>
        <input
          aria-label={label ?? p.label}
          type="checkbox"
          checked={Boolean(value)}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.checked)}
        />
        {Boolean(value) ? "On" : "Off"}
      </label>
    );
  if (p.kind === "select") {
    const options = [
      ...(p.options ?? []).filter(
        (o) => (!choices || choices.includes(o.id)) && (p.id !== "effect" || !effectKinds || effectKinds.includes(o.id)),
      ),
      ...(p.id === "font" ? (ctx?.fonts ?? []).map((f) => ({ id: f.id, label: f.name })) : []),
    ];
    if (p.id === "font" && !options.some((o) => o.id === value))
      options.push({ id: String(value), label: "Imported font (not loaded)" });
    return (
      <div className="property-options" role="group" aria-label={label ?? p.label}>
        {options.map((option) => (
          <button
            type="button"
            key={option.id}
            data-ui-id={option.id}
            aria-pressed={value === option.id}
            disabled={disabled}
            onClick={() => onCommit(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }
  return <RangeControl
    inputRef={input} aria-label={label ?? p.label} disabled={disabled}
    min={p.min!} max={p.max!} step={p.step} value={number}
    onValueChange={next => {
      if (!editing.current) beforeRange.current = value;
      editing.current = true; draft.current = next; setNumber(next); onPreview(next);
    }}
    onValueCancel={cancelRange}
    onValueCommit={next => { editing.current = false; draft.current = next; onCommit(next); }}
  />;
}
/** Also registered as normal UI functions, so shared adjusters can be moved or found. */
export function AppearanceAdjustment({ property, target }: { property: string; target?: string }) {
  const ctx = useAppearance();
  if (!ctx) return null;
  const { state, targets } = ctx,
    active = state.sets.find((s) => s.id === state.activeSet) ?? state.sets[0];
  const editable = adjustmentTargets(state, targets, property, target);
  const chosen = editable[0];
  const current =
    (!target ? active.adjustments?.[property] : undefined) ??
    (chosen ? ctx.read(chosen, property) : propertyFor(property)!.initial);
  const change = (v: Value, preview = false) => {
    const next = applyValue(state, targets, property, v, target);
    if (preview) ctx.preview(next);
    else ctx.commit(next);
  };
  return (
    <PropertyEditor
      property={property}
      label={`Adjust selected ${property}`}
      previewTargets={editable}
      disabled={ctx.safe || !chosen}
      value={current}
      onPreview={(v) => change(v, true)}
      onCommit={(v) => change(v)}
    />
  );
}
