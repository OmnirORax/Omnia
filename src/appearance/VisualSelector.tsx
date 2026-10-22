import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { claimUIPress } from "../ui/pointerOwnership";
import { VisualSelectionOverlay } from "./VisualSelectionOverlay";
import { SelectorSymbol, type SelectorConfiguration, type SelectorOperation, type SelectorRegion } from "./SelectorSymbol";
import { SelectorCursor } from "./SelectorCursor";
import { SelectionController } from "./SelectionController";
import { describeSelectedPart } from "./selectedParts";
import { selectedPartTarget } from "./selectionCoupling";
import {
  boundaryCandidates, boundaryElement, boundaryFor, collectVisualParts, matchingVisualParts,
  partAt, resolveVisualSelection, selectorChrome,
  type SelectionBoundary, type SelectionRule, type VisualPart,
} from "./visualSelection";

type SelectionState = { boundary: SelectionBoundary | null; rules: SelectionRule[] };
type VisualSelection = SelectionState & { parts: VisualPart[]; properties: string[]; clear: () => void };
type Pick = { boundary: SelectionBoundary; rule: SelectionRule | null; setBoundary: boolean };
type Phase = "off" | "configure" | "aim" | "edit";
const Context = createContext<VisualSelection | null>(null);
export const useVisualSelection = () => useContext(Context);
const emptySelection = (): SelectionState => ({ boundary: null, rules: [] });
const ruleKey = (rule: SelectionRule | null) => rule ? `${rule.include}:${rule.boundary.key}:${rule.region ?? "inside"}:${rule.role ?? ""}:${rule.part ?? ""}` : "neutral";
const pickKey = (pick: Pick | null) => pick ? `${pick.setBoundary}:${pick.boundary.key}:${ruleKey(pick.rule)}` : "";

/** Transient target selection; appearance editing stays in the existing master controller. */
export function VisualSelectionProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState(() => ({ states: [emptySelection()], index: 0 }));
  const selection = timeline.states[timeline.index];
  const [phase, setPhase] = useState<Phase>("off");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [configuration, setConfiguration] = useState<SelectorConfiguration>({ boundaryPicking: true, pattern: false, operation: null, region: null });
  const [catalog, setCatalog] = useState<VisualPart[]>([]);
  const [candidate, setCandidate] = useState<Pick | null>(null);
  const [geometry, setGeometry] = useState(0);
  const point = useRef<{ x: number; y: number; element: Element } | null>(null);
  const depth = useRef(0), candidateRef = useRef<Pick | null>(null);
  const selectedRef = useRef<VisualPart[]>([]);
  const latest = useRef({ phase, configuration, catalog, selection });
  latest.current = { phase, configuration, catalog, selection };
  const setPreview = (next: Pick | null) => {
    if (pickKey(next) === pickKey(candidateRef.current)) return;
    candidateRef.current = next; setCandidate(next);
  };
  const record = (change: (current: SelectionState) => SelectionState) => setTimeline(previous => {
    const current = previous.states[previous.index], next = change(current);
    if (next === current) return previous;
    const states = [...previous.states.slice(0, previous.index + 1), next];
    return { states, index: states.length - 1 };
  });
  const append = (rule: SelectionRule) => record(current => ruleKey(current.rules.at(-1) ?? null) === ruleKey(rule) ? current : {
    boundary: current.boundary ?? rule.boundary, rules: [...current.rules, rule],
  });
  const previewAt = (element: Element, x: number, y: number) => {
    const current = latest.current, config = current.configuration;
    point.current = { element, x, y };
    if (element.closest(selectorChrome)) return;
    if (config.boundaryPicking) {
      const options = boundaryCandidates(element);
      const boundary = options[Math.min(depth.current, options.length - 1)];
      setPreview(boundary ? { boundary, setBoundary: true, rule: config.operation ? {
        boundary, include: config.operation === "include", region: config.region ?? "inside",
      } : null } : null);
      return;
    }
    if (!config.operation) { setPreview(null); return; }
    const boundary = current.selection.boundary ?? boundaryFor(document.body);
    const root = boundaryElement(boundary), region = config.region ?? "inside";
    if (!root || (region === "outside" ? root.contains(element) : !root.contains(element))) { setPreview(null); return; }
    const part = partAt(current.catalog, element, x, y);
    setPreview(part ? { boundary, setBoundary: false, rule: { include: config.operation === "include", boundary, region,
      ...(config.pattern ? { role: part.role } : { part: part.key }) } } : null);
  };
  const clear = () => { record(current => current.boundary || current.rules.length ? emptySelection() : current); setPreview(null); };
  const close = () => { setPhase("off"); setPreview(null); };
  const disable = () => { close(); clear(); };
  const undo = () => { setTimeline(previous => ({ ...previous, index: Math.max(0, previous.index - 1) })); setPreview(null); };
  const redo = () => { setTimeline(previous => ({ ...previous, index: Math.min(previous.states.length - 1, previous.index + 1) })); setPreview(null); };
  const aim = () => { setPreview(null); setPhase("aim"); };
  const edit = (x: number, y: number) => {
    if (!selectedRef.current.length) return;
    setPreview(null); setPosition({ x, y }); setPhase("edit");
  };
  const accept = () => {
    const pick = candidateRef.current;
    if (!pick) return;
    if (pick.setBoundary) {
      record(current => {
        const rules = pick.rule ? [pick.rule] : [];
        if (current.boundary?.key === pick.boundary.key && current.rules.length === rules.length &&
          ruleKey(current.rules[0] ?? null) === ruleKey(pick.rule)) return current;
        return { boundary: pick.boundary, rules };
      });
      // Boundary picking is deliberately latched. Only the ring turns it off.
    } else if (pick.rule) append(pick.rule);
    setPreview(null);
  };
  const regionRule = (side: SelectorRegion, operation = latest.current.configuration.operation): SelectionRule | null => {
    const boundary = latest.current.selection.boundary;
    return boundary && side && operation ? { boundary, region: side, include: operation === "include" } : null;
  };
  const chooseRegion = (side: Exclude<SelectorRegion, null>) => {
    const next = latest.current.configuration.region === side ? null : side;
    setConfiguration(config => ({ ...config, region: next }));
    const rule = regionRule(next);
    if (rule) append(rule);
    setPreview(null);
  };
  const chooseOperation = (operation: Exclude<SelectorOperation, null>) => {
    const next = latest.current.configuration.operation === operation ? null : operation;
    setConfiguration(config => ({ ...config, operation: next }));
    setPreview(null);
  };
  const previewRegion = (side: SelectorRegion) => {
    const rule = regionRule(side);
    setPreview(rule ? { boundary: rule.boundary, rule, setBoundary: false } : null);
  };
  const actions = useRef({ previewAt, close, disable, undo, redo, accept, aim, edit });
  actions.current = { previewAt, close, disable, undo, redo, accept, aim, edit };
  const matches = useMemo(() => resolveVisualSelection(catalog, selection.boundary, selection.rules), [catalog, selection]);
  selectedRef.current = matches.included;
  const editableParts = useMemo(() => matches.included.flatMap(part => {
    const description = describeSelectedPart(part); return description ? [description] : [];
  }), [matches]);
  const preview = useMemo(() => candidate?.rule ? matchingVisualParts(catalog, candidate.rule) : [], [catalog, candidate]);
  const properties = useMemo(() => [...new Set(editableParts.flatMap(part => selectedPartTarget(part).properties ?? []))], [editableParts]);

  useEffect(() => {
    let frame = 0, consumedUntil = 0;
    const outsideChrome = (event: Event) => event.target instanceof Element && !event.target.closest(selectorChrome);
    const overSelection = (event: MouseEvent) => event.target instanceof Element && selectedRef.current.some(part => {
      if (!part.element.contains(event.target as Element)) return false;
      if (!part.range) return true;
      return [...part.range.getClientRects()].some(rect => event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom);
    });
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery")) return;
      if (event.button === 1) {
        claimUIPress(event.pointerId, event.pointerType, event.buttons);
        event.preventDefault(); event.stopImmediatePropagation();
        setCatalog(collectVisualParts());
        setPosition({ x: event.clientX, y: event.clientY });
        setPhase("configure");
        candidateRef.current = null; setCandidate(null);
        depth.current = 0;
        point.current = { element: event.target, x: event.clientX, y: event.clientY };
        return;
      }
      if (event.button === 2 && outsideChrome(event) && overSelection(event)) {
        claimUIPress(event.pointerId, event.pointerType, event.buttons);
        event.preventDefault(); event.stopImmediatePropagation();
        consumedUntil = 0;
        actions.current.edit(event.clientX, event.clientY);
        return;
      }
      if (latest.current.phase === "edit") {
        if (!outsideChrome(event)) claimUIPress(event.pointerId, event.pointerType, event.buttons);
        if (outsideChrome(event) && event.button === 0) { consumedUntil = 0; actions.current.close(); }
        return;
      }
      if (latest.current.phase === "off") { consumedUntil = 0; return; }
      claimUIPress(event.pointerId, event.pointerType, event.buttons);
      if (!outsideChrome(event)) return;
      if (event.button === 2) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (event.button !== 0) return;
      event.preventDefault(); event.stopImmediatePropagation();
      consumedUntil = performance.now() + 1000;
      if (latest.current.phase === "configure") actions.current.aim();
      actions.current.previewAt(event.target, event.clientX, event.clientY);
      actions.current.accept();
    };
    const preventClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
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
      if (!(event.target instanceof Element)) return;
      point.current = { element: event.target, x: event.clientX, y: event.clientY };
      if (latest.current.phase === "off" && latest.current.selection.boundary && event.buttons) {
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; setGeometry(value => value + 1); });
        return;
      }
      if (latest.current.phase !== "aim" || !outsideChrome(event)) return;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        const p = point.current;
        if (p && latest.current.phase === "aim") actions.current.previewAt(p.element, p.x, p.y);
      });
    };
    const wheel = (event: WheelEvent) => {
      if (latest.current.phase !== "aim" || !latest.current.configuration.boundaryPicking || !outsideChrome(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const p = point.current;
      if (!p) return;
      depth.current = Math.max(0, Math.min(boundaryCandidates(p.element).length - 1, depth.current + (event.deltaY < 0 ? 1 : -1)));
      actions.current.previewAt(p.element, p.x, p.y);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && (latest.current.phase !== "off" || latest.current.selection.boundary)) {
        event.preventDefault(); event.stopPropagation(); actions.current.disable();
      } else if (latest.current.phase !== "off" && latest.current.phase !== "edit" && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault(); event.stopImmediatePropagation();
          if (key === "y" || event.shiftKey) actions.current.redo(); else actions.current.undo();
        }
      }
    };
    const context = (event: MouseEvent) => {
      if (latest.current.phase !== "off" && outsideChrome(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    // Native color pickers can blur the browser. Keep their editor mounted so
    // the normal preview/commit lifecycle can finish.
    const blur = () => { if (latest.current.phase !== "edit") actions.current.close(); };
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
  const active = phase !== "off" || !!selection.boundary;
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
    if (phase !== "aim") return;
    const p = point.current;
    if (p) {
      const hit = document.elementFromPoint(p.x, p.y);
      if (hit && !hit.closest(selectorChrome)) actions.current.previewAt(hit, p.x, p.y);
    }
  }, [phase, configuration, catalog, selection, geometry]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-visual-selecting", phase === "aim");
    return () => document.documentElement.removeAttribute("data-visual-selecting");
  }, [phase]);
  // Ring center, rather than the asymmetric SVG box, is centered on the MB3 point.
  const left = Math.max(8, Math.min(position.x - 92.125, innerWidth - 216));
  const top = Math.max(8, Math.min(position.y - 89.75, innerHeight - 220));
  return <Context.Provider value={{ ...selection, parts: matches.included, properties, clear }}>
    {children}
    {active && phase !== "edit" && createPortal(<VisualSelectionOverlay selected={matches.included} excluded={matches.excluded} preview={preview}
      candidate={candidate?.rule ?? null} hoverBoundary={candidate?.setBoundary ? candidate.boundary : null} boundary={selection.boundary} />, document.body)}
    {phase === "aim" && createPortal(<SelectorCursor configuration={configuration} initial={point.current ?? position} />, document.body)}
    {phase === "edit" && createPortal(<SelectionController parts={editableParts} position={position}
      onClose={close} onResume={aim} />, document.body)}
    {phase === "configure" && createPortal(<div data-visual-selector className="visual-selector" role="dialog" aria-label="Visual selection controller"
      style={{ left, top }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      onPointerLeave={event => { if (event.relatedTarget instanceof Element && !event.relatedTarget.closest(selectorChrome)) aim(); }}>
      <SelectorSymbol configuration={configuration} actions={{
        boundary: () => { depth.current = 0; setPreview(null); setConfiguration(config => ({ ...config, boundaryPicking: !config.boundaryPicking })); },
        pattern: () => { setPreview(null); setConfiguration(config => ({ ...config, pattern: !config.pattern })); },
        operation: chooseOperation, region: chooseRegion, previewRegion,
      }} />
      <div className="visual-selector-actions">
        <button type="button" aria-label="Undo selection operation" title="Undo selection (Ctrl+Z)" disabled={timeline.index === 0} onClick={undo}>↶</button>
        <button type="button" aria-label="Redo selection operation" title="Redo selection (Ctrl+Shift+Z / Ctrl+Y)" disabled={timeline.index === timeline.states.length - 1} onClick={redo}>↷</button>
        <output aria-label={`${matches.included.length} included, ${matches.excluded.length} excluded visual parts${candidate?.rule ? `; ${preview.length} preview matches` : ""}`}
          title={`${matches.included.length} included · ${matches.excluded.length} excluded${candidate?.rule ? ` · ${candidate.rule.include ? "include" : "exclude"} ${preview.length} preview matches` : ""}`}>
          {matches.included.length}<small> / {matches.excluded.length}</small>
        </output>
        <button type="button" aria-label="Clear visual selection" title="Clear selection" onClick={clear}>×</button>
        <button type="button" aria-label="Edit selected appearance" title="Edit selected appearance" disabled={!editableParts.length}
          onClick={() => edit(position.x, position.y)}>☷</button>
        <button type="button" aria-label="Start aiming" title="Aim, or move outside the controller. MB3 configures again; Escape disables and clears." onClick={aim}>✓</button>
      </div>
    </div>, document.body)}
  </Context.Provider>;
}
