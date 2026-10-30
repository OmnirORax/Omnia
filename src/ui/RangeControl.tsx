import {createValueScrub,type ValueScrub} from './valueScrub';
import type {StateSelectionMode} from '../properties/stateSelection';
import { cursorPosition } from './cursorPosition';
import { ContextualMasterController } from './ContextualMasterController';
import { useCancelValueEdit } from "./ActiveContext";
import { claimUIPress } from "./pointerOwnership";
import { rangeLabel,rangeValue,rangeSequence,sequenceIndex,sequenceAt,sequenceStep } from "./rangeMath";
import {useContextNavigation} from './ContextStage';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useMemo, useCallback, type CSSProperties, type InputHTMLAttributes, type Ref, type ReactNode, type MutableRefObject } from "react";

/** Layout adapters provide the displayed slider axis; captured once per drag. */
export const RangeAxis=createContext(0);
export type RangeGesture={start:(id:number,x:number,y:number)=>boolean;move:(x:number,y:number)=>void;finish:(x:number,y:number)=>void;cancel:()=>void};
/** An owning DOF icon may lend its press to this same slider gesture. */
export const RangeGestureTarget=createContext<MutableRefObject<RangeGesture|null>|null>(null);
type WorkingRange={min?:number;max?:number;step?:number;selectionMode?:StateSelectionMode;selectionCount?:number;selectionStep?:number;selectionMin?:number;selectionMax?:number};
const RangeSettings=createContext<{values:Record<string,WorkingRange>;change:(key:string,patch:WorkingRange)=>void}|null>(null);
/** Selection-mode preferences share the existing session property scope. */
export function useWorkingSelection(key:string,span:number,defaultMode:StateSelectionMode='symmetry',resolution=span/8){
 const scope=useContext(RangeSettings),[local,setLocal]=useState<WorkingRange>({});
 const saved=scope?.values[key]??local;
 const change=(patch:WorkingRange)=>{if(scope)scope.change(key,patch);else setLocal(before=>({...before,...patch}));};
 return {mode:saved.selectionMode??defaultMode,count:saved.selectionCount??8,step:saved.selectionStep??(resolution||span/8||1),min:saved.selectionMin,max:saved.selectionMax,
  clearLimits:()=>change({selectionMin:undefined,selectionMax:undefined}),
  minChange:(selectionMin:number)=>change({selectionMin}),maxChange:(selectionMax:number)=>change({selectionMax}),
  modeChange:(selectionMode:StateSelectionMode)=>change({selectionMode}),
  countChange:(selectionCount:number)=>change({selectionCount}),stepChange:(selectionStep:number)=>change({selectionStep})};
}
/** Direct manipulation borrows the same session rules without creating editors. */
export function useWorkingSelectionReader(){
 const scope=useContext(RangeSettings),current=useRef(scope?.values);current.current=scope?.values;
 return useCallback((key:string)=>{const saved=current.current?.[key];
  if(!saved||![saved.selectionMode,saved.selectionCount,saved.selectionStep,saved.selectionMin,saved.selectionMax].some(value=>value!==undefined))return;
  return {mode:saved.selectionMode??'symmetry',count:saved.selectionCount??8,step:saved.selectionStep??1,min:saved.selectionMin,max:saved.selectionMax};
 },[]);
}
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
  values?:readonly number[];
  onConfigure?:(which:Edit,duringGesture:boolean)=>boolean|void;
};
/** A shared slider presentation with track-wide dragging and native keyboard support.
 * Local working intervals and jump size never alter property validation bounds. */
export function RangeControl({ value: storedValue, min, max, onValueChange, onMinimumChange, onMaximumChange,
  hardMin = min, hardMax = max, inputRef, onValueCommit, onValueCancel, onWheel, configuration, configurationKey, values, onConfigure, ...inputProps }: Props) {
  const externalGesture=useContext(RangeGestureTarget),track=useRef<HTMLSpanElement>(null);
  const axisAngle=useContext(RangeAxis)*Math.PI/180;
  const value = Math.max(min, Math.min(max, storedValue));
  const resolution = Number(inputProps.step) || 1;
  const scope=useContext(RangeSettings),saved=configurationKey?scope?.values[configurationKey]:undefined;
  const [localInterval, setInterval] = useState({ min, max }), [localJump, setJump] = useState(resolution);
  const interval={min:saved?.min??localInterval.min,max:saved?.max??localInterval.max};
  const jump=Math.max(resolution,Math.min(saved?.step??localJump,Math.max(resolution,hardMax-hardMin)));
  const [popupPoint,setPopupPoint]=useState<{x:number;y:number}|null>(()=>configuration==='step'?cursorPosition():null);
  const [editing, setEditing] = useState<Edit | null>(configuration==='step'?'jump':null), [text, setText] = useState(configuration==='step'?String(jump):'');
  const low = onMinimumChange ? min : Math.min(value, Math.max(min, interval.min));
  const high = onMaximumChange ? max : Math.max(value, Math.min(max, interval.max));
  const sequence=useMemo(()=>values?rangeSequence(values,low,high):undefined,[values,low,high]);
  const valueDisabled=!!inputProps.disabled||sequence?.length===0;
  const endpoint = useRef<HTMLInputElement>(null), cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ id: number; scrub?:ValueScrub; cx:number;cy:number;ux:number;uy:number;width: number; low: number; high: number; step: number; values?:readonly number[]; before: number; next: number } | null>(null);
  const cancelDrag = () => {
    const active = drag.current;
    if (!active) return;
    drag.current = null;
    if (onValueCancel) onValueCancel(active.before); else onValueChange(active.before);
  };
  useCancelValueEdit(input, cancelDrag);
  useContextNavigation({owner:track,cancel:drag.current?cancelDrag:undefined});
  const cancelLatest = useRef(cancelDrag); cancelLatest.current = cancelDrag;
  useEffect(() => {
    const cancel = () => cancelLatest.current();
    window.addEventListener("blur", cancel);
    return () => { window.removeEventListener("blur", cancel); };
  }, []);
  const moveDrag = (clientX: number,clientY:number) => {
    const active = drag.current;
    if (!active) return;
    const fraction=((clientX-active.cx)*active.ux+(clientY-active.cy)*active.uy)/active.width+.5;
    const next=active.scrub?active.scrub.sample({x:clientX,y:clientY}):active.values?sequenceAt(active.values,fraction):rangeValue(active.low+fraction*(active.high-active.low),active.low,active.high,active.step);
    if(next===undefined)return;
    if (next !== active.next) { active.next = next; onValueChange(next); }
  };
  const startDrag=(id:number,x:number,y:number,relative=false)=>{
    const node=track.current;if(!node||valueDisabled||drag.current)return false;
    const bounds=node.getBoundingClientRect(),ux=Math.cos(axisAngle),uy=Math.sin(axisAngle);
    const projected=Math.abs(ux)*node.offsetWidth+Math.abs(uy)*node.offsetHeight;
    const scale=projected>0?bounds.width/projected:1,width=Math.max(1,node.offsetWidth*scale);
    const fraction=sequence?sequence.length<2?.5:sequenceIndex(sequence,value)/(sequence.length-1):high===low?.5:(value-low)/(high-low);
    drag.current={id,...(relative?{scrub:createValueScrub({origin:{x,y},width,value,min:low,max:high,step:jump,values:sequence})}:{}),cx:relative?x-(fraction-.5)*width*ux:bounds.left+bounds.width/2,cy:relative?y-(fraction-.5)*width*uy:bounds.top+bounds.height/2,ux,uy,width,low,high,step:jump,values:sequence,before:storedValue,next:value};
    claimUIPress(id);return true;
  };
  const finishDrag=(x:number,y:number)=>{if(!drag.current)return;moveDrag(x,y);const next=drag.current!.next;drag.current=null;onValueCommit?.(next);};
  const gestureAPI=useRef<RangeGesture>(null!);gestureAPI.current={start:(id,x,y)=>startDrag(id,x,y,true),move:moveDrag,finish:finishDrag,cancel:cancelDrag};
  useLayoutEffect(()=>{if(!externalGesture)return;const api:RangeGesture={start:(...args)=>gestureAPI.current.start(...args),move:(...args)=>gestureAPI.current.move(...args),finish:(...args)=>gestureAPI.current.finish(...args),cancel:()=>gestureAPI.current.cancel()};externalGesture.current=api;return()=>{if(externalGesture.current===api)externalGesture.current=null;};},[externalGesture]);
  const label = inputProps["aria-label"] ?? "Value";
  const edit = (which: Edit) => { const duringGesture=!!drag.current;if(drag.current){const active=drag.current;drag.current=null;onValueCommit?.(active.next);}else cancelDrag();if(onConfigure&&onConfigure(which,duringGesture)!==false)return;setPopupPoint(cursorPosition());cancelled.current = false; setText(String(which === "min" ? low : which === "max" ? high : which === "jump" ? jump : value)); setEditing(which); };
  const choose = (next: number|undefined) => { if(next===undefined||valueDisabled)return;onValueChange(next); onValueCommit?.(next); };
  const nudge=(direction:-1|1)=>choose(sequence?sequenceStep(sequence,value,direction):rangeValue(value+direction*jump,low,high,resolution));
  const cancel = () => { cancelled.current = true; setEditing(null); };
  useCancelValueEdit(endpoint, cancel, editing);
  const finish = () => {
    if (!editing || cancelled.current) return;
    cancelled.current = true;
    const parsed = text.trim() ? Number(text) : NaN;
    if (Number.isFinite(parsed)) {
      if(editing==='value'&&sequence&&!sequence.includes(parsed)){cancelled.current=false;endpoint.current?.setCustomValidity('Choose a generated value, or change its rule.');endpoint.current?.reportValidity();return;}
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
  const fraction = sequence?sequence.length<2?.5:sequenceIndex(sequence,value)/(sequence.length-1):high===low?.5:Math.max(0,Math.min(1,(value-low)/(high-low)));
  return <span className="range-spectrum" data-range-control data-ui-control data-ui-popup-boundary data-ui-native-tag="transparent" style={{ "--range-position": `${fraction * 100}%` } as CSSProperties}
    onWheel={event => {
      if (valueDisabled) return;
      if (onWheel) onWheel(event); else { event.preventDefault(); event.stopPropagation(); nudge(event.deltaY<0?1:-1); }
    }}>
    <button type="button" className="range-end range-end-min" disabled={inputProps.disabled} aria-label={`${label} minimum: ${low}`} title={sequence?"First generated value · right-click edits lower limit":"Select minimum · right-click to edit"} onClick={() => choose(sequence?sequence[0]:low)} onContextMenu={context("min")}>
      <svg data-range-glyph viewBox="0 0 10 32" aria-hidden><path d="M5 3V29" /></svg><span title={String(low)}>{rangeLabel(low)}</span>
    </button>
    <span className="range-axis">
      <button type="button" className="range-nudge range-nudge-left" disabled={valueDisabled} aria-label={`Decrease ${label}`} title={sequence?"Previous value · right-click configures rule":`Decrease by ${jump} · right-click to set jump`} onClick={()=>nudge(-1)} onContextMenu={context("jump")}>
        <svg data-range-glyph viewBox="0 0 16 32" aria-hidden><path d="M13 6L1 16L13 26" /></svg>
      </button>
      <span ref={track} className="range-track" title={`${label}: ${value}`}
        onPointerDown={event => {
          if (event.button !== 0 || valueDisabled || drag.current) return;
          event.preventDefault(); event.stopPropagation();
          claimUIPress(event.pointerId, event.pointerType, event.buttons);
          input.current?.focus({ preventScroll: true });
          startDrag(event.pointerId,event.clientX,event.clientY);
          event.currentTarget.setPointerCapture(event.pointerId);
          moveDrag(event.clientX,event.clientY);
        }}
        onPointerMove={event => {
          if (drag.current?.id !== event.pointerId) return;
          event.stopPropagation(); moveDrag(event.clientX,event.clientY);
        }}
        onPointerUp={event => {
          if (drag.current?.id !== event.pointerId) return;
          event.stopPropagation(); moveDrag(event.clientX,event.clientY);
          const next = drag.current!.next; drag.current = null;
          onValueCommit?.(next);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}
        onClick={event => { event.preventDefault(); event.stopPropagation(); }}>

        <span className="range-current" aria-hidden><i /><span title={String(value)}>{rangeLabel(value)}</span></span>
        <input {...inputProps} ref={node => {
          input.current = node;
          if (typeof inputRef === "function") inputRef(node); else if (inputRef) inputRef.current = node;
        }} type="range" aria-valuetext={sequence?String(value):inputProps["aria-valuetext"]} disabled={valueDisabled} min={sequence?0:low} max={sequence?Math.max(0,sequence.length-1):high} step={sequence?1:jump} value={sequence?Math.max(0,sequenceIndex(sequence,value)):value} className={`range-spectrum-input ${inputProps.className ?? ""}`} onChange={event=>{const n=Number(event.currentTarget.value);if(sequence)choose(sequence[n]);else onValueChange(n);}} onContextMenu={context("value")} />
      </span>
      <button type="button" className="range-nudge range-nudge-right" disabled={valueDisabled} aria-label={`Increase ${label}`} title={sequence?"Next value · right-click configures rule":`Increase by ${jump} · right-click to set jump`} onClick={()=>nudge(1)} onContextMenu={context("jump")}>
        <svg data-range-glyph viewBox="0 0 16 32" aria-hidden><path d="M3 6L15 16L3 26" /></svg>
      </button>
    </span>
    <button type="button" className="range-end range-end-max" disabled={inputProps.disabled} aria-label={`${label} maximum: ${high}`} title={sequence?"Last generated value · right-click edits upper limit":"Select maximum · right-click to edit"} onClick={() => choose(sequence?sequence.at(-1):high)} onContextMenu={context("max")}>
      <svg data-range-glyph viewBox="0 0 10 32" aria-hidden><path d="M5 3V29" /></svg><span title={String(high)}>{rangeLabel(high)}</span>
    </button>
    {editing && <ContextualMasterController title={`${label} ${editing}`} position={popupPoint} onClose={cancel} onAdvance={finish} onConfirm={finish} onWheel={event=>event.stopPropagation()}><input ref={endpoint} autoFocus className={`range-bound-editor range-edit-${editing}`} type="number" aria-label={`${label} ${editing === "min" ? "minimum" : editing === "max" ? "maximum" : editing}`} value={text}
      min={editing === "jump" ? resolution : editing === "min" ? hardMin : low} max={editing === "max" ? hardMax : editing === "jump" ? Math.max(resolution, hardMax - hardMin) : high} step={resolution}
      onFocus={event => event.currentTarget.select()} onChange={event=>{event.currentTarget.setCustomValidity("");setText(event.currentTarget.value);}} onBlur={finish}
      onKeyDown={event => {
        if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); finish(); }
        if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancel(); }
      }} /></ContextualMasterController>}
  </span>;
}
