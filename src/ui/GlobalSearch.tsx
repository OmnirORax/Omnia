import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useUI } from "./context";
import { normalizeSearch, rootFor } from "./FrameSearch";
import { globalControls, locateSearchResult, type GlobalResult, type SearchReveal } from "./search";

export type GlobalSearchProps = {
  open: boolean;
  onClose: () => void;
  onPreview: (reveal: SearchReveal | null) => void;
  onKeep: (reveal: SearchReveal) => void;
};
const focusable = (element: HTMLElement) => element.matches("button,input,select,textarea,a,[contenteditable=true]") ? element : element.querySelector<HTMLElement>("input,select,textarea,button,a,[contenteditable=true]");
export function GlobalSearch(props: GlobalSearchProps) {
  return props.open ? <SearchSession {...props} /> : null;
}
function SearchSession({ onClose, onPreview, onKeep }: GlobalSearchProps) {
  const ui = useUI(), id = useId();
  const callbacks = useRef({ onClose, onPreview, onKeep }); callbacks.current = { onClose, onPreview, onKeep };
  // A stable index prevents hover revelation from reordering the list under the pointer.
  const [index] = useState(() => globalControls(ui));
  const [query, setQuery] = useState(""), [active, setActive] = useState(-1), [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null), popup = useRef<HTMLDivElement>(null);
  const restore = useRef<(keep?: boolean) => void>(() => {}), restoreFrame = useRef(0), locating = useRef(0);
  const tokens = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  const matches = index.filter(result => tokens.every(token => normalizeSearch(`${result.heading} ${result.label}`).includes(token)));
  const visible = matches.slice(0, 100);
  const groups = useMemo(() => {
    const grouped = new Map<string, { result: GlobalResult; position: number }[]>();
    visible.forEach((result, position) => grouped.set(result.heading, [...(grouped.get(result.heading) ?? []), { result, position }]));
    return [...grouped];
  }, [visible]);
  const stopPreview = () => { cancelAnimationFrame(locating.current); restore.current(); restore.current = () => {}; callbacks.current.onPreview(null); };
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
      cancelAnimationFrame(locating.current); restore.current(); callbacks.current.onPreview(null);
    };
  }, []);
  const preview = (result: GlobalResult, position: number, ready?: (element: HTMLElement | undefined) => void) => {
    stopPreview(); cancelAnimationFrame(restoreFrame.current); setActive(position); setNotice("");
    const scroll = new Map<Element, { left: number; top: number }>();
    document.querySelectorAll<HTMLElement>(".sidebar,.floating-window-content,.ui-panel-body,[data-ui-drop-zone]").forEach(element => scroll.set(element, { left: element.scrollLeft, top: element.scrollTop }));
    const details: HTMLDetailsElement[] = [], raised = new Map<HTMLElement, string>();
    let found: HTMLElement | undefined, attempts = 0;
    const resetScroll = () => { for (const [element, point] of scroll) if (element.isConnected) { element.scrollLeft = point.left; element.scrollTop = point.top; } };
    restore.current = (keep = false) => {
      found?.classList.remove("ui-search-pulsing");
      for (const [element, z] of raised) element.style.zIndex = z;
      if (!keep) {
        details.forEach(element => { if (element.isConnected) element.open = false; });
        resetScroll(); restoreFrame.current = requestAnimationFrame(resetScroll);
      }
    };
    callbacks.current.onPreview({ path: result.path });
    const locate = () => {
      found = locateSearchResult(result);
      if (found) {
        let parent: HTMLElement | null = found;
        while (parent) {
          if (!scroll.has(parent)) scroll.set(parent, { left: parent.scrollLeft, top: parent.scrollTop });
          if (parent instanceof HTMLDetailsElement && !parent.open) { details.push(parent); parent.open = true; }
          if (parent.classList.contains("floating-window") && !raised.has(parent)) { raised.set(parent, parent.style.zIndex); parent.style.zIndex = "35000"; }
          parent = parent.parentElement;
        }
      }
      if (!found?.getClientRects().length) {
        if (++attempts < 20) { locating.current = requestAnimationFrame(locate); return; }
        const home = rootFor(result.home);
        home?.classList.add("ui-search-pulsing");
        const reset = restore.current; restore.current = keep => { home?.classList.remove("ui-search-pulsing"); reset(keep); };
        setNotice(result.available ? "This control needs its relevant context or option enabled." : "Select the relevant node or relationship to use this control.");
        ready?.(undefined); return;
      }
      found.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
      found.classList.add("ui-search-pulsing"); ready?.(found);
    };
    locating.current = requestAnimationFrame(locate);
  };
  const choose = (result: GlobalResult, position: number, navigate: boolean) => {
    preview(result, position, element => {
      const fn = ui.functions.find(fn => fn.id === result.functionId);
      const target = element ? focusable(element) : null;
      if (!target || !result.available) return;
      if (!navigate && target.matches('input[type="checkbox"],input[type="radio"]')) {
        stopPreview(); target.click(); return;
      }
      if (navigate || fn?.control || target.matches("input,select,textarea,[contenteditable=true]")) {
        // Keep only expansion state; discard transient scroll/z-order/decoration.
        cancelAnimationFrame(restoreFrame.current);
        restore.current(true); restore.current = () => {};
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
  return createPortal(<div ref={popup} className="ui-frame-search-popup ui-global-search" data-ui-search role="dialog" aria-label="Global UI search" onPointerDown={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }} onKeyDown={event => {
    event.stopPropagation();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); const position = (active + (event.key === "ArrowDown" ? 1 : -1) + visible.length) % Math.max(1, visible.length);
      if (visible[position]) { preview(visible[position], position); document.getElementById(`${id}-${position}`)?.scrollIntoView({ block: "nearest" }); }
    }
    if (event.key === "Enter" && visible[active < 0 ? 0 : active]) { event.preventDefault(); const position = active < 0 ? 0 : active; choose(visible[position], position, event.shiftKey); }
  }}>
    <header><strong>Search UI</strong><button aria-label="Close global UI search" onClick={close}>×</button></header>
    <input ref={input} type="search" aria-label="Search all UI controls" placeholder="Find a function or setting…" value={query} onChange={event => { stopPreview(); setQuery(event.target.value); setActive(-1); setNotice(""); }} role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={active >= 0 && visible[active] ? `${id}-${active}` : undefined} />
    <div id={id} className="ui-frame-search-results" role="listbox" aria-label="Global UI results" onMouseLeave={stopPreview}>
      {groups.map(([heading, entries]) => <section key={heading} role="group" aria-label={heading}><h3>{heading}</h3>{entries.map(({ result, position }) => <button key={result.key} id={`${id}-${position}`} role="option" aria-selected={position === active} aria-disabled={!result.available || undefined} title="Hover to reveal · click to use · right-click to go there" onMouseEnter={() => preview(result, position)} onMouseLeave={stopPreview} onPointerDown={event => event.preventDefault()} onClick={() => choose(result, position, false)} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); choose(result, position, true); }}><span>{result.label}</span>{!result.available && <small>Needs a selected node or relationship</small>}</button>)}</section>)}
    </div>
    <small role="status">{notice || (matches.length ? `${matches.length} results${matches.length > 100 ? " · first 100 shown" : ""}` : "No matching UI controls.")}</small>
    <small>Hover: reveal · Left-click: use · Right-click: go there</small>
  </div>, document.body);
}
