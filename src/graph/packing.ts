import type { XYZ } from "./structural.ts";
export type Box3 = { min: XYZ; max: XYZ };
const axes = ["x", "y", "z"] as const;
export const translateBox = (box: Box3, p: XYZ): Box3 => ({
  min: { x: box.min.x + p.x, y: box.min.y + p.y, z: box.min.z + p.z },
  max: { x: box.max.x + p.x, y: box.max.y + p.y, z: box.max.z + p.z },
});
export const enclosingBox = (boxes: Box3[]): Box3 => ({
  min: {
    x: Math.min(...boxes.map((b) => b.min.x)),
    y: Math.min(...boxes.map((b) => b.min.y)),
    z: Math.min(...boxes.map((b) => b.min.z)),
  },
  max: {
    x: Math.max(...boxes.map((b) => b.max.x)),
    y: Math.max(...boxes.map((b) => b.max.y)),
    z: Math.max(...boxes.map((b) => b.max.z)),
  },
});
const overlaps = (a: Box3, b: Box3, gap: number) =>
  axes.every((k) => a.min[k] < b.max[k] + gap - 1e-6 && a.max[k] > b.min[k] - gap + 1e-6);
/** Shorten one branch along its authored ray without passing through neighbors.
 * A close obstacle limits this branch only, rather than the entire atlas. */
export function contractAlongRay(shape: Box3, start: XYZ, anchor: XYZ, obstacles: Box3[], gap: number): XYZ {
  const direction = { x: start.x - anchor.x, y: start.y - anchor.y, z: start.z - anchor.z };
  if (Math.hypot(direction.x, direction.y, direction.z) < 1e-9) return start;
  let scale = 0, upper = 1;
  for (const obstacle of obstacles) {
    let enter = -Infinity, exit = Infinity;
    for (const axis of axes) {
      const low = obstacle.min[axis] - gap - shape.max[axis];
      const high = obstacle.max[axis] + gap - shape.min[axis];
      if (Math.abs(direction[axis]) < 1e-12) {
        if (anchor[axis] <= low + 1e-8 || anchor[axis] >= high - 1e-8) { exit = -Infinity; break; }
      } else {
        const a = (low - anchor[axis]) / direction[axis], b = (high - anchor[axis]) / direction[axis];
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
      }
    }
    if (enter >= exit - 1e-12 || exit <= 0 || enter >= 1) continue;
    if (exit > 1 + 1e-9) upper = Math.min(upper, enter); // An existing overlap can only clear inward.
    else scale = Math.max(scale, exit);
  }
  if (scale > upper + 1e-9 || upper < 0) return start;
  scale = Math.min(1, Math.max(0, scale));
  const result = { x: anchor.x + direction.x * scale, y: anchor.y + direction.y * scale, z: anchor.z + direction.z * scale };
  return Math.hypot(result.x - start.x, result.y - start.y, result.z - start.z) < 1e-8 ? start : result;
}
/** Face-aligned packing leaves clearance, rather than inheriting large authored gaps or snap cells. */
export function packedPosition(
  shape: Box3,
  obstacles: Box3[],
  cluster: Box3[],
  clearance: number,
): XYZ {
  const candidates: XYZ[] = [{ x: 0, y: 0, z: 0 }];
  for (const b of obstacles)
    for (const axis of axes) {
      const rest = axes.filter((k) => k !== axis);
      for (const side of [
        b.min[axis] - shape.max[axis] - clearance,
        b.max[axis] - shape.min[axis] + clearance,
      ])
        for (const u of [
          0,
          b.min[rest[0]] - shape.min[rest[0]],
          b.max[rest[0]] - shape.max[rest[0]],
        ])
          for (const v of [
            0,
            b.min[rest[1]] - shape.min[rest[1]],
            b.max[rest[1]] - shape.max[rest[1]],
          ]) {
            const p = { x: 0, y: 0, z: 0 };
            p[axis] = side;
            p[rest[0]] = u;
            p[rest[1]] = v;
            candidates.push(p);
          }
    }
  const anchor = cluster.length
    ? enclosingBox(cluster)
    : { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  const scored = candidates
    .map((p) => {
      const box = translateBox(shape, p),
        bounds = enclosingBox([anchor, box]);
      const dimensions = axes.map((k) => bounds.max[k] - bounds.min[k]);
      return {
        p,
        box,
        span: Math.max(...dimensions),
        volume: dimensions.reduce((a, b) => a * b, 1),
        distance: Math.hypot(p.x, p.y, p.z),
      };
    })
    .sort(
      (a, b) =>
        a.span - b.span ||
        a.volume - b.volume ||
        a.distance - b.distance ||
        b.p.x - a.p.x ||
        a.p.y - b.p.y ||
        a.p.z - b.p.z,
    );
  for (const { p, box } of scored)
    if (!obstacles.some((b) => overlaps(box, b, clearance))) return p;
  // An unobstructed outer face always exists, even for a heavily occupied selection.
  return { x: Math.max(0, ...obstacles.map((b) => b.max.x)) - shape.min.x + clearance, y: 0, z: 0 };
}
