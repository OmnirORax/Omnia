/** Screen-space geometry shared by pattern matching and its visible guide. */
export type Point = { x: number; y: number };
export type SelectionSide = "inside" | "outside";
export type SelectionRegion = SelectionSide | "both";
export function toggleSelectionRegion(region: SelectionRegion | null, side: SelectionSide): SelectionRegion | null {
  const inside = side === "inside" ? !(region === "inside" || region === "both") : region === "inside" || region === "both";
  const outside = side === "outside" ? !(region === "outside" || region === "both") : region === "outside" || region === "both";
  return inside && outside ? "both" : inside ? "inside" : outside ? "outside" : null;
}
export const regionAllows = (region: SelectionRegion, inside: boolean) => region === "both" || (region === "inside" ? inside : !inside);
export type Box = { left: number; top: number; right: number; bottom: number };
export type PatternMode = "item" | "pattern" | "axis" | "direction" | "position" | "boundary" | "rectangle" | "ellipse" | "polygon" | "freehand";
export type LineCondition = {
  mode: "axis" | "direction" | "position";
  /** Relative to the boundary rectangle, so moving/resizing its owner follows it. */
  start: Point;
  end: Point;
  bounded: boolean;
  rotation?: number;
  stopAtPaint?: string;
};
export const PATTERN_MODES: PatternMode[] = ["item", "boundary", "pattern", "axis", "direction", "position", "rectangle", "ellipse", "polygon", "freehand"];
export const PATTERN_SYMBOLS: Record<PatternMode, string> = { item: "·", boundary: "○", pattern: "⠒", axis: "↕", direction: "↑", position: "|", rectangle: "▭", ellipse: "◯", polygon: "⬡", freehand: "〰" };
export const nextPatternMode = (mode: PatternMode) => PATTERN_MODES[(PATTERN_MODES.indexOf(mode) + 1) % PATTERN_MODES.length];
export const boxFromPoints = (a: Point, b: Point): Box => ({ left: Math.min(a.x, b.x), right: Math.max(a.x, b.x), top: Math.min(a.y, b.y), bottom: Math.max(a.y, b.y) });
export const boxesTouch = (a: Box, b: Box) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
export function intersectBoxes(a: Box, b: Box): Box | null {
  const intersection = { left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) };
  return intersection.left <= intersection.right && intersection.top <= intersection.bottom ? intersection : null;
}
export const relativePoint = (point: Point, box: Box): Point => ({ x: (point.x - box.left) / Math.max(1, box.right - box.left), y: (point.y - box.top) / Math.max(1, box.bottom - box.top) });
export const absolutePoint = (point: Point, box: Box): Point => ({ x: box.left + point.x * (box.right - box.left), y: box.top + point.y * (box.bottom - box.top) });
export function conditionPoints(line: LineCondition, box: Box): [Point, Point] {
  return rotatePoints([absolutePoint(line.start, box), absolutePoint(line.end, box)], line.rotation ?? 0) as [Point, Point];
}
export function lineDomain(line: Pick<LineCondition, "mode" | "bounded">): [number, number] {
  return line.bounded || line.mode === "position" ? [0, 1] : line.mode === "direction" ? [0, Infinity] : [-Infinity, Infinity];
}
/** Slab clipping includes anything touched, without turning the line into a marquee. */
export function lineBoxInterval(start: Point, end: Point, box: Box, domain: [number, number], tolerance = 0): [number, number] | null {
  let [low, high] = domain;
  const dx = end.x - start.x, dy = end.y - start.y;
  if (Math.hypot(dx, dy) < .001) return null;
  for (const [origin, delta, min, max] of [[start.x, dx, box.left - tolerance, box.right + tolerance], [start.y, dy, box.top - tolerance, box.bottom + tolerance]]) {
    if (Math.abs(delta) < .000001) { if (origin < min || origin > max) return null; continue; }
    const a = (min - origin) / delta, b = (max - origin) / delta;
    low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b));
    if (low > high) return null;
  }
  return [low, high];
}
export function clippedLine(line: LineCondition, box: Box, clip: Box): [Point, Point] | null {
  const [start, end] = conditionPoints(line, box);
  const interval = lineBoxInterval(start, end, clip, lineDomain(line));
  return interval ? interval.map(t => ({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })) as [Point, Point] : null;
}
/** Stop independently in each direction at the first differently painted peer.
 * Gaps are not a terminating peer. Overlapping parts at the origin do not stop it. */
export function paintStopDomain(samples: { interval: [number, number]; paint: string }[], source: string, domain: [number, number]): [number, number] {
  let [low, high] = domain;
  for (const { interval: [a, b], paint } of samples) {
    if (paint === source || (a <= 0 && b >= 0)) continue;
    if (a > 0) high = Math.min(high, a);
    if (b < 0) low = Math.max(low, b);
  }
  return [low, high];
}

/** A path is relative to its owner, just like the existing line conditions. */
export type PathCondition = {
  kind: "rectangle" | "ellipse" | "polygon" | "freehand";
  points: Point[];
  closed: boolean;
  disabledEdges?: number[];
  rotation?: number;
};
function unrotatedPathVertices(path: PathCondition, owner: Box): Point[] {
  const points = path.points.map(point => absolutePoint(point, owner));
  if (path.kind !== "rectangle" && path.kind !== "ellipse") return points;
  if (points.length < 2) return points;
  const box = boxFromPoints(points[0], points.at(-1)!);
  if (path.kind === "rectangle") return [
    { x: box.left, y: box.top }, { x: box.right, y: box.top },
    { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom },
  ];
  const cx = (box.left + box.right) / 2, cy = (box.top + box.bottom) / 2;
  return Array.from({ length: 64 }, (_, index) => {
    const angle = index * Math.PI / 32;
    return { x: cx + Math.cos(angle) * (box.right - box.left) / 2, y: cy + Math.sin(angle) * (box.bottom - box.top) / 2 };
  });
}
export function pathEdges(points: Point[], closed: boolean): [Point, Point][] {
  return points.length < 2 ? [] : points.slice(0, closed ? points.length : -1).map((point, index) => [point, points[(index + 1) % points.length]]);
}
export function polygonContains(points: Point[], point: Point): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
/** Boundary intersections use enabled edges; filling uses the complete closed
 * shape (even-odd for self intersections). Open paths have no inside/outside. */
export function pathTouchesBox(path: PathCondition, owner: Box, box: Box, contour: boolean, region?: SelectionRegion, points = pathVertices(path, owner)): boolean {
  const edges = pathEdges(points, path.closed);
  const crossed = edges.map(([a, b]) => !!lineBoxInterval(a, b, box, [0, 1], .5));
  if (contour && crossed.some((hit, index) => hit && !path.disabledEdges?.includes(index))) return true;
  if (!path.closed || points.length < 3 || !region) return false;
  if (region === "both") return true;
  const corners = [{ x: box.left, y: box.top }, { x: box.right, y: box.top }, { x: box.right, y: box.bottom }, { x: box.left, y: box.bottom }];
  const contained = corners.map(point => polygonContains(points, point));
  const crossing = crossed.some(Boolean);
  const enclosesShape = points.some(point => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom);
  return region === "inside" ? crossing || contained.some(Boolean) || enclosesShape : crossing || !contained.every(Boolean);
}

/** Rotation is in screen space, so non-square owners do not distort angles. */
export function rotatePoints(points: Point[], degrees: number): Point[] {
  if (!points.length || !degrees) return points;
  const cx = (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2;
  const cy = (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2;
  const angle = degrees * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  return points.map(p => ({ x: cx + (p.x - cx) * cos - (p.y - cy) * sin, y: cy + (p.x - cx) * sin + (p.y - cy) * cos }));
}
export const pathVertices = (path: PathCondition, owner: Box) => rotatePoints(unrotatedPathVertices(path, owner), path.rotation ?? 0);

/** Rotation applies to an armed drawing mode before placement too. Exact input
 * deltas vary: Shift-wheel may arrive on deltaX, or use line/page units. */
export function selectionWheelRotation(event: Pick<WheelEvent, "shiftKey" | "deltaX" | "deltaY" | "deltaMode">, mode: PatternMode, hasGeometry: boolean, pageHeight: number): { target: "pending" | "placed"; degrees: number } | null {
  if (!event.shiftKey) return null;
  const pending = mode !== "pattern" && mode !== "item";
  if (!pending && !hasGeometry) return null;
  const pixels = (event.deltaY || event.deltaX) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? pageHeight : 1);
  return pixels ? { target: pending ? "pending" : "placed", degrees: Math.max(-2, Math.min(2, pixels * .02)) } : null;
}
