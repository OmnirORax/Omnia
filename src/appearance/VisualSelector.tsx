import {selectionRequest} from './selectionRequest';
import { appendTransient, stepTransient } from '../ui/transientTimeline';
import { PAGE_INPUT_SUSPEND } from "../ui/pageInputBoundary";
import { useCallback, createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import { claimUIPress } from "../ui/pointerOwnership";
import { cursorPosition } from "../ui/cursorPosition";
import { useFeatureActions } from "../ui/useFeatureActions";
import { clearRecordedShortcutPress, recordedShortcutTail } from "../featureActions";
import { selectionFeedbackVisible, type SelectionView, APPEARANCE_EDITOR, SELECTION_EDITING_SURFACE } from "./interactionHold";
import { VisualSelectionOverlay } from "./VisualSelectionOverlay";
import { SelectorSymbol, type SelectorConfiguration } from "./SelectorSymbol";
import { SelectorCursor } from "./SelectorCursor";
import { SelectionController } from "./SelectionController";
import { describeSelectedParts } from "./selectedParts";
import { PROPERTY_REGISTRY, TARGETS } from "./registry";
import { resolvePropertyTarget, selfInventory, type SelfInventoryNode } from "../properties/registry";
import { DEFAULT_SELECTION_MASK, workingGeometry, detectionGeometry, geometryBaseline, geometryMaskChange, selectionToggleRule, selectionRemovalRule, type SelectionMask, type MaskPart } from "./selectionToggle";
import { selectedPartTarget } from "./selectionCoupling";
import { nextPatternMode, relativePoint, toggleSelectionRegion, pathVertices, pathEdges, selectionWheelRotation, PATTERN_MODE_GROUPS, PATTERN_SYMBOLS,
  type Point, type PathCondition, type PatternMode, type SelectionSide } from "./selectionGeometry";
import {
  createVisualMeasurements, boundaryCandidates, boundaryFor, boundaryRect, collectVisualParts, matchingVisualParts,
  partAt, partPaint, patternTarget, patternTargetPath, pointerInSelectionScope, resolveVisualSelection, selectionLineGuide, selectorChrome,
  type SelectionBoundary, type SelectionConstraint, type SelectionRule, type VisualPart, type VisualRole,
} from "./visualSelection";

type SelectionState = { boundary: SelectionBoundary | null; scope: SelectionConstraint | null; mask: SelectionMask | null; rules: SelectionRule[]; objects: string[] };
export type ReferenceSelection={boundary:SelectionBoundary;constraint:SelectionConstraint;parts:readonly VisualPart[];point:Point;};
type VisualSelection = SelectionState & { requestPick:(accept:(selection:ReferenceSelection)=>boolean,cancel:()=>void)=>()=>void; parts: VisualPart[]; properties: string[]; clear: () => void; selectObject: (id: string) => void; inspectionKey: string; feedbackVisible: boolean; feedbackAvailable: boolean; toggleFeedback: () => void; feedbackBinding: string; selectTarget: (id: string) => void; targetSelection: ReadonlyMap<string, { included: number; total: number }> };
type Pick = { rule: SelectionRule; definesScope: boolean; maskChange?: SelectionRule[] };
type Phase = "off" | "configure" | "aim" | "edit" | "locked";
type Gesture = { id: number; start: Point; element: Element; mode: PatternMode; points: Point[]; sample?: VisualPart };
const Context = createContext<VisualSelection | null>(null);
export const useVisualSelection = () => useContext(Context);
const emptySelection = (): SelectionState => ({ boundary: null, scope: null, mask: null, rules: [], objects: [] });
const noParts: VisualPart[] = [];
const constraintKey = (rule: SelectionConstraint): string => `${rule.boundary.key}:${rule.backgrounds ?? ""}:${rule.region ?? ""}:${rule.contour ?? ""}:${rule.role ?? ""}:${rule.target ?? ""}:${rule.part ?? ""}:${JSON.stringify(rule.line ?? rule.path ?? null)}:${rule.geometryId ?? ""}:${rule.scope ? constraintKey(rule.scope) : ""}`;
const ruleKey = (rule: SelectionRule) => `${rule.include}:${constraintKey(rule)}`;
const roleNames: Record<VisualRole, string> = { text: "Text", background: "Backgrounds", contour: "Contours", icon: "Icons", indicator: "Indicators" };
const roleSymbols: Record<VisualRole, string> = { text: "T", background: "□", contour: "○", icon: "◆", indicator: "◉" };
const isLine = (mode: PatternMode) => mode === "axis" || mode === "direction" || mode === "position";
const isPath = (mode: PatternMode) => mode === "rectangle" || mode === "ellipse" || mode === "polygon" || mode === "freehand";

/** Geometry defines a working set; later include/exclude rules refine it. */
export function VisualSelectionProvider({ children, onInspect, masterOpen }: { children: ReactNode; onInspect?: (key: string) => void; masterOpen?: boolean }) {
  const [lockedPosition, setLockedPosition] = useState<Point>({ x: 0, y: 0 });
  const [view, setView] = useState<SelectionView>("auto");
  const [timeline, setTimeline] = useState(() => ({ states: [emptySelection()], index: 0 }));
  const selection = timeline.states[timeline.index];
  const requestedPick=useRef<{accept:(selection:ReferenceSelection)=>boolean;cancel:()=>void}|null>(null);
  const requestCheckpoint=useRef<{timeline:typeof timeline;configuration:SelectorConfiguration}|null>(null);
  const [phase, setPhase] = useState<Phase>("off");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [configuration, setConfiguration] = useState<SelectorConfiguration>({ ...DEFAULT_SELECTION_MASK, pattern: "pattern", patternRole: null,
    bounded: false, stopAtPaint: false, closed: false, rotation: 0 });
  const [catalog, setCatalog] = useState<VisualPart[]>([]);
  const [candidate, setCandidate] = useState<Pick | null>(null);
  const [geometry, setGeometry] = useState(0);
  const [inspectionRequest, requestInspection] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [automaticRegion, setAutomaticRegion] = useState<SelectionSide>("inside");
  const point = useRef<{ x: number; y: number; element: Element } | null>(null);
  const settledPoint = useRef<Point | null>(null);
  const retainedPreview = useRef(false);
  const depth = useRef(0), candidateRef = useRef<Pick | null>(null), geometrySequence = useRef(0);
  const selectedRef = useRef<VisualPart[]>([]), gesture = useRef<Gesture | null>(null);
  const polygon = useRef<Gesture | null>(null);
  const measurements = useMemo(() => createVisualMeasurements(), [catalog, geometry]);
  const toggleCandidate = useRef<{ catalog: VisualPart[]; selection: SelectionState; measurements: ReturnType<typeof createVisualMeasurements>; picks: Map<string, Pick> } | null>(null);
  const latest = useRef({ phase, configuration, catalog, selection, measurements });
  latest.current = { phase, configuration, catalog, selection, measurements };
  const hasSelection = () => !!latest.current.selection.boundary || !!latest.current.selection.objects.length || selectedRef.current.length > 0;
  const feedbackVisible = selectionFeedbackVisible(view);
  const setCandidatePick = useCallback((next: Pick | null) => {
    if (next && next.rule.backgrounds === undefined) next = { ...next,
      rule: { ...next.rule, backgrounds: latest.current.configuration.backgrounds },
      ...(next.maskChange ? { maskChange: next.maskChange.map(rule => ({ ...rule, backgrounds: latest.current.configuration.backgrounds })) } : {}) };
    const previous = candidateRef.current;
    if (previous === next || previous && next && previous.definesScope === next.definesScope && ruleKey(previous.rule) === ruleKey(next.rule)) return;
    candidateRef.current = next; setCandidate(next);
  }, []);
  const record = useCallback((change: (current: SelectionState) => SelectionState) => setTimeline(previous => {
    const current = previous.states[previous.index], next = change(current);
    if (next === current) return previous;
    return appendTransient(previous,next);
  }), []);
  const cancelDrawing = () => { gesture.current = null; polygon.current = null; setDrawing(false); setCandidatePick(null); };
  const toggleSelection = (constraint: SelectionConstraint) => record(current => {
    const parts = latest.current.catalog;
    const included = resolveVisualSelection(parts, current.boundary, current.rules).included;
    const rule = selectionToggleRule(parts, included, constraint);
    if (!matchingVisualParts(parts, rule).length) return current;
    return { ...current, boundary: current.boundary ?? rule.boundary, rules: [...current.rules, rule], objects: [] };
  });
  const selectTarget = useCallback((target: string) => {
    const current = latest.current;
    const constraint: SelectionConstraint = { boundary: boundaryFor(document.body), target,
      backgrounds: current.configuration.backgrounds,
      ...(current.selection.scope ? { scope: workingGeometry(current.selection.scope, current.configuration) } : {}) };
    record(selection => {
      const included = resolveVisualSelection(current.catalog, selection.boundary, selection.rules, current.measurements).included;
      const rule = selectionToggleRule(current.catalog, included, constraint, current.measurements);
      if (!matchingVisualParts(current.catalog, rule, current.measurements).length) return selection;
      return { ...selection, boundary: selection.boundary ?? rule.boundary, rules: [...selection.rules, rule], objects: [] };
    });
    setCandidatePick(null);
  }, [record, setCandidatePick]);
  const prepareToggle = (constraint: SelectionConstraint) => {
    constraint = { ...constraint, backgrounds: latest.current.configuration.backgrounds };
    const { catalog, selection, measurements } = latest.current, key = constraintKey(constraint);
    let cache = toggleCandidate.current;
    if (!cache || cache.catalog !== catalog || cache.selection !== selection || cache.measurements !== measurements) {
      cache = { catalog, selection, measurements, picks: new Map() }; toggleCandidate.current = cache;
    }
    let pick = cache.picks.get(key);
    if (!pick) {
      pick = { definesScope: false, rule: selectionToggleRule(catalog, selectedRef.current, constraint, measurements) };
      // Bound the cache even when individual picking visits thousands of hosts.
      if (cache.picks.size >= 128) cache.picks.delete(cache.picks.keys().next().value!);
      cache.picks.set(key, pick);
    }
    setCandidatePick(pick);
  };
  const pickAt = (element: Element, x: number, y: number) => {
    const current = latest.current, config = current.configuration;
    if (element.closest(APPEARANCE_EDITOR)) { setCandidatePick(null); return; }
    point.current = { element, x, y };
    const drag = gesture.current ?? polygon.current;
    if (!drag && settledPoint.current && Math.hypot(x - settledPoint.current.x, y - settledPoint.current.y) < 3) { setCandidatePick(null); return; }
    if (!drag && element.closest(selectorChrome)) { setCandidatePick(null); return; }
    const include = true;
    const parentScope = current.selection.scope ? { scope: current.selection.scope } : {};
    const neutral = !config.contour && !config.region;
    const configuredMode = drag?.mode ?? config.pattern;
    const mode = neutral && !current.selection.scope && (configuredMode === "pattern" || configuredMode === "item") ? "boundary" : configuredMode;
    const app = boundaryFor(document.body);
    if (isLine(mode)) {
      const start = drag?.start ?? { x, y }, box = boundaryRect(app)!;
      const end = drag && Math.hypot(x - start.x, y - start.y) >= 4 ? { x, y } : { x: start.x, y: start.y - (mode === "position" ? 2 : 24) };
      const sample = drag?.sample ?? partAt(config.patternRole ? current.catalog.filter(part => part.role === config.patternRole) : current.catalog, element, start.x, start.y, current.measurements);
      if (config.stopAtPaint && !sample) { setCandidatePick(null); return; }
      setCandidatePick({ definesScope: true, rule: { boundary: app, include, ...parentScope, contour: config.contour,
        ...(config.patternRole || config.stopAtPaint ? { role: config.patternRole ?? sample!.role } : {}),
        line: { mode: mode as "axis" | "direction" | "position", start: relativePoint(start, box), end: relativePoint(end, box),
          bounded: config.bounded, rotation: config.rotation, ...(config.stopAtPaint ? { stopAtPaint: partPaint(sample!) } : {}) } } });
      return;
    }
    if (isPath(mode)) {
      if (!drag) { setCandidatePick(null); return; }
      const box = boundaryRect(app)!;
      const points = mode === "polygon" ? [...drag.points, { x, y }] : mode === "freehand" ? drag.points : [drag.start, { x, y }];
      const path: PathCondition = { kind: mode as PathCondition["kind"], points: points.map(p => relativePoint(p, box)),
        closed: mode !== "freehand" || config.closed, rotation: config.rotation };
      setCandidatePick({ definesScope: true, rule: { boundary: app, include, ...parentScope, path, contour: config.contour,
        ...(config.region ? { region: config.region } : {}), ...(config.patternRole ? { role: config.patternRole } : {}) } });
      return;
    }
    if (mode === "boundary") {
      const sampled = partAt(current.catalog, element, x, y, current.measurements);
      const options = boundaryCandidates(element);
      const boundary = depth.current === 0 && sampled ? boundaryFor(sampled.element) : options[Math.min(depth.current, options.length - 1)];
      if (!boundary) { setCandidatePick(null); return; }
      setCandidatePick({ definesScope: true, rule: { boundary, include, ...parentScope, ownerFrame: true, ...(sampled ? { framePart: sampled.key } : {}), contour: config.contour,
        path: { kind: "rectangle", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: true, rotation: config.rotation },
        ...(config.region ? { region: config.region } : {}), ...(config.patternRole ? { role: config.patternRole } : {}) } });
      return;
    }
    const scope = current.selection.scope ? detectionGeometry(current.selection.scope, config, element, { x, y }) : null;
    if (scope && !pointerInSelectionScope(scope, element, { x, y })) { setCandidatePick(null); return; }
    const hit = partAt(current.catalog, element, x, y, current.measurements);
    const part = hit && (config.backgrounds || hit.role !== "background") && (!scope || matchingVisualParts([hit], { ...scope, include: true }, current.measurements).length) ? hit : undefined;
    if (part) prepareToggle({ boundary: app, ...(scope ? { scope } : {}),
      ...(mode === "pattern" ? { role: config.patternRole ?? part.role, target: patternTarget(part) } : { part: part.key }) });
    else setCandidatePick(null);
  };
  const accept = (geometryOnly = false) => {
    const pick = candidateRef.current;
    if (!pick) return;
    const request=requestedPick.current;
    if(request){const p=point.current;if(p&&request.accept({boundary:pick.rule.boundary,constraint:pick.rule,parts:matchingVisualParts(latest.current.catalog,pick.rule,latest.current.measurements),point:{x:p.x,y:p.y}})){
      requestedPick.current=null;setCandidatePick(null);
    }return;}
    if (pick.definesScope) {
      const { include: _include, backgrounds: _backgrounds, ...constraint } = pick.rule;
      const mask = { contour: geometryOnly ? false : latest.current.configuration.contour, region: geometryOnly ? null : latest.current.configuration.region, backgrounds: latest.current.configuration.backgrounds };
      const scope = workingGeometry({ ...constraint, geometryId: `geometry-${++geometrySequence.current}` }, mask);
      record(current => ({ ...current, boundary: scope.boundary, scope, mask, rules: geometryOnly ? current.rules : [...current.rules, ...geometryBaseline(scope, mask)], objects: [] }));
      // Geometry remains the working set; the pointer now refines its patterns.
      setConfiguration(config => ({ ...config, pattern: "pattern", ...(geometryOnly ? { contour: false, region: null } : {}) }));
    } else toggleSelection(pick.rule);
    settledPoint.current = point.current;
    setCandidatePick(null);
  };
  const clear = useCallback(() => {
    setView("auto");
    gesture.current = null; polygon.current = null; setDrawing(false);
    record(current => current.boundary || current.rules.length || current.objects.length ? emptySelection() : current); setCandidatePick(null);
  }, [record, setCandidatePick]);
  const selectObject = useCallback((id: string) => {
    resolvePropertyTarget(PROPERTY_REGISTRY, id);
    setView("auto");
    gesture.current = null; polygon.current = null; setDrawing(false); setCandidatePick(null);
    record(current => current.objects.includes(id) ? { ...current, objects: current.objects.filter(selected => selected !== id) } : { ...emptySelection(), objects: [id] });
    requestInspection(value => value + 1); setPhase("configure");
  }, [record, setCandidatePick]);
  const close = () => { const request=requestedPick.current;requestedPick.current=null;if(request)request.cancel();cancelDrawing(); setInventoryOpen(false); setPhase("off"); };
  const disable = () => { const requested=!!requestedPick.current;close();if(!requested)clear(); };
  const undo = () => { cancelDrawing(); setTimeline(previous => stepTransient(previous,-1)); };
  const redo = () => { cancelDrawing(); setTimeline(previous => stepTransient(previous,1)); };
  const aim = () => { retainedPreview.current = !!candidateRef.current; toggleCandidate.current = null; setCatalog(collectVisualParts()); setInventoryOpen(false); setPhase("aim"); };
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
      ? { ...constraint, boundary: next.boundary, path: next.path, line: next.line, scope: constraint.scope ? replace(constraint.scope) : undefined }
      : { ...constraint, scope: constraint.scope ? replace(constraint.scope) : undefined };
    return { ...current, scope: next, rules: current.rules.map(rule => ({ ...rule, ...replace(rule) })) };
  });
  const applyMask = (mask: SelectionMask, part: MaskPart) => {
    setConfiguration(config => ({ ...config, ...mask }));
    record(current => {
      if (!current.scope) return current;
      const scope = workingGeometry(current.scope, mask);
      return { ...current, scope, mask, rules: [...current.rules, ...geometryMaskChange(scope, mask, part)] };
    });
    setCandidatePick(null);
  };
  const rotateGeometry = (degrees: number, target: "pending" | "placed") => {
    setCandidatePick(null); settledPoint.current = null;
    if (target === "pending") {
      setConfiguration(config => ({ ...config, rotation: config.rotation + degrees }));
      return;
    }
    updateScope(scope => ({ ...scope, line: scope.line ? { ...scope.line, rotation: (scope.line.rotation ?? 0) + degrees } : undefined,
      path: scope.path ? { ...scope.path, rotation: (scope.path.rotation ?? 0) + degrees } : undefined }));
  };
  const chooseRegion = (side: SelectionSide) => applyMask({ contour: latest.current.configuration.contour,
    region: toggleSelectionRegion(latest.current.configuration.region, side), backgrounds: latest.current.configuration.backgrounds }, side);
  const toggleContour = () => applyMask({ contour: !latest.current.configuration.contour, region: latest.current.configuration.region, backgrounds: latest.current.configuration.backgrounds }, "contour");
  const chooseMode = (pattern: PatternMode) => { cancelDrawing(); depth.current = 0; setConfiguration(config => ({ ...config, pattern, rotation: 0 })); };
  const cyclePattern = () => chooseMode(nextPatternMode(latest.current.configuration.pattern));
  const finishPolygon = () => {
    const draft = polygon.current;
    if (!draft || draft.points.length < 3) return;
    const box = boundaryRect(boundaryFor(document.body))!;
    setCandidatePick({ definesScope: true, rule: { boundary: boundaryFor(document.body), include: true,
      ...(latest.current.selection.scope ? { scope: latest.current.selection.scope } : {}),
      path: { kind: "polygon", points: draft.points.map(p => relativePoint(p, box)), closed: true, rotation: latest.current.configuration.rotation },
      contour: latest.current.configuration.contour, ...(latest.current.configuration.region ? { region: latest.current.configuration.region } : {}),
      ...(latest.current.configuration.patternRole ? { role: latest.current.configuration.patternRole } : {}) } });
    accept(true); polygon.current = null; setDrawing(false);
  };
  const begin = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return;
    const config = latest.current.configuration, p = { x: event.clientX, y: event.clientY };
    settledPoint.current = null;
    setPhase("aim");
    if (config.pattern === "polygon") {
      if (polygon.current && polygon.current.points.length >= 3 && Math.hypot(p.x - polygon.current.start.x, p.y - polygon.current.start.y) <= 8) {
        finishPolygon(); return;
      }
      const draft = polygon.current ?? { id: -1, element: event.target, start: p, mode: "polygon" as const, points: [] };
      draft.points.push(p); polygon.current = draft; setDrawing(true);
      pickAt(event.target, p.x, p.y); return;
    }
    if (isLine(config.pattern) || isPath(config.pattern)) {
      gesture.current = { id: event instanceof PointerEvent ? event.pointerId : -1, start: p, element: event.target,
        mode: config.pattern, points: [p], sample: partAt(config.patternRole ? latest.current.catalog.filter(part => part.role === config.patternRole) : latest.current.catalog, event.target, p.x, p.y) };
      setDrawing(true);
    }
    pickAt(event.target, p.x, p.y);
    if (!gesture.current) accept();
  };
  const canConfigure = phase === "configure" || phase === "aim";
  const lineMode = isLine(configuration.pattern);
  const inputPosition = (input?: KeyboardEvent | MouseEvent) => input instanceof MouseEvent ? { x: input.clientX, y: input.clientY } : cursorPosition();
  const pickSelection = (input: KeyboardEvent | MouseEvent | undefined) => {
    if (input instanceof MouseEvent) { begin(input); return; }
    const p = cursorPosition(), element = document.elementFromPoint(p.x, p.y);
    settledPoint.current = null;
    if (element && !element.closest(selectorChrome)) { pickAt(element, p.x, p.y); accept(); }
  };
  const deselectAt = (input?: KeyboardEvent | MouseEvent) => {
    const p = inputPosition(input), element = input instanceof MouseEvent && input.target instanceof Element ? input.target : document.elementFromPoint(p.x, p.y);
    if (!element) { clear(); return; }
    const current = latest.current;
    const pointed = partAt(current.catalog, element, p.x, p.y, current.measurements);
    settledPoint.current = null;
    pickAt(element, p.x, p.y);
    const constraint = candidateRef.current?.rule ?? { boundary: boundaryFor(document.body), ...(pointed ? { part: pointed.key } : {}) };
    const removal = selectionRemovalRule(current.catalog, selectedRef.current, pointed, constraint, current.measurements);
    if (!removal) { clear(); return; }
    cancelDrawing();
    record(selection => ({ ...selection, rules: [...selection.rules, removal] }));
    settledPoint.current = p;
  };
  const shortcuts = useFeatureActions("visualSelector", {
    "selector.open": { enabled: true, run: input => {
      if (phase === "configure") { aim(); return; }
      const p = inputPosition(input), element = document.elementFromPoint(p.x, p.y) ?? document.body;
      retainedPreview.current = !!candidateRef.current;
      setCatalog(collectVisualParts()); setPosition(p); setPhase("configure");
      point.current = { ...p, element };
    } },
    "selector.lock": { enabled: phase !== "off", run: input => {
      if (phase === "locked") {
        const p = inputPosition(input);
        point.current = { ...p, element: document.elementFromPoint(p.x, p.y) ?? document.body };
        aim(); return;
      }
      const p = phase === "aim" ? inputPosition(input) : point.current ?? position;
      setLockedPosition(p);
      // Explicit locking retains the pointed preview; normal cursor movement
      // must not replace it while properties are edited.
      if (gesture.current || polygon.current) cancelDrawing();
      setInventoryOpen(false); setPhase("locked");
    } },
    "selector.selfInventory": { enabled: canConfigure, run: () => {
      if (phase !== "configure") { const p = cursorPosition(); setPosition(p); setPhase("configure"); }
      setInventoryOpen(open => !open);
    } },
    "selector.selectMouse": { enabled: canConfigure, run: () => selectObject("ui.mouse") },
    "selector.pattern": { enabled: canConfigure, run: cyclePattern },
    "selector.feedbackView": { enabled: phase !== "off" || hasSelection(), run: () => setView(feedbackVisible ? "preview" : "selection") },
    "selector.deselect": { enabled: canConfigure, run: deselectAt },
    "selector.edit": { enabled: hasSelection(), run: input => { const p = inputPosition(input); edit(p.x, p.y); } },
    "selector.cancel": { enabled: phase !== "off" || hasSelection(), run: disable },
    "selector.undo": { enabled: canConfigure, run: undo },
    "selector.redo": { enabled: canConfigure, run: redo },
    "selector.redoAlternate": { enabled: canConfigure, run: redo },
    "selector.clear": { enabled: hasSelection(), run: clear },
    "selector.aim": { enabled: phase !== "off" || hasSelection(), run: aim },
    "selector.backgrounds": { enabled: canConfigure, run: () => {
      setCandidatePick(null); setConfiguration(config => ({ ...config, backgrounds: !config.backgrounds,
        patternRole: !config.backgrounds ? config.patternRole : config.patternRole === "background" ? null : config.patternRole }));
    } },
    "selector.boundary": { enabled: canConfigure, run: toggleContour },
    "selector.inside": { enabled: canConfigure, run: () => chooseRegion("inside") },
    "selector.outside": { enabled: canConfigure, run: () => chooseRegion("outside") },
    "selector.include": { enabled: canConfigure, run: pickSelection },
    "selector.bounds": { enabled: canConfigure && lineMode && configuration.pattern !== "position", run: () => { setCandidatePick(null); setConfiguration(config => ({ ...config, bounded: !config.bounded })); } },
    "selector.colorStop": { enabled: canConfigure && lineMode, run: () => { setCandidatePick(null); setConfiguration(config => ({ ...config, stopAtPaint: !config.stopAtPaint })); } },
    "selector.finishGeometry": { enabled: canConfigure && drawing && !!polygon.current && polygon.current.points.length >= 3, run: finishPolygon },
    "selector.releaseGeometry": { enabled: canConfigure && !!selection.scope, run: () => { cancelDrawing(); record(current => ({ ...current, scope: null })); } },
    "selector.closePath": { enabled: canConfigure && configuration.pattern === "freehand", run: () => setConfiguration(config => ({ ...config, closed: !config.closed })) },
  });
  const actions = useRef({ pickAt, close, accept, edit, begin, rotateGeometry });
  actions.current = { pickAt, close, accept, edit, begin, rotateGeometry };
  const matches = useMemo(() => resolveVisualSelection(catalog, selection.boundary, selection.rules, measurements), [catalog, selection, geometry]);
  selectedRef.current = matches.included;
  const editableParts = useMemo(() => describeSelectedParts(matches.included), [matches]);
  const preview = useMemo(() => {
    if (!candidate || (phase !== "aim" && phase !== "locked" && phase !== "configure")) return noParts;
    const changed = matchingVisualParts(catalog, candidate.rule, measurements);
    const selected = new Set(matches.included.map(part => part.key));
    return changed.filter(part => candidate.rule.include ? !selected.has(part.key) : selected.has(part.key));
  }, [catalog, candidate, measurements, matches.included, phase]);
  const feedbackSelected = useMemo(() => {
    if (candidate?.rule.include !== false || !preview.length) return matches.included;
    const removed = new Set(preview.map(part => part.key));
    return matches.included.filter(part => !removed.has(part.key));
  }, [candidate, preview, matches.included]);
  const guide = useMemo(() => candidate?.rule.line ? selectionLineGuide(catalog, candidate.rule, measurements) : null, [catalog, candidate, geometry]);
  const guides = useMemo(() => {
    const chain: SelectionConstraint[] = [];
    for (let scope = selection.scope; scope; scope = scope.scope ?? null) chain.unshift(scope);
    return chain.flatMap(scope => {
      const points = scope.line && selectionLineGuide(catalog, { ...scope, include: true }, measurements);
      return points ? [{ key: scope.geometryId ?? constraintKey(scope), points, include: true, direction: scope.line?.mode === "direction" }] : [];
    });
  }, [catalog, selection.scope, geometry]);
  const workingScope = useMemo(() => selection.scope && !configuration.contour && !configuration.region && selection.scope.path?.closed
    ? { ...selection.scope, region: automaticRegion } : selection.scope, [selection.scope, configuration.contour, configuration.region, automaticRegion]);
  const patternGroups = useMemo(() => {
    const parts = matchingVisualParts(catalog, { ...(workingScope ?? { boundary: boundaryFor(document.body) }), include: true, backgrounds: configuration.backgrounds }, measurements);
    return (Object.keys(roleNames) as VisualRole[]).flatMap(role => { const peers = parts.filter(part => part.role === role); return peers.length ? [{ role, parts: peers }] : []; });
  }, [catalog, workingScope, geometry, configuration.backgrounds]);
  const properties = useMemo(() => [...new Set(editableParts.flatMap(part => selectedPartTarget(part).properties ?? []))], [editableParts]);
  const targetSelection = useMemo(() => {
    const selected = new Set(matches.included.map(part => part.key));
    const counts = new Map<string, { included: number; total: number }>();
    // Reuse the already cached work-area peers; no extra discovery/geometry pass.
    for (const group of patternGroups) for (const part of group.parts) for (const id of patternTargetPath(part)) {
      const count = counts.get(id) ?? { included: 0, total: 0 };
      count.total++; if (selected.has(part.key)) count.included++;
      counts.set(id, count);
    }
    return counts;
  }, [patternGroups, matches.included]);
  useEffect(() => {
    let frame = 0, commandButton = -1, consumedPointer: number | null = null, consumedUntil = 0;
    const shortcutUI = (target: EventTarget | null) => target instanceof Element && !!target.closest(".shortcut-display,.binding-row,[data-ui-resident-root='window:settings']");
    const outsideChrome = (event: Event) => event.target instanceof Element && !event.target.closest(`${selectorChrome},${APPEARANCE_EDITOR}`) &&
      !(hasSelection() && !requestedPick.current && event.target.closest(SELECTION_EDITING_SURFACE));
    // Entering editing ends aiming, not the accepted selection. Resume explicitly
    // through the existing selector shortcut; do not poll or rebuild geometry.
    const handoffToEditing = (target: EventTarget | null) => {
      if (requestedPick.current || latest.current.phase !== "aim" || !hasSelection() || gesture.current || polygon.current ||
        !(target instanceof Element) || !target.closest(SELECTION_EDITING_SURFACE)) return false;
      actions.current.close(); return true;
    };
    const down = (event: PointerEvent) => {
      clearRecordedShortcutPress(); commandButton = -1;
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery")) return;
      if (shortcuts.handle(event, id => id === "selector.open" || id === "selector.lock" || outsideChrome(event))) {
        commandButton = event.button; consumedPointer = event.pointerId; consumedUntil = performance.now() + 1500;
        claimUIPress(event.pointerId, event.pointerType, event.buttons);
        event.preventDefault(); event.stopImmediatePropagation(); return;
      }
      if (handoffToEditing(event.target)) return;
      if (latest.current.phase === "off" || latest.current.phase === "locked") return;
      if (!outsideChrome(event)) { claimUIPress(event.pointerId, event.pointerType, event.buttons); return; }
      if (latest.current.phase === "edit") {
        if (event.button === 0) actions.current.close();
        return;
      }
      claimUIPress(event.pointerId, event.pointerType, event.buttons);
      // MS owns the native click tail even when the saved command does not match.
      commandButton = event.button; consumedPointer = event.pointerId; consumedUntil = performance.now() + 1500;
      // Cleared/rebound commands have no private primary-button fallback.
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId === consumedPointer) {
        consumedPointer = null; consumedUntil = performance.now() + 1500;
        event.preventDefault(); event.stopImmediatePropagation();
      }
      const draft = gesture.current;
      if (!draft || draft.id !== event.pointerId) return;
      event.preventDefault(); event.stopImmediatePropagation();
      cancelAnimationFrame(frame); frame = 0;
      if (!shortcuts.blocked()) {
        const hit = document.elementFromPoint(event.clientX, event.clientY) ?? draft.element;
        if (draft.mode === "freehand") draft.points.push({ x: event.clientX, y: event.clientY });
        actions.current.pickAt(hit, event.clientX, event.clientY);
        const length = Math.hypot(event.clientX - draft.start.x, event.clientY - draft.start.y);
        if (isLine(draft.mode) || length >= 4 || draft.mode === "freehand" && draft.points.length > 2) actions.current.accept(true);
      }
      gesture.current = null; setDrawing(false); consumedUntil = performance.now() + 1500;
    };
    const move = (event: PointerEvent) => {
      // Parked MS ignores pointer motion; ordinary app input remains live.
      if (latest.current.phase === "locked" || latest.current.phase === "edit") return;
      if (handoffToEditing(event.target)) return;
      if (event.target instanceof Element && event.target.closest(APPEARANCE_EDITOR)) { setCandidatePick(null); return; }
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element)) return;
      point.current = { element: event.target, x: event.clientX, y: event.clientY };
      const current = latest.current;
      if (current.phase === "aim" && current.selection.scope && !current.configuration.contour && !current.configuration.region && current.selection.scope.path?.closed && outsideChrome(event)) {
        const scope = detectionGeometry(current.selection.scope, current.configuration, event.target, point.current);
        setAutomaticRegion(scope.region === "inside" ? "inside" : "outside");
      }
      if (latest.current.phase === "off" && latest.current.selection.boundary && event.buttons) {
        if (!frame) frame = requestAnimationFrame(() => { frame = 0; setGeometry(value => value + 1); });
        return;
      }
      if (latest.current.phase !== "aim" || !gesture.current && !outsideChrome(event)) return;
      retainedPreview.current = false;
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
        if (p && latest.current.phase === "aim") actions.current.pickAt(p.element, p.x, p.y);
      });
    };
    const preventClick = (event: MouseEvent) => {
      if (!event.isTrusted || shortcuts.blocked() || shortcutUI(event.target) || latest.current.phase === "locked" && event.button !== commandButton) return;
      if (event.button === commandButton || performance.now() < consumedUntil && outsideChrome(event)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.type === "click" || event.type === "auxclick") commandButton = -1;
      }
    };
    const wheel = (event: WheelEvent) => {
      if (shortcuts.blocked() || shortcutUI(event.target) || !outsideChrome(event) ||
          (latest.current.phase !== "aim" && latest.current.phase !== "configure")) return;
      const current = latest.current;
      const rotation = selectionWheelRotation(event, current.configuration.pattern, !!current.selection.scope, innerHeight);
      if (rotation) {
        event.preventDefault(); event.stopImmediatePropagation();
        actions.current.rotateGeometry(rotation.degrees, rotation.target); return;
      }
      if (current.selection.scope || event.shiftKey || current.configuration.pattern !== "boundary") return;
      event.preventDefault(); event.stopImmediatePropagation();
      const p = point.current; if (!p) return;
      depth.current = Math.max(0, Math.min(boundaryCandidates(p.element).length - 1, depth.current + (event.deltaY < 0 ? 1 : -1)));
      actions.current.pickAt(p.element, p.x, p.y);
    };
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest("omnium-appearance-recovery")) return;
      if (shortcuts.handle(event)) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    const context = (event: MouseEvent) => {
      if (recordedShortcutTail(event)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      if (shortcuts.blocked() || shortcutUI(event.target) || !(event.target instanceof Element) || event.target.closest("omnium-appearance-recovery") || !outsideChrome(event)) return;
      const keyboard = event.button !== 2 && event.clientX === 0 && event.clientY === 0;
      if (latest.current.phase === "locked") return;
      if (hasSelection() && keyboard) {
        event.preventDefault(); event.stopImmediatePropagation();
        const rect = event.target.getBoundingClientRect();
        actions.current.edit(rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else if (latest.current.phase !== "off" || performance.now() < consumedUntil) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    };
    const cancel = () => {
      // Browser chrome is outside the app: release unfinished input without
      // accepting, clearing, closing or changing the current selection/preview.
      cancelAnimationFrame(frame); frame = 0;
      gesture.current = null; polygon.current = null; setDrawing(false);
      commandButton = -1; consumedPointer = null; consumedUntil = 0;
    };
    const blur = () => {
      retainedPreview.current = !!candidateRef.current;
      cancel();
    };
    const hidden = () => { if (document.hidden) blur(); };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("mousedown", preventClick, true);
    window.addEventListener("mouseup", preventClick, true);
    window.addEventListener("click", preventClick, true);
    window.addEventListener("auxclick", preventClick, true);
    window.addEventListener("wheel", wheel, { capture: true, passive: false });
    window.addEventListener("keydown", key, true);
    window.addEventListener("contextmenu", context, true);
    window.addEventListener(PAGE_INPUT_SUSPEND, blur);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("mousedown", preventClick, true);
      window.removeEventListener("mouseup", preventClick, true);
      window.removeEventListener("click", preventClick, true);
      window.removeEventListener("auxclick", preventClick, true);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("contextmenu", context, true);
      window.removeEventListener(PAGE_INPUT_SUSPEND, blur);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, []);
  const inspectionKey = useMemo(() => selection.boundary || selection.rules.length || selection.objects.length
    ? `${inspectionRequest}:${timeline.index}:${selection.objects.join("|")}:${selection.scope ? constraintKey(selection.scope) : ""}` : "", [selection, timeline.index, inspectionRequest]);
  useEffect(() => { onInspect?.(inspectionKey); }, [inspectionKey, onInspect]);
  const toggleFeedback = useCallback(() => { shortcuts.invoke("selector.feedbackView"); }, [shortcuts]);
  const requestPick=useCallback((accept:(selection:ReferenceSelection)=>boolean,cancel:()=>void)=>{
    const retained=requestCheckpoint.current??{timeline,configuration:{...configuration}};
    const previous=requestedPick.current;requestedPick.current=null;if(previous)previous.cancel();
    requestCheckpoint.current=retained;const checkpoint=retained.timeline,config=retained.configuration;
    const restore=()=>{requestCheckpoint.current=null;gesture.current=null;polygon.current=null;setDrawing(false);setTimeline(checkpoint);setConfiguration(config);setPhase('off');setInventoryOpen(false);};
    const request=selectionRequest(accept,cancel,restore);requestedPick.current=request;
    setCandidatePick(null);setTimeline({states:[emptySelection()],index:0});setCatalog(collectVisualParts());setConfiguration(before=>({...before,pattern:'boundary'}));setPhase('aim');
    return()=>{if(requestedPick.current===request){requestedPick.current=null;request.cancel();}};
  },[timeline,configuration,setCandidatePick]);
  const feedbackAvailable = phase !== "off" || hasSelection();
  const feedbackBinding = shortcuts.binding("selector.feedbackView");
  const contextValue = useMemo(() => ({ ...selection, parts: matches.included, properties, clear, selectObject, inspectionKey,
    feedbackVisible, feedbackAvailable, toggleFeedback, feedbackBinding, selectTarget, targetSelection,requestPick }),
    [selection, matches.included, properties, clear, selectObject, inspectionKey, feedbackVisible, feedbackAvailable, toggleFeedback, feedbackBinding, selectTarget, targetSelection,requestPick]);
  const active = phase !== "off" || !!selection.boundary;
  const wasMasterOpen = useRef(masterOpen);
  useEffect(() => {
    if (wasMasterOpen.current && !masterOpen) close();
    wasMasterOpen.current = masterOpen;
  }, [masterOpen]);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const refresh = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; setCatalog(collectVisualParts()); setGeometry(value => value + 1); });
    };
    const observer = new MutationObserver(records => {
      if (records.some(record => !(record.target instanceof Element ? record.target : record.target.parentElement)?.closest(`${selectorChrome},${APPEARANCE_EDITOR}`))) refresh();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true,
      attributeFilter: ["class", "hidden", "open", "data-ui-native-hidden", "data-ui-native-icon", "data-ui-resident-root"] });
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", refresh); window.removeEventListener("scroll", refresh, true); };
  }, [active]);
  // Re-evaluate the pointed preview when resuming or changing the tool, not
  // when entering an editor. Meta-view toggles retain the pointed preview until
  // actual aiming motion; opening/closing chrome is not a new hover decision.
  useEffect(() => {
    if (phase !== "aim" || retainedPreview.current) return;
    const p = point.current;
    if (!p) return;
    const element = document.elementFromPoint(p.x, p.y);
    if (element) actions.current.pickAt(element, p.x, p.y);
  }, [phase, configuration, catalog, geometry]);
  useEffect(() => {
    document.documentElement.toggleAttribute("data-visual-selecting", phase === "aim");
    return () => document.documentElement.removeAttribute("data-visual-selecting");
  }, [phase]);
  const left = Math.max(8, Math.min(position.x - 88, innerWidth - 184));
  const top = Math.max(8, Math.min(position.y - 84, innerHeight - 242));
  const scopeChain = (scope: SelectionConstraint | null): SelectionConstraint[] => scope ? [...scopeChain(scope.scope ?? null), scope] : [];
  useEffect(() => {
    const scope = selection.scope, mask = selection.mask;
    if (!scope || !mask) return;
    setConfiguration(config => ({ ...config, ...mask, closed: scope.path?.kind === "freehand" ? scope.path.closed : config.closed }));
  }, [selection.scope, selection.mask]);
  const paths = [...scopeChain(selection.scope), (phase === "aim" || phase === "locked" || phase === "configure") && candidate?.definesScope ? candidate.rule : null].flatMap((constraint, index, constraints) => {
    const box = constraint && boundaryRect(constraint.boundary);
    return constraint?.path && box ? [{ key: `${index}:${constraintKey(constraint)}`, points: pathVertices(constraint.path, box),
      closed: constraint.path.closed, disabledEdges: constraint.path.disabledEdges ?? [], preview: index === constraints.length - 1 && !!candidate?.definesScope,
      include: index === constraints.length - 1 && candidate?.definesScope && (configuration.contour || configuration.region) ? candidate.rule.include : undefined }] : [];
  });
  const toggleEdge = (index: number) => updateScope(scope => {
    if (!scope.path) return scope;
    const disabled = scope.path.disabledEdges ?? [];
    return { ...scope, path: { ...scope.path, disabledEdges: disabled.includes(index) ? disabled.filter(edge => edge !== index) : [...disabled, index] } };
  });
  const inventory = inventoryOpen ? selfInventory(PROPERTY_REGISTRY, consumer => !TARGETS.find(target => target.id === consumer.id)?.hidden) : [];
  const inventoryRow = (target: SelfInventoryNode): ReactNode => <li key={target.id}>
    <button type="button" aria-pressed={selection.objects.includes(target.id)}
      title={`${selection.objects.includes(target.id) ? "Deselect" : "Select"} ${target.label}`}
      onClick={() => selectObject(target.id)}>{selection.objects.includes(target.id) ? "●" : "○"} {target.label}</button>
    {target.children.length > 0 && <ul>{target.children.map(inventoryRow)}</ul>}
  </li>;
  const activePath = workingScope?.path, activeBox = workingScope && boundaryRect(workingScope.boundary);
  const edges = activePath && activeBox ? pathEdges(pathVertices(activePath, activeBox), activePath.closed) : [];
  const liveFeedback: ComponentProps<typeof VisualSelectionOverlay> = {
    selected: feedbackSelected, excluded: noParts, preview, measurements,
    candidate: (phase === "aim" || phase === "locked" || phase === "configure") && candidate ? candidate.rule : null,
    guide: phase === "aim" || phase === "locked" || phase === "configure" ? guide : null, guides, paths,
  };
  return <Context.Provider value={contextValue}>
    {children}
    {active && feedbackVisible && createPortal(<VisualSelectionOverlay {...liveFeedback} />, document.body)}
    {(phase === "aim" || phase === "locked") && createPortal(<SelectorCursor parked={phase === "locked"} configuration={configuration} include={true} initial={phase === "locked" ? lockedPosition : point.current ?? position} />, document.body)}
    {phase === "edit" && createPortal(<SelectionController parts={editableParts} position={position} onClose={close} onResume={aim} />, document.body)}
    {phase === "configure" && createPortal(<div data-visual-selector className="visual-selector" role="dialog" aria-label="Visual selection controller"
      style={{ left, top }} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
      <SelectorSymbol configuration={configuration} include={true} precision patternBinding={shortcuts.binding("selector.pattern")} actions={{
        contour: () => shortcuts.invoke("selector.boundary"), pattern: () => shortcuts.invoke("selector.pattern"),
        region: side => shortcuts.invoke(side === "inside" ? "selector.inside" : "selector.outside"),
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
      <button type="button" className="visual-selector-inventory" data-ui-id="self-inventory" aria-label="Self inventory"
        aria-expanded={inventoryOpen} title="Self inventory" onClick={() => shortcuts.invoke("selector.selfInventory")}>◎</button>
      {inventoryOpen && <div className="visual-selector-self-inventory" role="region" aria-label="Self inventory"
        style={{ left: Math.max(8, Math.min(left + 184, innerWidth - 248)), top: Math.max(8, Math.min(top, innerHeight - 328)) }}>
        <header><strong>Self inventory</strong><button type="button" aria-label="Close Self inventory" onClick={() => setInventoryOpen(false)}>×</button></header>
        <ul>{inventory.map(inventoryRow)}</ul>
      </div>}
      <div className="visual-selector-tool-toggles" role="group" aria-label="Selector view and background detection">
        <SelectionPreviewToggle compact />
        <button type="button" aria-label="Lock MS and use normal cursor" title={`Lock / unlock MS (${shortcuts.binding("selector.lock") || "Unassigned"})`}
          onClick={() => shortcuts.invoke("selector.lock")}>Lock</button>
        <button type="button" data-ui-id="detect-bg" aria-label="Include BG in selection detection" aria-pressed={!!configuration.backgrounds}
          title={`BG: backgrounds / empty space. Shortcut: ${shortcuts.binding("selector.backgrounds") || "Unassigned (Shortcuts → Visual selector)"}. Preserves existing selections.`} onClick={() => shortcuts.invoke("selector.backgrounds")}>BG</button>
      </div>
      <div className="visual-selector-actions">
        <button type="button" aria-label="Undo selection operation" title={`Undo (${shortcuts.binding("selector.undo")})`} disabled={timeline.index === 0} onClick={() => shortcuts.invoke("selector.undo")}>↶</button>
        <button type="button" aria-label="Redo selection operation" title={`Redo (${shortcuts.binding("selector.redo")})`} disabled={timeline.index === timeline.states.length - 1} onClick={() => shortcuts.invoke("selector.redo")}>↷</button>
        <output aria-label={`${matches.included.length + selection.objects.length} selected targets`}>{matches.included.length + selection.objects.length}</output>
        <button type="button" aria-label="Clear visual selection" title="Clear selection" onClick={() => shortcuts.invoke("selector.clear")}>×</button>
        <button type="button" aria-label="Edit selected appearance" title={`Edit selected appearance (Shift + ${shortcuts.binding("selector.open") || "selector shortcut"})`} disabled={!hasSelection()} onClick={() => shortcuts.invoke("selector.edit")}>☷</button>
        <button type="button" aria-label={polygon.current ? "Finish polygon" : "Start aiming"} title={polygon.current ? "Finish polygon (Enter)" : `Resume selection (${shortcuts.binding("selector.open")})`}
          onClick={() => shortcuts.invoke(polygon.current ? "selector.finishGeometry" : "selector.aim")}>✓</button>
      </div>
      <details className="visual-selector-patterns">
        <summary title="Geometry modes, patterns and enabled edges">⠒</summary>
        {PATTERN_MODE_GROUPS.map(group => <fieldset key={group.label} className="visual-selector-mode-group">
          <legend>{group.label}</legend>
          <div className="visual-selector-modes" aria-label={group.label}>
            {group.modes.map(mode => <button type="button" key={mode} aria-label={`Selection mode: ${mode}`} aria-pressed={configuration.pattern === mode}
              title={mode === "boundary" ? "Use a pointed contour as the working geometry; wheel changes owner depth" : mode}
              onClick={() => chooseMode(mode)}>{PATTERN_SYMBOLS[mode]}</button>)}
          </div>
        </fieldset>)}
        {patternGroups.map(group => {
          const constraint: SelectionConstraint = { boundary: boundaryFor(document.body), ...(workingScope ? { scope: workingScope } : {}), role: group.role, backgrounds: configuration.backgrounds };
          const rule = selectionToggleRule(catalog, matches.included, constraint, measurements);
          return <div key={group.role}>
            <button type="button" aria-pressed={configuration.patternRole === group.role} title={`${group.parts.length} matching parts. Toggle pattern filter`}
              onClick={() => { setCandidatePick(null); setConfiguration(config => ({ ...config, patternRole: config.patternRole === group.role ? null : group.role })); }}>
              {roleSymbols[group.role]} {roleNames[group.role]} <small>{group.parts.length}</small>
            </button>
            <button type="button" aria-label={`Toggle ${roleNames[group.role]} selection`} aria-pressed={!rule.include}
              title={rule.include ? `Select ${roleNames[group.role]}` : `Deselect ${roleNames[group.role]}`}
              onClick={() => { toggleSelection(constraint); setCandidatePick(null); }}>{rule.include ? "○" : "●"}</button>
          </div>;
        })}
        {activePath && activePath.kind !== "ellipse" && edges.length > 0 && <div className="visual-selector-edges" aria-label="Geometry edges">
          {edges.map((_, index) => <button type="button" key={index} aria-label={`Geometry edge ${index + 1}`} aria-pressed={!activePath.disabledEdges?.includes(index)}
            title={`Toggle edge ${index + 1} intersections`} onClick={() => toggleEdge(index)}>{index + 1}</button>)}
        </div>}
      </details>
    </div>, document.body)}
  </Context.Provider>;
}

/** Shared view control: never clears membership or releases held feedback. */
export function SelectionPreviewToggle({ compact = false }: { compact?: boolean }) {
  const selection = useVisualSelection();
  if (!selection?.feedbackAvailable) return null;
  return <button type="button" className="selection-preview-toggle" data-ui-id="selection-preview" aria-label="Selection / Preview"
    aria-pressed={!selection.feedbackVisible} title={`${selection.feedbackVisible
      ? "Switch to Preview: hide selection marks, keep targets selected"
      : "Switch to Selection: show selected targets"}. Shortcut: ${selection.feedbackBinding || "Unassigned (Shortcuts → Visual selector)"}`} onClick={selection.toggleFeedback}>
    {compact ? (selection.feedbackVisible ? "Selection" : "Preview")
      : `${selection.feedbackVisible ? "Selection" : "Preview"} · ${selection.parts.length + selection.objects.length} selected`}
  </button>;
}
