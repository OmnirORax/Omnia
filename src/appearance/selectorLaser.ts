/** One timing/geometry source for actual selector feedback and its live sample.
 * Spark placement is deterministic and bounded; animation uses native paint only. */
export const SELECTOR_PULSE_MS = 2600;
export const SELECTOR_SPARKLE_BUDGET = 20;
export type SparkleBox = { key: string; x: number; y: number; width: number; height: number; rx?: number; ry?: number };
export type LaserSparkle = { x: number; y: number; scale: number; delay: number };
export function laserSparkles(box: SparkleBox, limit: number, surface = false): LaserSparkle[] {
  if (box.width < 6 || box.height < 6 || limit <= 0) return [];
  let seed = 2166136261;
  for (const char of box.key) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const random = () => { seed = Math.imul(seed, 1664525) + 1013904223; return (seed >>> 0) / 4294967296; };
  const count = Math.min(Math.floor(limit), surface ? 12 : Math.max(2, Math.min(8, Math.ceil((box.width + box.height) / 170))));
  const insetX = Math.min(box.width / 2, Math.max(4, box.rx ?? 0));
  const insetY = Math.min(box.height / 2, Math.max(4, box.ry ?? 0));
  return Array.from({ length: count }, (_, index) => {
    const along = .08 + random() * .84;
    let x = insetX + along * (box.width - insetX * 2), y = insetY + random() * (box.height - insetY * 2);
    if (!surface) {
      const edge = index % 4;
      if (edge === 0) y = 1;
      else if (edge === 1) x = box.width - 1;
      else if (edge === 2) y = box.height - 1;
      else x = 1;
    }
    return { x: box.x + x, y: box.y + y, scale: .55 + random() * .65, delay: -random() * 3.7 };
  });
}
