import { useCancelValueEdit } from "./ActiveContext";
import { rangeValue } from "./rangeMath";
import { useRef, useState, type CSSProperties, type InputHTMLAttributes, type Ref } from "react";

type Edit = "min" | "max" | "value" | "jump";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "onChange" | "onWheel" | "children"> & {
  value: number; min: number; max: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  onMinimumChange?: (value: number) => void;
  onMaximumChange?: (value: number) => void;
  hardMin?: number; hardMax?: number;
  inputRef?: Ref<HTMLInputElement>;
  onWheel?: (event: React.WheelEvent<HTMLElement>) => void;
};
/** A shared slider presentation, retaining native drag/keyboard/change semantics.
 * Local working intervals and jump size never alter property validation bounds. */
export function RangeControl({ value, min, max, onValueChange, onMinimumChange, onMaximumChange,
  hardMin = min, hardMax = max, inputRef, onValueCommit, onWheel, ...inputProps }: Props) {
  const resolution = Number(inputProps.step) || 1;
  const [interval, setInterval] = useState({ min, max }), [jump, setJump] = useState(resolution);
  const [editing, setEditing] = useState<Edit | null>(null), [text, setText] = useState("");
  const low = onMinimumChange ? min : Math.min(value, Math.max(min, interval.min));
  const high = onMaximumChange ? max : Math.max(value, Math.min(max, interval.max));
  const endpoint = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const label = inputProps["aria-label"] ?? "Value";
  const edit = (which: Edit) => { cancelled.current = false; setText(String(which === "min" ? low : which === "max" ? high : which === "jump" ? jump : value)); setEditing(which); };
  const choose = (next: number) => { onValueChange(next); onValueCommit?.(next); };
  const cancel = () => { cancelled.current = true; setEditing(null); };
  useCancelValueEdit(endpoint, cancel, editing);
  const finish = () => {
    if (!editing || cancelled.current) return;
    cancelled.current = true;
    const parsed = text.trim() ? Number(text) : NaN;
    if (Number.isFinite(parsed)) {
      if (editing === "jump") setJump(rangeValue(parsed, resolution, Math.max(resolution, hardMax - hardMin), resolution));
      else {
        const next = editing === "value" ? Math.max(low, Math.min(high, parsed))
          : rangeValue(parsed, editing === "min" ? hardMin : low, editing === "max" ? hardMax : high, resolution);
        if (editing === "min") { if (onMinimumChange) onMinimumChange(next); else setInterval(previous => ({ ...previous, min: next })); }
        else if (editing === "max") { if (onMaximumChange) onMaximumChange(next); else setInterval(previous => ({ ...previous, max: next })); }
        if (editing === "value" || value < next && editing === "min" || value > next && editing === "max") choose(next);
      }
    }
    setEditing(null);
  };
  const context = (which: Edit) => (event: React.MouseEvent) => { event.preventDefault(); event.stopPropagation(); if (!inputProps.disabled) edit(which); };
  const fraction = high === low ? .5 : Math.max(0, Math.min(1, (value - low) / (high - low)));
  return <span className="range-spectrum" data-range-control data-ui-control data-ui-native-tag="transparent" style={{ "--range-position": `${fraction * 100}%` } as CSSProperties}
    onWheel={event => {
      if (inputProps.disabled) return;
      if (onWheel) onWheel(event); else { event.preventDefault(); event.stopPropagation(); choose(rangeValue(value + (event.deltaY < 0 ? jump : -jump), low, high, resolution)); }
    }}>
    <button type="button" className="range-end range-end-min" disabled={inputProps.disabled} aria-label={`${label} minimum: ${low}`} title="Select minimum · right-click to edit" onClick={() => choose(low)} onContextMenu={context("min")}>
      <svg data-range-glyph viewBox="0 0 10 32" aria-hidden><path d="M5 3V29" /></svg><span>{low}</span>
    </button>
    <span className="range-axis">
      <button type="button" className="range-nudge range-nudge-left" disabled={inputProps.disabled} aria-label={`Decrease ${label} by ${jump}`} title={`Decrease by ${jump} · right-click to set jump`} onClick={() => choose(rangeValue(value - jump, low, high, resolution))} onContextMenu={context("jump")}>
        <svg data-range-glyph viewBox="0 0 16 32" aria-hidden><path d="M13 6L1 16L13 26" /></svg>
      </button>
      <span className="range-track">
        <span className="range-current" aria-hidden><i /><span>{value}</span></span>
        <input {...inputProps} ref={inputRef} type="range" min={low} max={high} value={value} className={`range-spectrum-input ${inputProps.className ?? ""}`} onChange={event => onValueChange(Number(event.currentTarget.value))} onContextMenu={context("value")} />
      </span>
      <button type="button" className="range-nudge range-nudge-right" disabled={inputProps.disabled} aria-label={`Increase ${label} by ${jump}`} title={`Increase by ${jump} · right-click to set jump`} onClick={() => choose(rangeValue(value + jump, low, high, resolution))} onContextMenu={context("jump")}>
        <svg data-range-glyph viewBox="0 0 16 32" aria-hidden><path d="M3 6L15 16L3 26" /></svg>
      </button>
    </span>
    <button type="button" className="range-end range-end-max" disabled={inputProps.disabled} aria-label={`${label} maximum: ${high}`} title="Select maximum · right-click to edit" onClick={() => choose(high)} onContextMenu={context("max")}>
      <svg data-range-glyph viewBox="0 0 10 32" aria-hidden><path d="M5 3V29" /></svg><span>{high}</span>
    </button>
    {editing && <input ref={endpoint} autoFocus className={`range-bound-editor range-edit-${editing}`} type="number" aria-label={`${label} ${editing === "min" ? "minimum" : editing === "max" ? "maximum" : editing}`} value={text}
      min={editing === "jump" ? resolution : editing === "min" ? hardMin : low} max={editing === "max" ? hardMax : editing === "jump" ? Math.max(resolution, hardMax - hardMin) : high} step={resolution}
      onFocus={event => event.currentTarget.select()} onChange={event => setText(event.currentTarget.value)} onBlur={finish}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); finish(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      }} />}
  </span>;
}
