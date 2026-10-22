import { useCallback, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { claimUIPress } from "../ui/pointerOwnership";
import { cursorPosition } from "../ui/cursorPosition";
import { useFeatureActions } from "../ui/useFeatureActions";
import { clearRecordedShortcutPress, recordedShortcutTail } from "../featureActions";
import { VisualSelectionOverlay } from "./VisualSelectionOverlay";
import { SelectorSymbol, type SelectorConfiguration, type SelectorOperation } from "./SelectorSymbol";
import { SelectorCursor } from "./SelectorCursor";
import { SelectionController } from "./SelectionController";
import { describeSelectedPart } from "./selectedParts";
import { PROPERTY_REGISTRY } from "./registry";
import { resolvePropertyTarget } from "../properties/registry";
import { selectedPartTarget } from "./selectionCoupling";
import { nextPatternMode, relativePoint, toggleSelectionRegion, pathVertices, pathEdges, PATTERN_MODES, PATTERN_SYMBOLS,
  type Point, type PathCondition, type PatternMode, type SelectionSide } from "./selectionGeometry";
import {
  boundaryCandidates, boundaryFor, boundaryRect, collectVisualParts, matchingVisualParts,
  partAt, partPaint, resolveVisualSelection, selectionLineGuide, selectorChrome,
  type SelectionBoundary, type SelectionConstraint, type SelectionRule, type VisualPart, type VisualRole,
} from "./visualSelection";

type SelectionState = { boundary: SelectionBoundary | null; scope: SelectionConstraint | null; rules: SelectionRule[]; objects: string[] };
type VisualSelection = SelectionState & { parts: VisualPart[]; properties: string[]; clear: () => void; selectObject: (id: string) => void; inspectionKey: string };
type Pick = { rule: SelectionRule; definesScope: boolean };
type Phase = "off" | "configure" | "aim" | "edit";
type Gesture = { id: number; start: Point; element: Element; mode: PatternMode; include: boolean; points: Point[]; sample?: VisualPart };
const Context = createContext<VisualSelection | null>(null);
export const useVisualSelection = () => useContext(Context);
const emptySelection = (): SelectionState => ({ boundary: null, scope: null, rules: [], objects: [] });
const noParts: VisualPart[] = [];
const constraintKey = (rule: SelectionConstraint): string => `${rule.boundary.key}:${rule.region ?? ""}:${rule.contour ?? ""}:${rule.role ?? ""}:${rule.part ?? ""}:${JSON.stringify(rule.line ?? rule.path ?? null)}:${rule.geometryId ?? ""}:${rule.scope ? constraintKey(rule.scope) : ""}`;
const ruleKey = (rule: SelectionRule) => `${rule.include}:${constraintKey(rule)}`;
const roleNames: Record<VisualRole, string> = { text: "Text", background: "Backgrounds", contour: "Contours", icon: "Icons", indicator: "Indicators" };
const roleSymbols: Record<VisualRole, string> = { text: "T", background: "□", contour: "○", icon: "◆", indicator: "◉" };
const isLine = (mode: PatternMode) => mode === "axis" || mode === "direction" || mode === "position";
const isPath = (mode: PatternMode) => mode === "rectangle" || mode === "ellipse" || mode === "polygon" || mode === "freehand";

/** Geometry defines a working set; later include/exclude rules refine it. */
export function VisualSelectionProvider({ children, onInspect }: { children: ReactNode; onInspect?: (key: string) => void }) {
  const [timeline, setTimeline] = useState(() => ({ states: [emptySelection()], index: 0 }));
  const selection = timeline.states[timeline.index];
  const [phase, setPhase] = useState<Phase>("off");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [configuration, setConfiguration] = useState<SelectorConfiguration>({ contour: true, pattern: "pattern", patternRole: null,
    bounded: false, stopAtPaint: false, closed: false, operation: "include", region: null });
  const [catalog, setCatalog] = useState<VisualPart[]>([]);
  const [candidate, setCandidate] = useState<Pick | null>(null);
  const [geometry, setGeometry] = useState(0);
  const [inspectionRequest, requestInspection] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const point = useRef<{ x: number; y: number; element: Element } | null>(null);
  const depth = useRef(0), candidateRef = useRef<Pick | null>(null), geometrySequence = useRef(0);
  const selectedRef = useRef<VisualPart[]>([]), gesture = useRef<Gesture | null>(null);
  const polygon = useRef<Gesture | null>(null);
  const latest = useRef({ phase, configuration, catalog, selection });
  latest.current = { phase, configuration, catalog, selection };
  const hasSelection = () => !!latest.current.selection.boundary || !!latest.current.selection.objects.length || selectedRef.current.length > 0;
  const setPreview = useCallback((next: Pick | null) => {
    const previous = candidateRef.current;
    if (previous === next || previous && next && previous.definesScope === next.definesScope && ruleKey(previous.rule) === ruleKey(next.rule)) return;
    candidateRef.current = next; setCandidate(next);
  }, []);
  const record = useCallback((change: (current: SelectionState) => SelectionState) => setTimeline(previous => {
    const current = previous.states[previous.index], next = change(current);
    if (next === current) return previous;
    const states = [...previous.states.slice(0, previous.index + 1), next];
    return { states, index: states.length - 1 };
  }), []);
  const cancelDrawing = () => { gesture.current = null; polygon.current = null; setDrawing(false); setPreview(null); };
  const append = (rule: SelectionRule) => record(current => current.rules.at(-1) && ruleKey(current.rules.at(-1)!) === ruleKey(rule) ? current : {
    ...current, boundary: current.boundary ?? rule.boundary, rules: [...current.rules, rule], objects: [],
  });
  const previewAt = (element: Element, x: number, y: number, operation?: SelectorOperation) => {
    const current = latest.current, config = current.configuration;
    point.current = { element, x, y };
    const drag = gesture.current ?? polygon.current;
    if (!drag && element.closest(selectorChrome)) { setPreview(null); return; }
    const include = drag ? drag.include : (operation ?? config.operation) === "include";
    const parentScope = current.selection.scope ? { scope: current.selection.scope } : {};
    const mode = drag?.mode ?? config.pattern;
    const app = boundaryFor(document.body);
    if (isLine(mode)) {
      const start = drag?.start ?? { x, y }, box = boundaryRect(app)!;
      const end = drag && Math.hypot(x - start.x, y - start.y) >= 4 ? { x, y } : { x: start.x, y: start.y - (mode === "position" ? 2 : 24) };
      const sample = drag?.sample ?? partAt(config.patternRole ? current.catalog.filter(part => part.role === config.patternRole) : current.catalog, element, start.x, start.y);
      if (config.stopAtPaint && !sample) { setPreview(null); return; }
      setPreview({ definesScope: true, rule: { boundary: app, include, ...parentScope, contour: config.contour,
        ...(config.patternRole || config.stopAtPaint ? { role: config.patternRole ?? sample!.role } : {}),
        line: { mode: mode as "axis" | "direction" | "position", start: relativePoint(start, box), end: relativePoint(end, box),
          bounded: config.bounded, ...(config.stopAtPaint ? { stopAtPaint: partPaint(sample!) } : {}) } } });
      return;
    }
    if (isPath(mode)) {
      if (!drag) { setPreview(null); return; }
      const box = boundaryRect(app)!;
      const points = mode === "polygon" ? [...drag.points, { x, y }] : mode === "freehand" ? drag.points : [drag.start, { x, y }];
      const path: PathCondition = { kind: mode as PathCondition["kind"], points: points.map(p => relativePoint(p, box)),
        closed: mode !== "freehand" || config.closed };
      setPreview({ definesScope: true, rule: { boundary: app, include, ...parentScope, path, contour: config.contour,
        ...(config.region ? { region: config.region } : {}), ...(config.patternRole ? { role: config.patternRole } : {}) } });
      return;
    }
    if (mode === "boundary") {
      const options = boundaryCandidates(element), boundary = options[Math.min(depth.current, options.length - 1)];
      if (!boundary) { setPreview(null); return; }
      setPreview({ definesScope: true, rule: { boundary, include, ...parentScope, contour: config.contour,
        path: { kind: "rectangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: true },
        ...(config.region ? { region: config.region } : {}), ...(config.patternRole ? { role: config.patternRole } : {}) } });
      return;
    }
    const scope = current.selection.scope;
    const hit = partAt(current.catalog, element, x, y);
    const part = hit && (!scope || matchingVisualParts([hit], { ...scope, include: true }).length) ? hit : undefined;
    setPreview(part ? { definesScope: false, rule: { boundary: app, include, ...(scope ? { scope } : {}),
      ...(mode === "pattern" ? { role: config.patternRole ?? part.role } : { part: part.key }) } } : null);
  };
  const accept = () => {
    const pick = candidateRef.current;
    if (!pick) return;
    if (pick.definesScope) {
      const { include: _include, ...constraint } = pick.rule;
      const scope = { ...constraint, geometryId: `geometry-${++geometrySequence.current}` };
      const rule = { ...pick.rule, geometryId: scope.geometryId };
      record(current => ({ ...current, boundary: scope.boundary, scope, rules: [...current.rules, rule], objects: [] }));
      // Geometry remains the working set; the pointer now refines its patterns.
      setConfiguration(config => ({ ...config, pattern: "pattern" }));
    } else append(pick.rule);
    setPreview(null);
  };
  const clear = useCallback(() => {
    gesture.current = null; polygon.current = null; setDrawing(false);
    record(current => current.boundary || current.rules.length || current.objects.length ? emptySelection() : current); setPreview(null);
  }, [record, setPreview]);
  const selectObject = useCallback((id: string) => {
    resolvePropertyTarget(PROPERTY_REGISTRY, id);
    gesture.current = null; polygon.current = null; setDrawing(false); setPreview(null);
    record(current => current.objects.includes(id) ? { ...current, objects: current.objects.filter(selected => selected !== id) } : { ...emptySelection(), objects: [id] });
    requestInspection(value => value + 1); setPhase("configure");
  }, [record, setPreview]);
  const close = () => { cancelDrawing(); setPhase("off"); };
  const disable = () => { close(); clear(); };
  const undo = () => { cancelDrawing(); setTimeline(previous => ({ ...previous, index: Math.max(0, previous.index - 1) })); };
  const redo = () => { cancelDrawing(); setTimeline(previous => ({ ...previous, index: Math.min(previous.states.length - 1, previous.index + 1) })); };
  const aim = () => { setPreview(null); setPhase("aim"); };
  const edit = (x: number, y: number) => {
    if (!hasSelection()) return;
    if (latest.current.selection.objects.length) { requestInspection(value => value + 1); return; }
    cancelDrawing(); setPosition({ x, y }); setPhase("edit");
  };
  const updateScope = (change: (scope: SelectionConstraint) => SelectionConstraint) => record(current => {
    const scope = current.scope;
    if (!scope) return current;
    const next = change(scope);
    if (next === scope) return current;
    const replace = (constraint: SelectionConstraint): SelectionConstraint => constraint.geometryId === scope.geometryId
      ? { ...constraint, ...next, role: constraint.role, part: constraint.part }
      : { ...constraint, scope: constraint.scope ? replace(constraint.scope) : undefined };
    return { ...current, scope: next, rules: current.rules.map(rule => ({ ...rule, ...replace(rule) })) };
  });
  const chooseRegion = (side: SelectionSide) => {
    const region = toggleSelectionRegion(latest.current.configuration.region, side);
    setConfiguration(config => ({ ...config, region }));
    updateScope(scope => scope.line ? scope : ({ ...scope, region: region ?? undefined })); setPreview(null);
  };
  const toggleContour = () => {
    const contour = !latest.current.configuration.contour;
    setConfiguration(config => ({ ...config, contour }));
    updateScope(scope => ({ ...scope, contour })); setPreview(null);
  };
  const previewRegion = (side: SelectionSide | null) => {
    const scope = latest.current.selection.scope;
    setPreview(scope && side ? { definesScope: false, rule: { ...scope, contour: false, region: side, include: latest.current.configuration.operation === "include" } } : null);
  };
  const chooseMode = (pattern: PatternMode) => { cancelDrawing(); depth.current = 0; setConfiguration(config => ({ ...config, pattern })); };
  const cyclePattern = () => chooseMode(nextPatternMode(latest.current.configuration.pattern));
  const finishPolygon = () => {
    const draft = polygon.current;
    if (!draft || draft.points.length < 3) return;
    const box = boundaryRect(boundaryFor(document.body))!;
    setPreview({ definesScope: true, rule: { boundary: boundaryFor(document.body), include: draft.include,
      ...(latest.current.selection.scope ? { scope: latest.current.selection.scope } : {}),
      path: { kind: "polygon", points: draft.points.map(p => relativePoint(p, box)), closed: true },
      contour: latest.current.configuration.contour, ...(latest.current.configuration.region ? { region: latest.current.configuration.region } : {}),
      ...(latest.current.configuration.patternRole ? { role: latest.current.configuration.patternRole } : {}) } });
    accept(); polygon.current = null; setDrawing(false);
  };
  const begin = (event: MouseEvent, include: boolean) => {
    if (!(event.target instanceof Element)) return;
    const config = latest.current.configuration, p = { x: event.clientX, y: event.clientY };
    setConfiguration(current => ({ ...current, operation: include ? "include" : "exclude" }));
    setPhase("aim");
    if (config.pattern === "polygon") {
      if (polygon.current && polygon.current.points.length >= 3 && Math.hypot(p.x - polygon.current.start.x, p.y - polygon.current.start.y) <= 8) {
        polygon.current.include = include; finishPolygon(); return;
      }
      const draft = polygon.current ?? { id: -1, element: event.target, start: p, mode: "polygon" as const, include, points: [] };
      draft.include = include; draft.points.push(p); polygon.current = draft; setDrawing(true);
      previewAt(event.target, p.x, p.y); return;
    }
    if (isLine(config.pattern) || isPath(config.pattern)) {
      gesture.current = { id: event instanceof PointerEvent ? event.pointerId : -1, start: p, element: event.target,
        mode: config.pattern, include, points: [p], sample: partAt(config.patternRole ? latest.current.catalog.filter(part => part.role === config.patternRole) : latest.current.catalog, event.target, p.x, p.y) };
      setDrawing(true);
    }
    previewAt(event.target, p.x, p.y, include ? "include" : "exclude");
    if (!gesture.current) accept();
  };
  const canConfigure = phase === "configure" || phase === "aim";
  const lineMode = isLine(configuration.pattern);
  const inputPosition = (input?: KeyboardEvent | MouseEvent) => input instanceof MouseEvent ? { x: input.clientX, y: input.clientY } : cursorPosition();
  const operate = (input: KeyboardEvent | MouseEvent | undefined, include: boolean) => {
    if (input instanceof MouseEvent) { begin(input, include); return; }
    const operation = include ? "include" : "exclude";
    setConfiguration(config => ({ ...config, operation }));
    if (input) {
      const p = cursorPosition(), element = document.elementFromPoint(p.x, p.y);
      if (element && !element.closest(selectorChrome)) { previewAt(element, p.x, p.y, operation); accept(); }
    }
  };
  const shortcuts = useFeatureActions("visualSelector", {
    "selector.open": { enabled: true, run: input => {
      if (phase === "configure") { aim(); return; }
      const p = inputPosition(input), element = document.elementFromPoint(p.x, p.y) ?? document.body;
      setCatalog(collectVisualParts()); setPosition(p); setPhase("configure"); setPreview(null);
      point.current = { ...p, element };
    } },
    "selector.selectMouse": { enabled: canConfigure, run: () => selectObject("ui.mouse") },
    "selector.pattern": { enabled: canConfigure, run: cyclePattern },
    "selector.edit": { enabled: hasSelection(), run: input => { const p = inputPosition(input); edit(p.x, p.y); } },
    "selector.cancel": { enabled: phase !== "off" || hasSelection(), run: disable },
    "selector.undo": { enabled: canConfigure, run: undo },
    "selector.redo": { enabled: canConfigure, run: redo },
    "selector.redoAlternate": { enabled: canConfigure, run: redo },
    "selector.clear": { enabled: hasSelection(), run: clear },
    "selector.aim": { enabled: phase !== "off" || hasSelection(), run: aim },
    "selector.boundary": { enabled: canConfigure, run: toggleContour },
    "selector.inside": { enabled: canConfigure, run: () => chooseRegion("inside") },
    "selector.outside": { enabled: canConfigure, run: () => chooseRegion("outside") },
    "selector.include": { enabled: canConfigure, run: input => operate(input, true) },
    "selector.exclude": { enabled: canConfigure, run: input => operate(input, false) },
    "selector.bounds": { enabled: canConfigure && lineMode && configuration.pattern !== "position", run: () => { setPreview(null); setConfiguration(config => ({ ...config, bounded: !config.bounded })); } },
    "selector.colorStop": { enabled: canConfigure && lineMode, run: () => { setPreview(null); setConfiguration(config => ({ ...config, stopAtPaint: !config.stopAtPaint })); } },
    "selector.finishGeometry": { enabled: canConfigure && drawing && !!polygon.current && polygon.current.points.length >= 3, run: finishPolygon },
    "selector.releaseGeometry": { enabled: canConfigure && !!selection.scope, run: () => { cancelDrawing(); record(current => ({ ...current, scope: null })); } },
    "selector.closePath": { enabled: canConfigure && configuration.pattern === "freehand", run: () => setConfiguration(config => ({ ...config, closed: !config.closed })) },
  });
  const actions = useRef({ previewAt, close, accept, edit, begin });
  actions.current = { previewAt, close, accept, edit, begin };
  const matches = useMemo(() => resolveVisualSelection(catalog, selection.boundary, selection.rules), [catalog, selection, geometry]);
  selectedRef.current = matches.included;
  const editableParts = useMemo(() => matches.included.flatMap(part => { const description = describeSelectedPart(part); return description ? [description] : []; }), [matches]);
  const preview = useMemo(() => {
    if (!candidate) return noParts;
    const existing = new Set((candidate.rule.include ? matches.included : matches.excluded).map(part => part.key));
    const changed = matchingVisualParts(catalog, candidate.rule).filter(part => !existing.has(part.key));
    return changed.length ? changed : noParts;
  }, [catalog, candidate, matches, geometry]);
  const guide = useMemo(() => candidate?.rule.line ? selectionLineGuide(catalog, candidate.rule) : null, [catalog, candidate, geometry]);
  const guides = useMemo(() => selection.rules.flatMap((rule, index) => {
    const points = rule.line && selectionLineGuide(catalog, rule);
    return points ? [{ key: `${index}:${ruleKey(rule)}`, points, include: rule.include, direction: rule.line?.mode === "direction" }] : [];
  }), [catalog, selection.rules, geometry]);
  const workingScope = selection.scope;
  const patternGroups = useMemo(() => {
    const parts = matchingVisualParts(catalog, { ...(workingScope ?? { boundary: boundaryFor(document.body) }), include: true });
    return (Object.keys(roleNames) as VisualRole[]).flatMap(role => { const peers = parts.filter(part => part.role === role); return peers.length ? [{ role, parts: peers }] : []; });
  }, [catalog, workingScope, geometry]);
  const properties = useMemo(() => [...new Set(editableParts.flatMap(part => selectedPartTarget(part).properties ?? []))], [editableParts]);
  useEffect(() => {
    let frame = 0, commandButton = -1, consumedUntil = 0;
    const shortcutUI = (target: EventTarget | null) => target instanceof Element && !!target.closest(".shortcut-display,.binding-row,[data-ui-resident-root='window:settings']");
    const outsideChrome = (event: Event) => event.target instanceof Element && !event.target.closest(selectorChrome);
    const down = (event: PointerEvent) => {
      clearRecordedShortcutPress(); commandButton = -1;
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery")) return;
      if (shortcuts.handle(event, id => id === "selector.open" || outsideChrome(event))) {
        commandButton = event.button; consumedUntil = performance.now() + 1500;
        claimUIPress(event.pointerId, event.pointerType, event.buttons);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (latest.current.phase === "off") return;
      if (!outsideChrome(event)) { claimUIPress(event.pointerId, event.pointerType, event.buttons); return; }
      if (latest.current.phase === "edit") {
        if (event.button === 0) actions.current.close();
        return;
      }
      claimUIPress(event.pointerId, event.pointerType, event.buttons);
      // Cleared/rebound commands have no private primary-button fallback.
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const up = (event: PointerEvent) => {
      const draft = gesture.current;
      if (!draft || draft.id !== event.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation();
      cancelAnimationFrame(frame); frame = 0;
      if (!shortcuts.blocked()) {
        const hit = document.elementFromPoint(event.clientX, event.clientY) ?? draft.element;
        if (draft.mode === "freehand") draft.points.push({ x: event.clientX, y: event.clientY });
        actions.current.previewAt(hit, event.clientX, event.clientY);
        const length = Math.hypot(event.clientX - draft.start.x, event.clientY - draft.start.y);
        if (isLine(draft.mode) || length >= 4 || draft.mode === "freehand" && draft.points.length > 2) actions.current.accept();
      }
      gesture.current = null; setDrawing(false); consumedUntil = performance.now() + 1500;
    };
    const move = (event: PointerEvent) => {
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element)) return;
      point.current = { element: event.target, x: event.clientX, y: event.clientY };
      if (latest.current.phase === "off" && latest.current.selection.boundary && event.buttons) {
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; setGeometry(value => value + 1); });
        return;
      }
      if (latest.current.phase !== "aim" || !gesture.current && !outsideChrome(event)) return;
      const draft = gesture.current;
      if (draft?.mode === "freehand") {
        const previous = draft.points.at(-1)!;
        if (Math.hypot(event.clientX - previous.x, event.clientY - previous.y) >= 3) {
          if (draft.points.length >= 512) draft.points = draft.points.filter((_, index) => index % 2 === 0);
          draft.points.push({ x: event.clientX, y: event.clientY });
        }
      }
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0; const p = point.current;
        if (p && latest.current.phase === "aim") actions.current.previewAt(p.element, p.x, p.y);
      });
    };
    const preventClick = (event: MouseEvent) => {
      if (!event.isTrusted || shortcuts.blocked() || shortcutUI(event.target)) return;
      if (event.button === commandButton || performance.now() < consumedUntil && outsideChrome(event)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === "click" || event.type === "auxclick") commandButton = -1;
      }
    };
    const wheel = (event: WheelEvent) => {
      if (shortcuts.blocked() || shortcutUI(event.target) || latest.current.phase !== "aim" || latest.current.configuration.pattern !== "boundary" || !outsideChrome(event)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const p = point.current; if (!p) return;
      depth.current = Math.max(0, Math.min(boundaryCandidates(p.element).length - 1, depth.current + (event.deltaY < 0 ? 1 : -1)));
      actions.current.previewAt(p.element, p.x, p.y);
    };
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
      if (shortcuts.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const context = (event: MouseEvent) => {
      if (recordedShortcutTail(event)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery") || !outsideChrome(event)) return;
      const keyboard = event.button !== 2 && event.clientX === 0 && event.clientY === 0;
      if (hasSelection() && keyboard) {
        event.preventDefault(); event.stopImmediatePropagation();
        const rect = event.target.getBoundingClientRect();
        actions.current.edit(rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else if (latest.current.phase !== "off" || performance.now() < consumedUntil) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const cancel = () => { gesture.current = null; polygon.current = null; setDrawing(false); setPreview(null); };
    const blur = () => { if (latest.current.phase !== "edit") { cancel(); actions.current.close(); } };
    const hidden = () => { if (document.hidden) blur(); };
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
  const inspectionKey = useMemo(() => selection.boundary || selection.rules.length || selection.objects.length
    ? `${inspectionRequest}:${timeline.index}:${selection.objects.join("|")}:${selection.scope ? constraintKey(selection.scope) : ""}` : "", [selection, timeline.index, inspectionRequest]);
  useEffect(() => { onInspect?.(inspectionKey); }, [inspectionKey, onInspect]);
  const contextValue = useMemo(() => ({ ...selection, parts: matches.included, properties, clear, selectObject, inspectionKey }),
    [selection, matches.included, properties, clear, selectObject, inspectionKey]);
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
  const left = Math.max(8, Math.min(position.x - 88, innerWidth - 184));
  const top = Math.max(8, Math.min(position.y - 84, innerHeight - 184));
  const scopeChain = (scope: SelectionConstraint | null): SelectionConstraint[] => scope ? [...scopeChain(scope.scope ?? null), scope] : [];
  useEffect(() => {
    const scope = selection.scope;
    if (!scope) return;
    setConfiguration(config => ({ ...config, contour: scope.contour ?? config.contour,
      region: scope.line ? config.region : scope.region ?? null,
      closed: scope.path?.kind === "freehand" ? scope.path.closed : config.closed }));
  }, [selection.scope]);
  const paths = [...scopeChain(selection.scope), candidate?.definesScope ? candidate.rule : null].flatMap((constraint, index, constraints) => {
    const box = constraint && boundaryRect(constraint.boundary);
    return constraint?.path && box ? [{ key: `${index}:${constraintKey(constraint)}`, points: pathVertices(constraint.path, box),
      closed: constraint.path.closed, disabledEdges: constraint.path.disabledEdges ?? [], preview: index === constraints.length - 1 && !!candidate?.definesScope,
      include: index === constraints.length - 1 && candidate?.definesScope ? candidate.rule.include : undefined }] : [];
  });
  const toggleEdge = (index: number) => updateScope(scope => {
    if (!scope.path) return scope;
    const disabled = scope.path.disabledEdges ?? [];
    return { ...scope, path: { ...scope.path, disabledEdges: disabled.includes(index) ? disabled.filter(edge => edge !== index) : [...disabled, index] } };
  });
  const activePath = workingScope?.path, activeBox = workingScope && boundaryRect(workingScope.boundary);
  const edges = activePath && activeBox ? pathEdges(pathVertices(activePath, activeBox), activePath.closed) : [];
  return <Context.Provider value={contextValue}>
    {children}
    {active && phase !== "edit" && createPortal(<VisualSelectionOverlay selected={matches.included} excluded={matches.excluded} preview={preview}
      candidate={candidate?.rule ?? null} guide={guide} guides={guides} paths={paths} />, document.body)}
    {phase === "aim" && createPortal(<SelectorCursor configuration={configuration} initial={point.current ?? position} />, document.body)}
    {phase === "edit" && createPortal(<SelectionController parts={editableParts} position={position} onClose={close} onResume={aim} />, document.body)}
    {phase === "configure" && createPortal(<div data-visual-selector className="visual-selector" role="dialog" aria-label="Visual selection controller"
      style={{ left, top }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
      <SelectorSymbol configuration={configuration} patternBinding={shortcuts.binding("selector.pattern")} actions={{
        contour: () => shortcuts.invoke("selector.boundary"), pattern: () => shortcuts.invoke("selector.pattern"),
        region: side => shortcuts.invoke(side === "inside" ? "selector.inside" : "selector.outside"), previewRegion,
      }} />
      <div className="visual-selector-conditions">
        {lineMode && <>
          <button type="button" aria-label="Finite drag bounds" aria-pressed={configuration.bounded || configuration.pattern === "position"}
            disabled={configuration.pattern === "position"} title="Limit the line to its dragged segment" onClick={() => shortcuts.invoke("selector.bounds")}>↦↤</button>
          <button type="button" aria-label="Stop at color change" aria-pressed={configuration.stopAtPaint} title="Stop at the first differently painted peer"
            onClick={() => shortcuts.invoke("selector.colorStop")}>◐</button>
        </>}
        {configuration.pattern === "freehand" && <button type="button" aria-label="Close freehand path" aria-pressed={configuration.closed}
          title="Close the drawn path to enable inside/outside" onClick={() => shortcuts.invoke("selector.closePath")}>○</button>}
        {selection.scope && <button type="button" aria-label="Release working geometry" title="Keep selections, return to matching across the app"
          onClick={() => shortcuts.invoke("selector.releaseGeometry")}>↗</button>}
      </div>
      <button type="button" className="visual-selector-mouse" data-ui-id="select-mouse" aria-label="Select Mouse"
        aria-pressed={selection.objects.includes("ui.mouse")} title={selection.objects.includes("ui.mouse") ? "Deselect Mouse" : "Select Mouse in Master controller"}
        onClick={() => shortcuts.invoke("selector.selectMouse")}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 2v7M6 9h12" /></svg>
      </button>
      <div className="visual-selector-actions">
        <button type="button" aria-label="Undo selection operation" title={`Undo (${shortcuts.binding("selector.undo")})`} disabled={timeline.index === 0} onClick={() => shortcuts.invoke("selector.undo")}>↶</button>
        <button type="button" aria-label="Redo selection operation" title={`Redo (${shortcuts.binding("selector.redo")})`} disabled={timeline.index === timeline.states.length - 1} onClick={() => shortcuts.invoke("selector.redo")}>↷</button>
        <output aria-label={`${matches.included.length} included, ${matches.excluded.length} excluded visual parts`}>{matches.included.length}<small> / {matches.excluded.length}</small></output>
        <button type="button" aria-label="Clear visual selection" title="Clear selection" onClick={() => shortcuts.invoke("selector.clear")}>×</button>
        <button type="button" aria-label="Edit selected appearance" title="Edit selected appearance" disabled={!hasSelection()} onClick={() => shortcuts.invoke("selector.edit")}>☷</button>
        <button type="button" aria-label={polygon.current ? "Finish polygon" : "Start aiming"} title={polygon.current ? "Finish polygon (Enter)" : `Resume selection (${shortcuts.binding("selector.open")})`}
          onClick={() => shortcuts.invoke(polygon.current ? "selector.finishGeometry" : "selector.aim")}>✓</button>
      </div>
      <details className="visual-selector-patterns">
        <summary title="Geometry modes, patterns and enabled edges">⠒</summary>
        <div className="visual-selector-modes" aria-label="Selection geometry modes">
          {PATTERN_MODES.map(mode => <button type="button" key={mode} aria-label={`Selection mode: ${mode}`} aria-pressed={configuration.pattern === mode}
            title={mode === "boundary" ? "Use a pointed contour as the working geometry; wheel changes owner depth" : mode}
            onClick={() => chooseMode(mode)}>{PATTERN_SYMBOLS[mode]}</button>)}
        </div>
        {patternGroups.map(group => <div key={group.role}>
          <button type="button" aria-pressed={configuration.patternRole === group.role} title={`${group.parts.length} matching parts. Toggle pattern filter`}
            onClick={() => { setPreview(null); setConfiguration(config => ({ ...config, patternRole: config.patternRole === group.role ? null : group.role })); }}>
            {roleSymbols[group.role]} {roleNames[group.role]} <small>{group.parts.length}</small>
          </button>
          {([true, false] as const).map(include => <button key={String(include)} type="button" aria-label={`${include ? "Include" : "Exclude"} ${roleNames[group.role]}`}
            className={include ? "selector-pattern-include" : "selector-pattern-exclude"}
            onPointerEnter={() => setPreview({ definesScope: false, rule: { boundary: boundaryFor(document.body), ...(workingScope ? { scope: workingScope } : {}), role: group.role, include } })}
            onPointerLeave={() => setPreview(null)}
            onClick={() => { append({ boundary: boundaryFor(document.body), ...(workingScope ? { scope: workingScope } : {}), role: group.role, include }); setPreview(null); }}>
            {include ? "+" : "−"}
          </button>)}
        </div>)}
        {activePath && activePath.kind !== "ellipse" && edges.length > 0 && <div className="visual-selector-edges" aria-label="Geometry edges">
          {edges.map((_, index) => <button type="button" key={index} aria-label={`Geometry edge ${index + 1}`} aria-pressed={!activePath.disabledEdges?.includes(index)}
            title={`Toggle edge ${index + 1} intersections`} onClick={() => toggleEdge(index)}>{index + 1}</button>)}
        </div>}
      </details>
    </div>, document.body)}
  </Context.Provider>;
}
