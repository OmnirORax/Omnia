import { transientReveal, type RevealSession } from './transientReveal';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "./context";
import { normalizeSearch } from "./FrameSearch";
import { globalControls, globalSearchRank, locateSearchResult, type GlobalResult, type SearchReveal } from "./search";
import { useAppearance } from '../appearance/Context';
import { functionShortcutBinding } from "../workspaceActions";
import { ShortcutHint } from "./ShortcutHint";

export type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
  onPreview: (reveal: SearchReveal | null) => void;
  onKeep: (reveal: SearchReveal) => void;
};
const focusable = (element: HTMLElement) => element.matches("button,input,select,textarea,a,[contenteditable=true]") ? element : element.querySelector<HTMLElement>("input,select,textarea,button,a,[contenteditable=true]");
type Point = { x: number; y: number };
export function GlobalSearch(props: GlobalSearchProps) {
  const cursor = useRef<Point>({ x: innerWidth / 2, y: innerHeight / 3 });
  useEffect(() => {
    const track = (event: PointerEvent) => { cursor.current = { x: event.clientX, y: event.clientY }; };
    document.addEventListener("pointermove", track, true); document.addEventListener("pointerdown", track, true);
    return () => { document.removeEventListener("pointermove", track, true); document.removeEventListener("pointerdown", track, true); };
  }, []);
  return props.open ? <SearchSession {...props} origin={cursor.current} /> : null;
}
function SearchSession({ onClose, onPreview, onKeep, origin }: GlobalSearchProps & { origin: Point }) {
  const ui = useUI(), appearance=useAppearance(),id = useId();
  const appearanceRef=useRef(appearance);appearanceRef.current=appearance;
  const callbacks = useRef({ onClose, onPreview, onKeep }); callbacks.current = { onClose, onPreview, onKeep };
  // A stable index prevents hover revelation from reordering the list under the pointer.
  const [index] = useState(() => globalControls(ui,appearance?.targets));
  const [query, setQuery] = useState(""), [active, setActive] = useState(-1), [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null), popup = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(origin), [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointer: number; offset: Point } | null>(null);
  const clamp = (point: Point) => {
    const bounds = popup.current?.getBoundingClientRect();
    return { x: Math.max(8, Math.min(point.x, innerWidth - (bounds?.width ?? 420) - 8)), y: Math.max(8, Math.min(point.y, innerHeight - (bounds?.height ?? 300) - 8)) };
  };
  useLayoutEffect(() => {
    const fit = () => setPosition(point => { const next = clamp(point); return next.x === point.x && next.y === point.y ? point : next; });
    const observer = new ResizeObserver(fit);
    if (popup.current) observer.observe(popup.current);
    window.addEventListener("resize", fit); fit();
    return () => { observer.disconnect(); window.removeEventListener("resize", fit); };
  }, []);
  const revealSession = useRef<RevealSession | null>(null);
  const tokens = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(result => tokens.every(token => normalizeSearch(`${result.heading} ${result.label} ${functionShortcutBinding(result.functionId, ui.shortcutBindings)}`).includes(token)))
    .sort((a, b) => globalSearchRank(a, query) - globalSearchRank(b, query));
  const visible = matches.slice(0, 100);
  const groups = useMemo(() => {
    const grouped = new Map<string, { result: GlobalResult; position: number }[]>();
    visible.forEach((result, position) => grouped.set(result.heading, [...(grouped.get(result.heading) ?? []), { result, position }]));
    return [...grouped];
  }, [visible]);
  const stopPreview = () => { revealSession.current?.stop(); revealSession.current = null; appearanceRef.current?.locate(null); };
  const close = () => { stopPreview(); callbacks.current.onClose(); };
  useEffect(() => {
    input.current?.focus();
    const outside = (event: PointerEvent) => { if (!popup.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); }
    };
    document.addEventListener("pointerdown", outside, true); window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true); window.removeEventListener("keydown", key, true);
      revealSession.current?.stop(); appearanceRef.current?.locate(null); callbacks.current.onPreview(null);
    };
  }, []);
  const preview = (result: GlobalResult, position: number, ready?: (element: HTMLElement | undefined) => void) => {
    stopPreview(); setActive(position); setNotice("");
    if(result.appearance)appearanceRef.current?.locate(result.appearance);
    revealSession.current = transientReveal({path:result.path,locate:()=>locateSearchResult(result),reveal:path=>callbacks.current.onPreview(path?{path}:null),onReady:element=>ready?.(element),onMissing:()=>{
      setNotice(result.available ? "This control needs its relevant context or option enabled." : "Select the relevant node or relationship to use this control.");ready?.(undefined);
    }});
  };

  const choose = (result: GlobalResult, position: number, navigate: boolean) => {
    if (result.container) {
      stopPreview(); callbacks.current.onKeep({ path: result.path }); callbacks.current.onClose(); return;
    }
    preview(result, position, element => {
      const fn = ui.functions.find(fn => fn.id === result.functionId);
      const target = element ? focusable(element) : null;
      if (!target || !result.available) return;
      if (!navigate && target.matches('input[type="checkbox"],input[type="radio"]')) {
        stopPreview(); target.click(); return;
      }
      if (navigate || fn?.control || target.matches("input,select,textarea,[contenteditable=true]")) {
        // Keep only expansion state; discard transient scroll/z-order/decoration.
        if(result.appearance)appearanceRef.current?.locate(result.appearance,true);
        revealSession.current?.stop(true); revealSession.current = null;
        callbacks.current.onKeep({ path: result.path }); callbacks.current.onClose();
        requestAnimationFrame(() => {
          const actual = locateSearchResult(result), control = actual ? focusable(actual) : null;
          if (fn?.control && control?.matches("button")) control.click();
          else control?.focus({ preventScroll: true });
          actual?.classList.add("ui-search-found"); setTimeout(() => actual?.classList.remove("ui-search-found"), 1800);
        });
      } else {
        stopPreview();
        if (target instanceof HTMLButtonElement && (target.disabled || target.getAttribute("aria-disabled") === "true")) return;
        target.click();
      }
    });
  };
  return createPortal(<div ref={popup} className={`ui-frame-search-popup ui-global-search ${dragging ? "is-moving" : ""}`} style={{ left: position.x, top: position.y }} data-ui-resident-root="window:global-ui-search" data-ui-search role="dialog" aria-label="Global UI search" onPointerDown={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); const position = (active + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % Math.max(1, visible.length);
      if (visible[position]) { preview(visible[position], position); document.getElementById(`${id}-${position}`)?.scrollIntoView({ block: "nearest" }); }
    }
    if (event.key === "Enter" && visible[active < 0 ? 0 : active]) { event.preventDefault(); const position = active < 0 ? 0 : active; choose(visible[position], position, event.shiftKey); }
  }}>
    <header title={ui.canMove("window:global-ui-search") ? "Drag to move search" : ""} data-ui-movable={ui.canMove("window:global-ui-search")} onPointerDown={event => {
      if (event.button !== 0 || !ui.canMove("window:global-ui-search") || (event.target as Element).closest("button")) return;
      event.preventDefault(); event.stopPropagation(); stopPreview();
      drag.current = { pointer: event.pointerId, offset: { x: event.clientX - position.x, y: event.clientY - position.y } };
      event.currentTarget.setPointerCapture(event.pointerId); setDragging(true);
    }} onPointerMove={event => {
      if (drag.current?.pointer !== event.pointerId) return;
      setPosition(clamp({ x: event.clientX - drag.current.offset.x, y: event.clientY - drag.current.offset.y }));
    }} onPointerUp={event => {
      if (drag.current?.pointer !== event.pointerId) return;
      drag.current = null; setDragging(false); event.currentTarget.releasePointerCapture(event.pointerId);
    }} onPointerCancel={() => { drag.current = null; setDragging(false); }} onLostPointerCapture={() => { drag.current = null; setDragging(false); }}><strong>Search UI</strong><button aria-label="Close global UI search" onClick={close}>×</button></header>
    <input ref={input} type="search" aria-label="Search all UI controls" placeholder="Find a function or setting…" value={query} onChange={event => { stopPreview(); setQuery(event.target.value); setActive(-1); setNotice(""); }} role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={active >= 0 && visible[active] ? `${id}-${active}` : undefined} />
    <div id={id} className="ui-frame-search-results" role="listbox" aria-label="Global UI results" onMouseLeave={stopPreview}>
      {groups.map(([heading, entries]) => <section key={heading} role="group" aria-label={heading}><h3>{heading}</h3>{entries.map(({ result, position }) => <button key={result.key} id={`${id}-${position}`} role="option" aria-selected={position === active} aria-disabled={!result.available || undefined} title="Hover to reveal · click to use · right-click to go there" onMouseEnter={() => preview(result, position)} onMouseLeave={stopPreview} onPointerDown={event => event.preventDefault()} onClick={() => choose(result, position, false)} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); choose(result, position, true); }}><span>{result.label}<ShortcutHint binding={functionShortcutBinding(result.functionId, ui.shortcutBindings)} /></span>{!result.available && <small>Needs a selected node or relationship</small>}</button>)}</section>)}
    </div>
    <small role="status">{notice || (matches.length ? `${matches.length} results${matches.length > 100 ? " · first 100 shown" : ""}` : "No matching UI controls.")}</small>
    <small>Hover: reveal · Left-click: use · Right-click: go there</small>
  </div>, document.body);
}
