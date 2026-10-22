/** Screen-space geometry shared by pattern matching and its visible guide. */
export type Point = { x: number; y: number };
export type Box = { left: number; top: number; right: number; bottom: number };
export type PatternMode = "item" | "pattern" | "axis" | "direction" | "position";
export type LineCondition = {
  mode: "axis" | "direction" | "position";
  /** Relative to the boundary rectangle, so moving/resizing its owner follows it. */
  start: Point;
  end: Point;
  bounded: boolean;
  stopAtPaint?: string;
};
export const PATTERN_MODES: PatternMode[] = ["item", "pattern", "axis", "direction", "position"];
export const PATTERN_SYMBOLS: Record<PatternMode, string> = { item: "·", pattern: "⠒", axis: "↕", direction: "↑", position: "|" };
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
  return [absolutePoint(line.start, box), absolutePoint(line.end, box)];
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
