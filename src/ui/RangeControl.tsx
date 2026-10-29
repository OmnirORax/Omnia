import { cursorPosition } from './cursorPosition';
import { ContextualMasterController } from './ContextualMasterController';
import { useCancelValueEdit } from "./ActiveContext";
import { claimUIPress } from "./pointerOwnership";
import { rangeValue } from "./rangeMath";
import { HalvingPicker } from "../properties/HalvingPicker";
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type InputHTMLAttributes, type Ref, type ReactNode } from "react";

type WorkingRange={min?:number;max?:number;step?:number};
const RangeSettings=createContext<{values:Record<string,WorkingRange>;change:(key:string,patch:WorkingRange)=>void}|null>(null);
/** Retain widget working intervals/steps for one editing session, independently
 * of target values. Portalled editors inherit the same scope automatically. */
export function RangeSettingsScope({children}:{children:ReactNode}) {
  const [values,setValues]=useState<Record<string,WorkingRange>>({});
  return <RangeSettings.Provider value={{values,change:(key,patch)=>setValues(previous=>({...previous,[key]:{...previous[key],...patch}}))}}>{children}</RangeSettings.Provider>;
}

type Edit = "min" | "max" | "value" | "jump";
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "min" | "max" | "onChange" | "onWheel" | "children"> & {
  value: number; min: number; max: number;
  onValueChange: (value: number) => void;
  onValueCommit?: (value: number) => void;
  onValueCancel?: (value: number) => void;
  onMinimumChange?: (value: number) => void;
  onMaximumChange?: (value: number) => void;
  hardMin?: number; hardMax?: number;
  inputRef?: Ref<HTMLInputElement>;
  onWheel?: (event: React.WheelEvent<HTMLElement>) => void;
  configuration?:'step';
  configurationKey?:string;
};
/** A shared slider presentation with track-wide dragging and native keyboard support.
 * Local working intervals and jump size never alter property validation bounds. */
export function RangeControl({ value: storedValue, min, max, onValueChange, onMinimumChange, onMaximumChange,
  hardMin = min, hardMax = max, inputRef, onValueCommit, onValueCancel, onWheel, configuration, configurationKey, ...inputProps }: Props) {
  const value = Math.max(min, Math.min(max, storedValue));
  const resolution = Number(inputProps.step) || 1;
  const scope=useContext(RangeSettings),saved=configurationKey?scope?.values[configurationKey]:undefined;
  const [localInterval, setInterval] = useState({ min, max }), [localJump, setJump] = useState(resolution);
  const interval={min:saved?.min??localInterval.min,max:saved?.max??localInterval.max};
  const jump=Math.max(resolution,Math.min(saved?.step??localJump,Math.max(resolution,hardMax-hardMin)));
  const [halving, setHalving] = useState(false);
  const [popupPoint,setPopupPoint]=useState<{x:number;y:number}|null>(()=>configuration==='step'?cursorPosition():null);
  const [editing, setEditing] = useState<Edit | null>(configuration==='step'?'jump':null), [text, setText] = useState(configuration==='step'?String(jump):'');
  const low = onMinimumChange ? min : Math.min(value, Math.max(min, interval.min));
  const high = onMaximumChange ? max : Math.max(value, Math.min(max, interval.max));
  const endpoint = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; left: number; width: number; low: number; high: number; step: number; before: number; next: number } | null>(null);
  const cancelDrag = () => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (onValueCancel) onValueCancel(active.before); else onValueChange(active.before);
  };
  useCancelValueEdit(input, cancelDrag);
  const cancelLatest = useRef(cancelDrag); cancelLatest.current = cancelDrag;
  useEffect(() => {
    const cancel = () => cancelLatest.current();
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("blur", cancel); };
  }, []);
  const moveDrag = (clientX: number) => {
    const active = drag.current;
    if (!active) return;
    const next = rangeValue(active.low + (clientX - active.left) / active.width * (active.high - active.low), active.low, active.high, active.step);
    if (next !== active.next) { active.next = next; onValueChange(next); }
  };
  const label = inputProps["aria-label"] ?? "Value";
  const edit = (which: Edit) => { setPopupPoint(cursorPosition());cancelled.current = false; setText(String(which === "min" ? low : which === "max" ? high : which === "jump" ? jump : value)); setEditing(which); };
  const choose = (next: number) => { onValueChange(next); onValueCommit?.(next); };
  const cancel = () => { cancelled.current = true; setEditing(null); };
  useCancelValueEdit(endpoint, cancel, editing);
  const finish = () => {
    if (!editing || cancelled.current) return;
    cancelled.current = true;
    const parsed = text.trim() ? Number(text) : NaN;
    if (Number.isFinite(parsed)) {
      if (editing === "jump") {const next=rangeValue(parsed, resolution, Math.max(resolution, hardMax - hardMin), resolution);setJump(next);if(configurationKey)scope?.change(configurationKey,{step:next});}
      else {
        const next = editing === "value" ? Math.max(low, Math.min(high, parsed))
          : rangeValue(parsed, editing === "min" ? hardMin : low, editing === "max" ? hardMax : high, resolution);
        if (editing === "min") { if (onMinimumChange) onMinimumChange(next); else {setInterval(previous => ({ ...previous, min: next }));if(configurationKey)scope?.change(configurationKey,{min:next});} }
        else if (editing === "max") { if (onMaximumChange) onMaximumChange(next); else {setInterval(previous => ({ ...previous, max: next }));if(configurationKey)scope?.change(configurationKey,{max:next});} }
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
      <span className="range-track"
        onPointerDown={event => {
          if (event.button !== 0 || inputProps.disabled || drag.current) return;
          event.preventDefault(); event.stopPropagation();
          claimUIPress(event.pointerId, event.pointerType, event.buttons);
          input.current?.focus({ preventScroll: true });
          const bounds = event.currentTarget.getBoundingClientRect();
          drag.current = { id: event.pointerId, left: bounds.left, width: Math.max(1, bounds.width), low, high, step: jump, before: value, next: value };
          event.currentTarget.setPointerCapture(event.pointerId);
          moveDrag(event.clientX);
        }}
        onPointerMove={event => {
          if (drag.current?.id !== event.pointerId) return;
          event.stopPropagation(); moveDrag(event.clientX);
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return;
          event.stopPropagation(); moveDrag(event.clientX);
          const next = drag.current!.next; drag.current = null;
          onValueCommit?.(next);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
        onClick={event => { event.preventDefault(); event.stopPropagation(); }}>

        <span className="range-current" aria-hidden><i /><span>{value}</span></span>
        <input {...inputProps} ref={node => {
          input.current = node;
          if (typeof inputRef === "function") inputRef(node); else if (inputRef) inputRef.current = node;
        }} type="range" min={low} max={high} step={jump} value={value} className={`range-spectrum-input ${inputProps.className ?? ""}`} onChange={event => onValueChange(Number(event.currentTarget.value))} onContextMenu={context("value")} />
      </span>
      <button type="button" className="range-nudge range-nudge-right" disabled={inputProps.disabled} aria-label={`Increase ${label} by ${jump}`} title={`Increase by ${jump} · right-click to set jump`} onClick={() => choose(rangeValue(value + jump, low, high, resolution))} onContextMenu={context("jump")}>
        <svg data-range-glyph viewBox="0 0 16 32" aria-hidden><path d="M3 6L15 16L3 26" /></svg>
      </button>
    </span>
    <button type="button" className="range-end range-end-max" disabled={inputProps.disabled} aria-label={`${label} maximum: ${high}`} title="Select maximum · right-click to edit" onClick={() => choose(high)} onContextMenu={context("max")}>
      <svg data-range-glyph viewBox="0 0 10 32" aria-hidden><path d="M5 3V29" /></svg><span>{high}</span>
    </button>
    <button type="button" className="range-halving" disabled={inputProps.disabled} title="Pick by repeated halving of the current interval" aria-label={`${label} halving`} onClick={() => {setPopupPoint(cursorPosition());setHalving(v => !v);}}>½</button>
    {halving && <ContextualMasterController title={`${label} halving`} position={popupPoint} onClose={()=>setHalving(false)} onWheel={event=>event.stopPropagation()}><HalvingPicker low={low} high={high} label={String(label)} onPick={next => { choose(rangeValue(next, low, high, resolution)); setHalving(false); }} /></ContextualMasterController>}
    {editing && <ContextualMasterController title={`${label} ${editing}`} position={popupPoint} onClose={cancel} onWheel={event=>event.stopPropagation()}><input ref={endpoint} autoFocus className={`range-bound-editor range-edit-${editing}`} type="number" aria-label={`${label} ${editing === "min" ? "minimum" : editing === "max" ? "maximum" : editing}`} value={text}
      min={editing === "jump" ? resolution : editing === "min" ? hardMin : low} max={editing === "max" ? hardMax : editing === "jump" ? Math.max(resolution, hardMax - hardMin) : high} step={resolution}
      onFocus={event => event.currentTarget.select()} onChange={event => setText(event.currentTarget.value)} onBlur={finish}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); finish(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      }} /></ContextualMasterController>}
  </span>;
}
