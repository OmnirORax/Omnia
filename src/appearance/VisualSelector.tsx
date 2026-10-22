import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { claimUIPress } from "../ui/pointerOwnership";
import { VisualSelectionOverlay } from "./VisualSelectionOverlay";
import { SelectorSymbol, type SelectorConfiguration, type SelectorOperation, type SelectorRegion } from "./SelectorSymbol";
import { SelectorCursor } from "./SelectorCursor";
import { SelectionController } from "./SelectionController";
import { describeSelectedPart } from "./selectedParts";
import { selectedPartTarget } from "./selectionCoupling";
import { boxFromPoints, nextPatternMode, relativePoint, type Point, type PatternMode } from "./selectionGeometry";
import {
  boundaryCandidates, boundaryElement, boundaryFor, boundaryRect, collectVisualParts, matchingVisualParts,
  partAt, partPaint, pointInBoundary, resolveVisualSelection, selectionLineGuide, selectorChrome,
  type SelectionBoundary, type SelectionRule, type VisualPart, type VisualRole,
} from "./visualSelection";

type SelectionState = { boundary: SelectionBoundary | null; rules: SelectionRule[] };
type VisualSelection = SelectionState & { parts: VisualPart[]; properties: string[]; clear: () => void };
type Pick = { boundary: SelectionBoundary; rule: SelectionRule | null; setBoundary: boolean };
type Phase = "off" | "configure" | "aim" | "edit";
const Context = createContext<VisualSelection | null>(null);
export const useVisualSelection = () => useContext(Context);
const emptySelection = (): SelectionState => ({ boundary: null, rules: [] });
const noParts: VisualPart[] = [];
const ruleKey = (rule: SelectionRule | null) => rule ? `${rule.include}:${rule.boundary.key}:${rule.region ?? "inside"}:${rule.role ?? ""}:${rule.part ?? ""}:${JSON.stringify(rule.line ?? null)}` : "neutral";
const pickKey = (pick: Pick | null) => pick ? `${pick.setBoundary}:${pick.boundary.key}:${ruleKey(pick.rule)}` : "";
type Gesture = { id: number; start: Point; element: Element;
  mode: "boundary" | Exclude<PatternMode, "item" | "pattern">; sample?: VisualPart };
const roleNames: Record<VisualRole, string> = { text: "Text", background: "Backgrounds", contour: "Contours", icon: "Icons", indicator: "Indicators" };
const roleSymbols: Record<VisualRole, string> = { text: "T", background: "□", contour: "○", icon: "◆", indicator: "◉" };

/** Transient target selection; appearance editing stays in the existing master controller. */
export function VisualSelectionProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState(() => ({ states: [emptySelection()], index: 0 }));
  const selection = timeline.states[timeline.index];
  const [phase, setPhase] = useState<Phase>("off");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [configuration, setConfiguration] = useState<SelectorConfiguration>({ boundaryPicking: true, pattern: "pattern", patternRole: null,
    bounded: false, stopAtPaint: false, operation: null, region: null });
  const [catalog, setCatalog] = useState<VisualPart[]>([]);
  const [candidate, setCandidate] = useState<Pick | null>(null);
  const [geometry, setGeometry] = useState(0);
  const point = useRef<{ x: number; y: number; element: Element } | null>(null);
  const depth = useRef(0), candidateRef = useRef<Pick | null>(null);
  const selectedRef = useRef<VisualPart[]>([]);
  const gesture = useRef<Gesture | null>(null);
  const latest = useRef({ phase, configuration, catalog, selection });
  latest.current = { phase, configuration, catalog, selection };
  const hasSelection = () => !!latest.current.selection.boundary || selectedRef.current.length > 0;
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
    const drag = gesture.current;
    if (drag?.mode === "boundary" && Math.hypot(x - drag.start.x, y - drag.start.y) >= 4) {
      // Find an owner containing the whole marquee; retain its stable anchor.
      const options = boundaryCandidates(drag.element);
      const owner = options.find(option => {
        const rect = boundaryRect(option);
        return rect && drag.start.x >= rect.left && drag.start.x <= rect.right && drag.start.y >= rect.top && drag.start.y <= rect.bottom &&
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      }) ?? boundaryFor(document.body);
      const rect = boundaryRect(owner)!;
      const area = boxFromPoints(relativePoint(drag.start, rect), relativePoint({ x, y }, rect));
      const boundary = { ...owner, area, key: `${owner.key}:area:${JSON.stringify(area)}` };
      setPreview({ boundary, setBoundary: true, rule: config.operation ? {
        boundary, include: config.operation === "include", region: config.region ?? "inside",
      } : null });
      return;
    }
    if (!drag && element.closest(selectorChrome)) { setPreview(null); return; }
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
    if (!root || (!drag && (region === "outside" ? pointInBoundary(boundary, element, { x, y }) : !pointInBoundary(boundary, element, { x, y })))) { setPreview(null); return; }
    if (config.pattern === "axis" || config.pattern === "direction" || config.pattern === "position") {
      const box = boundaryRect(boundary)!;
      const start = drag?.start ?? { x, y };
      // A click supplies a vertical axis/upward ray or a precise 2px position.
      const end = drag && Math.hypot(x - start.x, y - start.y) >= 4 ? { x, y } :
        { x: start.x, y: start.y - (config.pattern === "position" ? 2 : 24) };
      const sample = config.patternRole ? partAt(current.catalog.filter(part => part.role === config.patternRole), drag?.element ?? element, start.x, start.y) :
        drag?.sample ?? partAt(current.catalog, element, start.x, start.y);
      if (config.stopAtPaint && !sample) { setPreview(null); return; }
      const paint = config.stopAtPaint && sample ? partPaint(sample) : undefined;
      setPreview({ boundary, setBoundary: false, rule: { include: config.operation === "include", boundary, region,
        ...(config.patternRole || paint !== undefined ? { role: config.patternRole ?? sample!.role } : {}),
        line: { mode: config.pattern, start: relativePoint(start, box), end: relativePoint(end, box), bounded: config.bounded,
          ...(paint !== undefined ? { stopAtPaint: paint } : {}) },
      } });
      return;
    }
    const part = partAt(current.catalog, element, x, y);
    setPreview(part ? { boundary, setBoundary: false, rule: { include: config.operation === "include", boundary, region,
      ...(config.pattern === "pattern" ? { role: config.patternRole ?? part.role } : { part: part.key }) } } : null);
  };
  const clear = () => { gesture.current = null; record(current => current.boundary || current.rules.length ? emptySelection() : current); setPreview(null); };
  const close = () => { gesture.current = null; setPhase("off"); setPreview(null); };
  const disable = () => { close(); clear(); };
  const undo = () => { gesture.current = null; setTimeline(previous => ({ ...previous, index: Math.max(0, previous.index - 1) })); setPreview(null); };
  const redo = () => { gesture.current = null; setTimeline(previous => ({ ...previous, index: Math.min(previous.states.length - 1, previous.index + 1) })); setPreview(null); };
  const aim = () => { setPreview(null); setPhase("aim"); };
  const edit = (x: number, y: number) => {
    if (!hasSelection()) return;
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
      // Placement fixes the anchor. Re-arm the ring to replace it deliberately.
      setConfiguration(config => ({ ...config, boundaryPicking: false }));
    } else if (pick.rule) append(pick.rule);
    setPreview(null);
  };
  const regionRule = (side: SelectorRegion, operation = latest.current.configuration.operation): SelectionRule | null => {
    const boundary = latest.current.selection.boundary;
    return boundary && side && operation ? { boundary, region: side, include: operation === "include" } : null;
  };
  const chooseRegion = (side: Exclude<SelectorRegion, null>) => {
    const next = latest.current.configuration.region === side ? null : side;
    const hasBoundary = !!latest.current.selection.boundary;
    setConfiguration(config => ({ ...config, region: next,
      ...(hasBoundary ? { boundaryPicking: false } : {}),
    }));
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
  const cyclePattern = () => {
    gesture.current = null; setPreview(null);
    setConfiguration(config => ({ ...config, boundaryPicking: false, pattern: nextPatternMode(config.pattern) }));
  };
  const actions = useRef({ previewAt, close, disable, undo, redo, accept, aim, edit, cyclePattern });
  actions.current = { previewAt, close, disable, undo, redo, accept, aim, edit, cyclePattern };
  const matches = useMemo(() => resolveVisualSelection(catalog, selection.boundary, selection.rules), [catalog, selection, geometry]);
  selectedRef.current = matches.included;
  const editableParts = useMemo(() => matches.included.flatMap(part => {
    const description = describeSelectedPart(part); return description ? [description] : [];
  }), [matches]);
  const preview = useMemo(() => {
    if (!candidate?.rule) return noParts;
    const existing = new Set((candidate.rule.include ? matches.included : matches.excluded).map(part => part.key));
    const changed = matchingVisualParts(catalog, candidate.rule).filter(part => !existing.has(part.key));
    return changed.length ? changed : noParts;
  }, [catalog, candidate, matches, geometry]);
  const guide = useMemo(() => candidate?.rule?.line ? selectionLineGuide(catalog, candidate.rule) : null, [catalog, candidate, geometry]);
  const guides = useMemo(() => selection.rules.flatMap((rule, index) => {
    const points = rule.line && selectionLineGuide(catalog, rule);
    return points ? [{ key: `${index}:${ruleKey(rule)}`, points, include: rule.include, direction: rule.line?.mode === "direction" }] : [];
  }), [catalog, selection.rules, geometry]);
  const patternGroups = useMemo(() => {
    const boundary = selection.boundary ?? boundaryFor(document.body);
    const parts = matchingVisualParts(catalog, { boundary, region: configuration.region ?? "inside", include: true });
    return (Object.keys(roleNames) as VisualRole[]).flatMap(role => {
      const peers = parts.filter(part => part.role === role);
      return peers.length ? [{ role, parts: peers }] : [];
    });
  }, [catalog, selection.boundary, configuration.region, geometry]);
  const properties = useMemo(() => [...new Set(editableParts.flatMap(part => selectedPartTarget(part).properties ?? []))], [editableParts]);

  useEffect(() => {
    let frame = 0, consumedUntil = 0;
    const outsideChrome = (event: Event) => event.target instanceof Element && !event.target.closest(selectorChrome);
    const down = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery")) return;
      if (event.button === 1) {
        gesture.current = null;
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
      if (event.button === 2 && outsideChrome(event) && hasSelection()) {
        gesture.current = null;
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
      const config = latest.current.configuration;
      const boundary = latest.current.selection.boundary;
      if (!config.boundaryPicking && boundary && ((config.region ?? "inside") === "inside" ?
        !pointInBoundary(boundary, event.target, { x: event.clientX, y: event.clientY }) :
        pointInBoundary(boundary, event.target, { x: event.clientX, y: event.clientY }))) {
        candidateRef.current = null; setCandidate(null); return;
      }
      if (config.boundaryPicking || config.pattern === "axis" || config.pattern === "direction" || config.pattern === "position") {
        gesture.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, element: event.target,
          mode: config.boundaryPicking ? "boundary" : config.pattern as Gesture["mode"],
          sample: partAt(latest.current.catalog, event.target, event.clientX, event.clientY) };
      }
      actions.current.previewAt(event.target, event.clientX, event.clientY);
      if (!gesture.current) actions.current.accept();
    };
    const preventClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
      if (event.button === 1 || (performance.now() < consumedUntil && outsideChrome(event))) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const up = (event: PointerEvent) => {
      if (gesture.current?.id === event.pointerId) {
        event.preventDefault(); event.stopImmediatePropagation();
        cancelAnimationFrame(frame); frame = 0;
        const hit = document.elementFromPoint(event.clientX, event.clientY);
        if (hit) {
          actions.current.previewAt(hit, event.clientX, event.clientY);
          actions.current.accept();
        }
        gesture.current = null;
        consumedUntil = performance.now() + 1000;
        return;
      }
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
      if (latest.current.phase !== "aim" || (!gesture.current && !outsideChrome(event))) return;
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
      } else if ((latest.current.phase === "aim" || latest.current.phase === "configure") && event.key.toLowerCase() === "e" &&
        !event.ctrlKey && !event.metaKey && !event.altKey && !(event.target instanceof Element && event.target.closest("input,textarea,select,[contenteditable=true]"))) {
        event.preventDefault(); event.stopImmediatePropagation(); actions.current.cyclePattern();
      } else if (latest.current.phase !== "off" && latest.current.phase !== "edit" && (event.ctrlKey || event.metaKey)) {
        const key = event.key.toLowerCase();
        if (key === "z" || key === "y") {
          event.preventDefault(); event.stopImmediatePropagation();
          if (key === "y" || event.shiftKey) actions.current.redo(); else actions.current.undo();
        }
      }
    };
    const context = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery") || !outsideChrome(event)) return;
      if (hasSelection()) {
        event.preventDefault(); event.stopImmediatePropagation();
        consumedUntil = 0;
        if (latest.current.phase !== "edit") {
          // Also support context-menu invocations without pointerdown (keyboard
          // and platform gestures). Never require hitting a selected glyph.
          const rect = event.target.getBoundingClientRect();
          const keyboard = event.button !== 2 && event.clientX === 0 && event.clientY === 0;
          actions.current.edit(keyboard ? rect.left + rect.width / 2 : event.clientX,
            keyboard ? rect.top + rect.height / 2 : event.clientY);
        }
      } else if (latest.current.phase !== "off") { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    // Native color pickers can blur the browser. Keep their editor mounted so
    // the normal preview/commit lifecycle can finish.
    const blur = () => { if (latest.current.phase !== "edit") actions.current.close(); };
    const hidden = () => { if (document.hidden) blur(); };
    const cancel = () => { gesture.current = null; candidateRef.current = null; setCandidate(null); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
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
      window.removeEventListener("pointercancel", cancel, true);
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
      candidate={preview.length || candidate?.setBoundary || guide ? candidate?.rule ?? null : null} guide={guide} guides={guides}
      hoverBoundary={candidate?.setBoundary ? candidate.boundary : null} boundary={selection.boundary} />, document.body)}
    {phase === "aim" && createPortal(<SelectorCursor configuration={configuration} initial={point.current ?? position} />, document.body)}
    {phase === "edit" && createPortal(<SelectionController parts={editableParts} position={position}
      onClose={close} onResume={aim} />, document.body)}
    {phase === "configure" && createPortal(<div data-visual-selector className="visual-selector" role="dialog" aria-label="Visual selection controller"
      style={{ left, top }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}
      onPointerLeave={event => { if (event.relatedTarget instanceof Element && !event.relatedTarget.closest(selectorChrome)) aim(); }}>
      <SelectorSymbol configuration={configuration} actions={{
        boundary: () => { depth.current = 0; setPreview(null); setConfiguration(config => ({ ...config,
          boundaryPicking: !config.boundaryPicking, ...(!config.boundaryPicking ? { region: null } : {}),
        })); },
        pattern: cyclePattern,
        operation: chooseOperation, region: chooseRegion, previewRegion,
      }} />
      {(configuration.pattern === "axis" || configuration.pattern === "direction" || configuration.pattern === "position") &&
        <div className="visual-selector-conditions">
          <button type="button" aria-label="Finite drag bounds" aria-pressed={configuration.bounded || configuration.pattern === "position"}
            disabled={configuration.pattern === "position"} title="Limit matching to the dragged segment. Axis and direction are unbounded by default; position is always finite."
            onClick={() => { setPreview(null); setConfiguration(config => ({ ...config, bounded: !config.bounded })); }}>↦↤</button>
          <button type="button" aria-label="Stop at color change" aria-pressed={configuration.stopAtPaint}
            title="Sample the starting part's color and role; stop independently in each direction at the first differently colored peer. Empty gaps do not stop it. Start on a painted part."
            onClick={() => { setPreview(null); setConfiguration(config => ({ ...config, stopAtPaint: !config.stopAtPaint })); }}>◐</button>
        </div>}
      <div className="visual-selector-actions">
        <button type="button" aria-label="Undo selection operation" title="Undo selection (Ctrl+Z)" disabled={timeline.index === 0} onClick={undo}>↶</button>
        <button type="button" aria-label="Redo selection operation" title="Redo selection (Ctrl+Shift+Z / Ctrl+Y)" disabled={timeline.index === timeline.states.length - 1} onClick={redo}>↷</button>
        <output aria-label={`${matches.included.length} included, ${matches.excluded.length} excluded visual parts${candidate?.rule ? `; ${preview.length} preview matches` : ""}`}
          title={`${matches.included.length} included · ${matches.excluded.length} excluded${candidate?.rule ? ` · ${candidate.rule.include ? "include" : "exclude"} ${preview.length} preview matches` : ""}`}>
          {matches.included.length}<small> / {matches.excluded.length}</small>
        </output>
        <button type="button" aria-label="Clear visual selection" title="Clear selection" onClick={clear}>×</button>
        <button type="button" aria-label="Edit selected appearance" title="Edit selected appearance" disabled={!selection.boundary && !editableParts.length}
          onClick={() => edit(position.x, position.y)}>☷</button>
        <button type="button" aria-label="Start aiming" title="Aim, or move outside the controller. MB3 configures again; Escape disables and clears." onClick={aim}>✓</button>
      </div>
      {configuration.pattern !== "item" && <details className="visual-selector-patterns">
        <summary title="Patterns in the working region. Choose a name to filter line matching; +/− includes/excludes the whole pattern.">⠒</summary>
        {patternGroups.map(group => <div key={group.role}>
          <button type="button" aria-pressed={configuration.patternRole === group.role}
            title={`${group.parts.length} parts. ${[...new Set(group.parts.map(part => part.target.label))].join(", ")}. Click to filter; click again for all patterns.`}
            onClick={() => { setPreview(null); setConfiguration(config => ({ ...config, patternRole: config.patternRole === group.role ? null : group.role })); }}>
            {roleSymbols[group.role]} {roleNames[group.role]} <small>{group.parts.length}</small>
          </button>
          {([true, false] as const).map(include => <button key={String(include)} type="button"
            aria-label={`${include ? "Include" : "Exclude"} ${roleNames[group.role]}`} title={`${include ? "Include" : "Exclude"} this pattern in the working region`}
            className={include ? "selector-pattern-include" : "selector-pattern-exclude"}
            onPointerEnter={() => setPreview({ boundary: selection.boundary ?? boundaryFor(document.body), setBoundary: false,
              rule: { boundary: selection.boundary ?? boundaryFor(document.body), region: configuration.region ?? "inside", role: group.role, include } })}
            onPointerLeave={() => setPreview(null)}
            onClick={() => { append({ boundary: selection.boundary ?? boundaryFor(document.body), region: configuration.region ?? "inside", role: group.role, include }); setPreview(null); }}>
            {include ? "+" : "−"}
          </button>)}
        </div>)}
      </details>}
    </div>, document.body)}
  </Context.Provider>;
}
