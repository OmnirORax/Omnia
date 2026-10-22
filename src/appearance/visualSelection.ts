import { TARGETS, type RegisteredTarget } from "./registry.ts";
import { scenePartAt, scenePartPaint } from "./sceneFeedback.ts";
import { effectScope } from "./uiEffects.ts";
import { absolutePoint, boxFromPoints, boxesTouch, conditionPoints, intersectBoxes, lineBoxInterval, lineDomain, paintStopDomain,
  regionAllows, pathTouchesBox, pathVertices, type PathCondition, type Box, type LineCondition, type Point, type SelectionRegion } from "./selectionGeometry.ts";

export type VisualRole = "text" | "background" | "contour" | "icon" | "indicator";
export type VisualPart = {
  key: string;
  element: HTMLElement | SVGElement;
  target: RegisteredTarget;
  role: VisualRole;
  range?: Range;
};
export type SelectionBoundary = {
  element: Element;
  /** Optional custom rectangle, normalized to the stable owner's rectangle. */
  area?: Box;
  attribute?: "data-ui-function" | "data-ui-resident-root";
  value?: string;
  key: string;
};
export type SelectionConstraint = {
  boundary: SelectionBoundary;
  region?: SelectionRegion;
  role?: VisualRole;
  part?: string;
  line?: LineCondition;
  path?: PathCondition;
  contour?: boolean;
  geometryId?: string;
  ownerFrame?: boolean;
  framePart?: string;
  scope?: SelectionConstraint;
};
export type SelectionRule = SelectionConstraint & { include: boolean; implicit?: boolean };
export const selectorChrome = "[data-visual-selector]";
const ignored = `${selectorChrome},[hidden],[data-shortcut-runner],[data-ui-palette],[data-ui-native-hidden],omnium-appearance-recovery`;
const ids = new WeakMap<Node, number>();
let sequence = 0;
const keyFor = (node: Node) => {
  let key = ids.get(node);
  if (!key) { key = ++sequence; ids.set(node, key); }
  return key;
};
export function roleFor(target: RegisteredTarget): VisualRole | undefined {
  if (target.binding?.selection) return target.binding.selection.role;
  if (target.binding?.text) return "text";
  if (target.binding?.animation?.kind === "icons") return "icon";
  return ({ "background-color": "background", "border-color": "contour", "accent-color": "indicator" } as const)[
    target.binding?.css as "background-color" | "border-color" | "accent-color"
  ];
}
const visible = (element: Element) => !element.closest(ignored) && !!element.getClientRects().length &&
  getComputedStyle(element).visibility !== "hidden";

/** Discover real UI parts from the same bindings used by the hierarchy/renderers. */
export function collectVisualParts(): VisualPart[] {
  const parts: VisualPart[] = [];
  const queries = new Map<string, Element[]>();
  const seen = new Set<string>();
  for (const target of TARGETS) {
    if (target.aggregate || !(target.binding?.selection?.selector || target.binding?.selector)) continue;
    const role = roleFor(target);
    if (!role) continue;
    const selector = (target.binding.selection?.selector ?? (role === "icon" ? target.binding.animation?.selector ?? target.binding.selector : target.binding.selector))!
      .replace(/::placeholder/g, "");
    let elements = queries.get(selector);
    if (!elements) {
      elements = [...document.querySelectorAll(selector)].filter(visible);
      queries.set(selector, elements);
    }
    for (const element of elements) {
      if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
      const add = (node: Node, range?: Range) => {
        const key = `${target.id}:${keyFor(node)}`;
        if (seen.has(key)) return;
        seen.add(key);
        const parent = range?.startContainer.parentElement ?? element;
        if (!(parent instanceof HTMLElement || parent instanceof SVGElement)) return;
        parts.push({ key, element: parent, target, role, range });
      };
      if (role === "text" && element instanceof HTMLElement) {
        const scope = effectScope(target, element);
        if (element.matches("input,textarea,select")) {
          if (element.matches('input[type="checkbox"],input[type="radio"],input[type="range"],input[type="color"],input[type="hidden"]')) continue;
          if (scope.input?.(element)) add(element);
          continue;
        }
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (!node.textContent?.trim() || !parent || !visible(parent) || !scope.text?.(parent)) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          if ([...range.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)) add(node, range);
        }
      } else {
        if (role === "contour") {
          const style = getComputedStyle(element);
          if (!["Top", "Right", "Bottom", "Left"].some(side =>
            parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0 &&
            style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none")) continue;
        }
        add(element);
      }
    }
  }
  return parts;
}

export function boundaryFor(element: Element): SelectionBoundary {
  const attribute = element.hasAttribute("data-ui-function") ? "data-ui-function" :
    element.hasAttribute("data-ui-resident-root") ? "data-ui-resident-root" : undefined;
  const value = attribute ? element.getAttribute(attribute)! : undefined;
  return { element, attribute, value,
    key: element === document.body ? "app" : attribute ? `${attribute}:${value}` : `element:${keyFor(element)}` };
}
export function boundaryElement(boundary: SelectionBoundary): Element | undefined {
  if (boundary.element.isConnected && visible(boundary.element)) return boundary.element;
  if (boundary.attribute && boundary.value)
    return [...document.querySelectorAll(`[${boundary.attribute}="${CSS.escape(boundary.value)}"]`)].find(visible);
}
export function boundaryRect(boundary: SelectionBoundary): Box | undefined {
  const root = boundaryElement(boundary);
  if (!root) return;
  const rect: Box = root === document.body ? { left: 0, top: 0, right: innerWidth, bottom: innerHeight } : root.getBoundingClientRect();
  return boundary.area ? boxFromPoints(absolutePoint({ x: boundary.area.left, y: boundary.area.top }, rect),
    absolutePoint({ x: boundary.area.right, y: boundary.area.bottom }, rect)) : rect;
}
export function partRects(part: VisualPart): Box[] {
  const rects = [...(part.range ? part.range.getClientRects() : part.element.getClientRects())];
  if (part.role !== "contour") return rects;
  const style = getComputedStyle(part.element);
  // A line contained wholly in a frame's interior does not touch its contour.
  return rects.flatMap(rect => [
    { left: rect.left, top: rect.top, right: rect.right, bottom: rect.top + parseFloat(style.borderTopWidth || "0") },
    { left: rect.right - parseFloat(style.borderRightWidth || "0"), top: rect.top, right: rect.right, bottom: rect.bottom },
    { left: rect.left, top: rect.bottom - parseFloat(style.borderBottomWidth || "0"), right: rect.right, bottom: rect.bottom },
    { left: rect.left, top: rect.top, right: rect.left + parseFloat(style.borderLeftWidth || "0"), bottom: rect.bottom },
  ].filter(strip => strip.right > strip.left && strip.bottom > strip.top));
}
export function pointInBoundary(boundary: SelectionBoundary, element: Element, point: Point): boolean {
  const root = boundaryElement(boundary), rect = boundaryRect(boundary);
  return !!root?.contains(element) && !!rect && point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}
/** Boundary candidates must fit wholly in the chosen working region. In
 * particular, climbing to an ancestor must not flash the rest of the app. */
export function boundaryInRegion(candidate: SelectionBoundary, boundary: SelectionBoundary, region: SelectionRegion): boolean {
  const candidateRoot = boundaryElement(candidate), root = boundaryElement(boundary);
  const rect = boundaryRect(candidate), bounds = boundaryRect(boundary);
  if (!candidateRoot || !root || !rect || !bounds) return false;
  if (region === "both") return true;
  if (region === "inside") return (!!candidate.area || root.contains(candidateRoot)) && rect.left >= bounds.left && rect.right <= bounds.right &&
    rect.top >= bounds.top && rect.bottom <= bounds.bottom;
  return (!!candidate.area || (!root.contains(candidateRoot) && !candidateRoot.contains(root))) &&
    (rect.right <= bounds.left || rect.left >= bounds.right || rect.bottom <= bounds.top || rect.top >= bounds.bottom);
}
export function boundaryCandidates(element: Element): SelectionBoundary[] {
  const candidates: SelectionBoundary[] = [];
  for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
    if (node.matches("[data-ui-resident-root],[data-ui-function],button,input,textarea,select,.toolbar,.sidebar,.ui-dock-group,.ui-dock-split"))
      candidates.push(boundaryFor(node));
  }
  candidates.push(boundaryFor(document.body));
  return candidates;
}
const containsPoint = (rect: DOMRect, x: number, y: number) =>
  x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
// Catalog identity is the invalidation boundary: discovery after structure/layout
// changes replaces it. Cache relationships only; current geometry and scene hits
// are still read at the pointer so movement never uses stale rectangles.
const hitIndexes = new WeakMap<VisualPart[], WeakMap<Element, { ancestors: VisualPart[]; text: VisualPart[] }>>();
export function partAt(parts: VisualPart[], element: Element, x: number, y: number): VisualPart | undefined {
  let index = hitIndexes.get(parts);
  if (!index) { index = new WeakMap(); hitIndexes.set(parts, index); }
  let hit = index.get(element);
  if (!hit) {
    hit = { ancestors: parts.filter(part => part.element === element || part.element.contains(element)),
      text: parts.filter(part => part.role === "text" && part.range &&
        (part.element === element || part.element.contains(element) || element.contains(part.element))) };
    index.set(element, hit);
  }
  const candidates = hit.ancestors.filter(part => !part.target.binding?.selection || scenePartAt(part.target.id, part.element, x, y));
  // Artwork, actual text ink, then border proximity distinguish overlapping paint
  // on the same component. Background is the final fallback, not the text's box.
  const icon = candidates.find(part => part.role === "icon" && containsPoint(part.element.getBoundingClientRect(), x, y));
  if (icon) return icon;
  const text = hit.text.find(part => [...part.range!.getClientRects()].some(rect => containsPoint(rect, x, y)));
  if (text) return text;
  const depth = (part: VisualPart) => {
    let node: Element | null = element, depth = 0;
    while (node && node !== part.element) { depth++; node = node.parentElement; }
    return depth;
  };
  candidates.sort((a, b) => depth(a) - depth(b));
  const contour = candidates.find(part => {
    if (part.role !== "contour") return false;
    const rect = part.element.getBoundingClientRect();
    return containsPoint(rect, x, y) && Math.min(x - rect.left, rect.right - x, y - rect.top, rect.bottom - y) <= 5;
  });
  return contour ?? candidates.find(part => part.role === "indicator") ??
    candidates.find(part => part.role === "text" && !part.range &&
      part.element.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),textarea,select')) ??
    candidates.find(part => part.role === "background");
}
function partMeasurements() {
  const rects = new Map<VisualPart, Box[]>(), paint = new Map<VisualPart, string>();
  return {
    rects: (part: VisualPart) => {
      let value = rects.get(part); if (!value) { value = partRects(part); rects.set(part, value); } return value;
    },
    paint: (part: VisualPart) => {
      let value = paint.get(part);
      if (value === undefined) { value = partPaint(part); paint.set(part, value); }
      return value;
    },
  };
}
export function partPaint(part: VisualPart): string {
  if (part.target.binding?.selection) return scenePartPaint(part.target.id, part.element) ?? "transparent";
  const style = getComputedStyle(part.element, part.target.id === "text.ui.placeholders" ? "::placeholder" : null);
  // Feedback ink is temporary. Its adapter preserves the actual source for sampling.
  const source = part.element.hasAttribute("data-visual-selection-ink") ? style.getPropertyValue("--omnium-selector-source-color").trim() : "";
  return part.role === "background" ? style.backgroundColor : part.role === "contour" ? style.borderTopColor :
    part.role === "indicator" ? style.accentColor : source || style.color;
}
function constraintGeometry(parts: VisualPart[], rule: SelectionConstraint, measure: ReturnType<typeof partMeasurements>):
  { peers: VisualPart[]; start?: Point; end?: Point; domain?: [number, number]; box?: Box } {
  const source = rule.scope ? constraintGeometry(parts, rule.scope, measure).peers : parts;
  const root = boundaryElement(rule.boundary), box = boundaryRect(rule.boundary);
  const vertices = rule.path && box ? pathVertices(rule.path, box) : undefined;
  const peers = root && box ? source.filter(part => {
    const inside = root.contains(part.element) && (!rule.boundary.area || measure.rects(part).some(rect => boxesTouch(rect, box)));
    // Paths define their own inside/outside. The owner merely anchors coordinates.
    const frameItself = part.key === rule.framePart || rule.ownerFrame && part.element === root && !part.range && (part.role === "background" || part.role === "contour");
    const inRegion = frameItself ? rule.contour !== false : rule.path ?
      (rule.region === "outside" || rule.region === "both" || root.contains(part.element)) && measure.rects(part).some(rect => pathTouchesBox(rule.path!, box, rect, rule.contour !== false, rule.region, vertices)) :
      regionAllows(rule.region ?? "inside", inside);
    return inRegion && (!rule.role || rule.role === part.role) && (!rule.part || rule.part === part.key);
  }) : [];
  if (!rule.line || !box) return { peers };
  const line = rule.line, [start, end] = conditionPoints(line, box), domain = lineDomain(line);
  const hits = (rule.contour === false ? [] : peers).flatMap(part => measure.rects(part).flatMap(rect => {
    const local = rule.region === "outside" || rule.region === "both" ? rect : intersectBoxes(rect, box);
    const interval = local && lineBoxInterval(start, end, local, domain, 0);
    return interval ? [{ part, interval, paint: line.stopAtPaint === undefined ? "" : measure.paint(part) }] : [];
  }));
  const stopped = line.stopAtPaint === undefined ? domain : paintStopDomain(hits, line.stopAtPaint, domain);
  return { peers: [...new Set(hits.filter(({ interval: [a, b] }) => a <= stopped[1] && b >= stopped[0] &&
    !(stopped[1] < domain[1] && a >= stopped[1]) && !(stopped[0] > domain[0] && b <= stopped[0])).map(hit => hit.part))],
    start, end, domain: stopped, box };
}
function ruleGeometry(parts: VisualPart[], rule: SelectionRule, measure: ReturnType<typeof partMeasurements>) {
  return constraintGeometry(parts, rule, measure);
}
export function matchingVisualParts(parts: VisualPart[], rule: SelectionRule): VisualPart[] {
  return ruleGeometry(parts, rule, partMeasurements()).peers;
}
/** The guide uses the same geometry/paint stop as actual matching. */
export function selectionLineGuide(parts: VisualPart[], rule: SelectionRule): [Point, Point] | null {
  if (!rule.line) return null;
  const geometry = ruleGeometry(parts, rule, partMeasurements());
  if (!geometry.box || !geometry.start || !geometry.end || !geometry.domain) return null;
  const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const region = rule.region === "outside" || rule.region === "both" ? viewport : intersectBoxes(viewport, geometry.box);
  const clip = region && lineBoxInterval(geometry.start, geometry.end, region, geometry.domain);
  if (!clip) return null;
  return clip.map(t => ({ x: geometry.start!.x + (geometry.end!.x - geometry.start!.x) * t,
    y: geometry.start!.y + (geometry.end!.y - geometry.start!.y) * t })) as [Point, Point];
}
export function resolveVisualSelection(parts: VisualPart[], boundary: SelectionBoundary | null, rules: SelectionRule[]): { included: VisualPart[]; excluded: VisualPart[] } {
  const result = { included: [] as VisualPart[], excluded: [] as VisualPart[] };
  if (!boundary || !boundaryElement(boundary)) return result;
  const measure = partMeasurements(), states = new Map<VisualPart, SelectionRule>();
  for (const rule of rules) for (const part of ruleGeometry(parts, rule, measure).peers) states.set(part, rule);
  for (const part of parts) {
    const state = states.get(part);
    if (state?.include) result.included.push(part);
    else if (state && !state.implicit) result.excluded.push(part);
  }
  return result;
}

/** Prevent a large background/ancestor part from previewing a local selection
 * when the pointer itself is outside the enabled closed-shape regions. */
export function pointerInSelectionScope(scope: SelectionConstraint, element: Element, point: Point): boolean {
  if (scope.scope && !pointerInSelectionScope(scope.scope, element, point)) return false;
  if (!scope.path) return true; // Open line scope is tested against the hit part.
  const owner = boundaryRect(scope.boundary), root = boundaryElement(scope.boundary);
  if (!owner || !root) return false;
  if (scope.region !== "outside" && scope.region !== "both" && !root.contains(element)) return false;
  return pathTouchesBox(scope.path, owner, { left: point.x, right: point.x, top: point.y, bottom: point.y }, scope.contour !== false, scope.region);
}
