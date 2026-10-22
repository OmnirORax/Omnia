import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { VisualSelectionOverlay } from "./VisualSelectionOverlay";
import {
  boundaryCandidates, boundaryElement, boundaryFor, collectVisualParts, matchingVisualParts,
  partAt, resolveVisualSelection, selectorChrome,
  type SelectionBoundary, type SelectionRule, type SelectorMode, type VisualPart,
} from "./visualSelection";

type SelectionState = { boundary: SelectionBoundary | null; rules: SelectionRule[] };
type VisualSelection = SelectionState & { parts: VisualPart[]; properties: string[]; clear: () => void };
const Context = createContext<VisualSelection | null>(null);
export const useVisualSelection = () => useContext(Context);
const emptySelection = (): SelectionState => ({ boundary: null, rules: [] });
const signature = (rule: SelectionRule | null) => rule ? `${rule.include}:${rule.boundary.key}:${rule.role ?? ""}:${rule.part ?? ""}` : "";

/** Transient selection tool. Property editing remains in the existing master controller. */
export function VisualSelectionProvider({ children }: { children: ReactNode }) {
  const [history, setHistory] = useState<SelectionState[]>(() => [emptySelection()]);
  const selection = history.at(-1)!;
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<SelectorMode>("boundary");
  const [include, setInclude] = useState(true);
  const [catalog, setCatalog] = useState<VisualPart[]>([]);
  const [candidate, setCandidate] = useState<SelectionRule | null>(null);
  const [geometry, setGeometry] = useState(0);
  const point = useRef<{ x: number; y: number; element: Element } | null>(null);
  const depth = useRef(0), candidateRef = useRef<SelectionRule | null>(null);
  const latest = useRef({ position, mode, include, catalog, selection });
  latest.current = { position, mode, include, catalog, selection };
  const setPreview = (next: SelectionRule | null) => {
    if (signature(next) === signature(candidateRef.current)) return;
    candidateRef.current = next; setCandidate(next);
  };
  const previewAt = (element: Element, x: number, y: number) => {
    const current = latest.current;
    point.current = { element, x, y };
    if (element.closest(selectorChrome)) return;
    const root = current.selection.boundary ? boundaryElement(current.selection.boundary) : document.body;
    if (current.mode === "boundary") {
      const options = boundaryCandidates(element).filter(boundary => current.include || !!root?.contains(boundary.element));
      const boundary = options[Math.min(depth.current, options.length - 1)];
      setPreview(boundary ? { boundary, include: current.include } : null);
      return;
    }
    if (!root?.contains(element)) { setPreview(null); return; }
    const part = partAt(current.catalog, element, x, y);
    setPreview(part ? { include: current.include, boundary: current.selection.boundary ?? boundaryFor(document.body),
      ...(current.mode === "pattern" ? { role: part.role } : { part: part.key }) } : null);
  };
  const clear = () => { setHistory([emptySelection()]); setPreview(null); setMode("boundary"); setInclude(true); depth.current = 0; };
  const close = () => { setPosition(null); setPreview(null); };
  const undo = () => { setHistory(previous => previous.length > 1 ? previous.slice(0, -1) : previous); setPreview(null); };
  const accept = () => {
    const rule = candidateRef.current;
    if (!rule) return;
    const freshBoundary = latest.current.mode === "boundary" && rule.include;
    setHistory(previous => [...previous, freshBoundary ? { boundary: rule.boundary, rules: [rule] } : {
      boundary: previous.at(-1)!.boundary ?? rule.boundary, rules: [...previous.at(-1)!.rules, rule],
    }]);
    if (latest.current.mode === "boundary") { setMode("item"); depth.current = 0; }
    setPreview(null);
  };
  const actions = useRef({ previewAt, close, clear, undo, accept });
  actions.current = { previewAt, close, clear, undo, accept };
  const selected = useMemo(() => resolveVisualSelection(catalog, selection.boundary, selection.rules), [catalog, selection]);
  const preview = useMemo(() => candidate ? matchingVisualParts(catalog, candidate) : [], [catalog, candidate]);
  const properties = useMemo(() => [...new Set(selected.flatMap(part => part.target.properties ?? []))], [selected]);

  useEffect(() => {
    let frame = 0, consumedUntil = 0;
    const outsideChrome = (event: Event) => event.target instanceof Element && !event.target.closest(selectorChrome);
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest("omnium-appearance-recovery")) return;
      if (event.button === 1) {
        event.preventDefault(); event.stopImmediatePropagation();
        setCatalog(collectVisualParts());
        setPosition({ x: event.clientX + 18, y: event.clientY + 18 });
        candidateRef.current = null; setCandidate(null);
        depth.current = 0;
        point.current = { element: event.target, x: event.clientX, y: event.clientY };
        return;
      }
      if (event.button === 0 && !latest.current.position) { consumedUntil = 0; return; }
      if (event.button === 2 && latest.current.position && outsideChrome(event)) {
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (event.button !== 0 || !latest.current.position || !outsideChrome(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      consumedUntil = performance.now() + 1000;
      actions.current.previewAt(event.target, event.clientX, event.clientY);
      actions.current.accept();
    };
    const preventClick = (event: MouseEvent) => {
      if (event.button === 1 || (performance.now() < consumedUntil && outsideChrome(event))) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const up = (event: PointerEvent) => {
      if (event.button === 0 && performance.now() < consumedUntil && outsideChrome(event)) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const move = (event: PointerEvent) => {
      if (!latest.current.position && latest.current.selection.rules.length && event.buttons) {
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; setGeometry(value => value + 1); });
        return;
      }
      if (!latest.current.position || !(event.target instanceof Element) || !outsideChrome(event)) return;
      point.current = { element: event.target, x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        const p = point.current;
        if (p && latest.current.position) actions.current.previewAt(p.element, p.x, p.y);
      });
    };
    const wheel = (event: WheelEvent) => {
      if (!latest.current.position || latest.current.mode !== "boundary" || !outsideChrome(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const p = point.current;
      if (!p) return;
      const count = boundaryCandidates(p.element).length;
      depth.current = Math.max(0, Math.min(count - 1, depth.current + (event.deltaY < 0 ? 1 : -1)));
      actions.current.previewAt(p.element, p.x, p.y);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (latest.current.position || latest.current.selection.rules.length)) {
        event.preventDefault(); event.stopPropagation();
        if (latest.current.position) actions.current.close(); else actions.current.clear();
      } else if (latest.current.position && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault(); event.stopImmediatePropagation(); actions.current.undo();
      }
    };
    const context = (event: MouseEvent) => {
      if (latest.current.position && outsideChrome(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const blur = () => actions.current.close();
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("mousedown", preventClick, true);
    window.addEventListener("click", preventClick, true);
    window.addEventListener("auxclick", preventClick, true);
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("keydown", key, true);
    window.addEventListener("contextmenu", context, true);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("mousedown", preventClick, true);
      window.removeEventListener("click", preventClick, true);
      window.removeEventListener("auxclick", preventClick, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("contextmenu", context, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const active = !!position || selection.rules.length > 0;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const refresh = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setCatalog(collectVisualParts()); setGeometry(value => value + 1); });
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest(selectorChrome))) refresh();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["class", "hidden", "open", "data-ui-native-hidden", "data-ui-native-icon", "data-ui-resident-root"] });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true); };
  }, [active]);
  useEffect(() => {
    if (!position) return;
    const p = point.current;
    if (p) actions.current.previewAt(p.element, p.x, p.y);
  }, [position, mode, include, catalog, selection, geometry]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-visual-selecting", !!position);
    return () => document.documentElement.removeAttribute("data-visual-selecting");
  }, [!!position]);
  const activate = (next: SelectorMode) => { depth.current = 0; setMode(current => current === next ? "item" : next); };
  const keyboard = (event: ReactKeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); action(); }
  };
  const left = Math.max(8, Math.min(position?.x ?? 8, innerWidth - 176));
  const top = Math.max(8, Math.min(position?.y ?? 8, innerHeight - 208));
  return <Context.Provider value={{ ...selection, parts: selected, properties, clear }}>
    {children}
    {active && createPortal(<VisualSelectionOverlay selected={selected} preview={preview} candidate={candidate} boundary={selection.boundary} />, document.body)}
    {position && createPortal(<div data-visual-selector className="visual-selector" role="dialog" aria-label="Visual selection controller"
      style={{ left, top }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
      <svg className="visual-selector-symbol" viewBox="0 0 256 248" aria-label="Boundary, include, exclude and pattern">
        <g role="button" tabIndex={0} aria-label="Boundary" aria-pressed={mode === "boundary"}
          onClick={() => activate("boundary")} onKeyDown={event => keyboard(event, () => activate("boundary"))}>
          <title>Boundary: choose an edge. Scroll while aiming to expand or narrow the boundary.</title>
          <circle className="selector-hit" cx="108" cy="108" r="88" fill="none" strokeWidth="32" />
          <circle className="selector-ring" cx="108" cy="108" r="88" fill="none" strokeWidth="20" />
        </g>
        <g role="button" tabIndex={0} aria-label="Include" aria-pressed={include}
          onClick={() => setInclude(true)} onKeyDown={event => keyboard(event, () => setInclude(true))}>
          <title>Inner bar: include. Combine with the ring for everything inside an edge, or the dots for a pattern.</title>
          <rect className="selector-hit" x="139" y="86" width="58" height="44" />
          <path className="selector-bar" d="M143 108H197" strokeWidth="24" />
        </g>
        <g role="button" tabIndex={0} aria-label="Exclude" aria-pressed={!include}
          onClick={() => setInclude(false)} onKeyDown={event => keyboard(event, () => setInclude(false))}>
          <title>Outer bar: exclude individual parts, patterns or a contained area.</title>
          <rect className="selector-hit" x="201" y="86" width="51" height="44" />
          <path className="selector-bar" d="M201 108H248" strokeWidth="24" />
        </g>
        <g role="button" tabIndex={0} aria-label="Pattern" aria-pressed={mode === "pattern"}
          onClick={() => activate("pattern")} onKeyDown={event => keyboard(event, () => activate("pattern"))}>
          <title>Pattern: sample text, background, contour, icon or indicator; match that role inside the boundary.</title>
          <rect className="selector-hit" x="65" y="200" width="88" height="46" />
          <circle className="selector-dot" cx="91" cy="222" r="15" />
          <circle className="selector-dot" cx="127" cy="222" r="15" />
        </g>
      </svg>
      <div className="visual-selector-actions">
        <button type="button" aria-label="Undo selection operation" title="Undo selection operation (Ctrl+Z)" disabled={history.length < 2} onClick={undo}>↶</button>
        <output aria-label={`${selected.length} selected visual parts${candidate ? `; ${preview.length} preview matches` : ""}`}
          title={`${selected.length} selected visual parts${candidate ? ` · ${include ? "include" : "exclude"} ${preview.length} matches` : ""}`}>
          {selected.length}{candidate && <small> · {include ? "+" : "−"}{preview.length}</small>}
        </output>
        <button type="button" aria-label="Clear visual selection" title="Clear selection" onClick={clear}>×</button>
        <button type="button" aria-label="Finish selecting" title="Finish; keep selection. MB3 reopens; Escape clears." onClick={close}>✓</button>
      </div>
    </div>, document.body)}
  </Context.Provider>;
}
