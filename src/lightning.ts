/** Render-only contour and bolt geometry. Coordinates match a unit image/text plane. */
export type Point2 = { x: number; y: number };
export type Contour = { points: Point2[]; lengths: number[]; length: number; width: number; height: number };
export type Bolt = { points: Point2[]; strength: number };
const random = (n: number) => { const value = Math.sin(n * 127.1 + 311.7) * 43758.5453; return value - Math.floor(value); };
export function contour(points: Point2[], width: number, height: number): Contour {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot((points[i].x - points[i - 1].x) * width, (points[i].y - points[i - 1].y) * height));
  return { points, lengths, length: lengths.at(-1) ?? 0, width, height };
}
/** Trace every exposed alpha edge, including holes inside letters. No label-box background. */
export function alphaContours(data: Uint8ClampedArray, width: number, height: number): Contour[] {
  const stride = width + 1, edges = new Map<number, number[]>();
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3] >= 64;
  const add = (a: number, b: number) => { const list = edges.get(a); if (list) list.push(b); else edges.set(a, [b]); };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!filled(x, y)) continue;
    const a = y * stride + x, b = a + 1, d = a + stride, c = d + 1;
    if (!filled(x, y - 1)) add(a, b);
    if (!filled(x + 1, y)) add(b, c);
    if (!filled(x, y + 1)) add(c, d);
    if (!filled(x - 1, y)) add(d, a);
  }
  const result: Contour[] = [];
  while (edges.size && result.length < 128) {
    const start = edges.keys().next().value!;
    const path: Point2[] = []; let current = start;
    for (let step = 0; step < 16000; step++) {
      path.push({ x: current % stride, y: Math.floor(current / stride) });
      const next = edges.get(current); if (!next?.length) break;
      const target = next.pop()!; if (!next.length) edges.delete(current); current = target;
      if (current === start) { path.push(path[0]); break; }
    }
    if (path.length < 6) continue;
    const simple = path.filter((p, i) => i === 0 || i === path.length - 1 || (p.x - path[i - 1].x) * (path[i + 1].y - p.y) !== (p.y - path[i - 1].y) * (path[i + 1].x - p.x));
    const sampled = simple.filter((_, i) => i % Math.max(1, Math.ceil(simple.length / 256)) === 0);
    if (sampled.length < 3) continue;
    if (sampled.at(-1) !== sampled[0]) sampled.push(sampled[0]);
    result.push(contour(sampled.map(p => ({ x: p.x / width - 0.5, y: 0.5 - p.y / height })), width, height));
  }
  return result;
}
export function imageContours(image: CanvasImageSource): Contour[] {
  const source = image as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const width = source.naturalWidth || source.width || 0, height = source.naturalHeight || source.height || 0;
  if (!width || !height) return [];
  const scale = Math.min(1, 512 / Math.max(width, height));
  const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(width * scale)); canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return [];
  try { ctx.drawImage(image, 0, 0, canvas.width, canvas.height); return alphaContours(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height); }
  catch { return []; }
}
function sample(path: Contour, progress: number): Point2 {
  const distance = ((progress % 1 + 1) % 1) * path.length;
  let low = 1, high = path.lengths.length - 1;
  while (low < high) { const mid = (low + high) >> 1; if (path.lengths[mid] < distance) low = mid + 1; else high = mid; }
  const a = path.points[low - 1], b = path.points[low], span = path.lengths[low] - path.lengths[low - 1];
  const t = span > 0 ? (distance - path.lengths[low - 1]) / span : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
/** Stable spatial seeds, fast flicker and occasional local bridges within one representation. */
export function lightningBolts(paths: Contour[], seed: number, seconds: number, density: number, length = 0.35, animated = true): Bolt[] {
  const available = paths.filter(path => path.length > 0 && path.points.length > 2);
  if (!available.length || density <= 0) return [];
  const time = animated ? seconds * 3 : 0, frame = Math.floor(time * 24), count = Math.ceil(density * Math.min(8, Math.max(2, available.length / 2)));
  const bolts: Bolt[] = [];
  for (let i = 0; i < count; i++) {
    const key = seed * 100 + i * 7.13, period = 1 + random(key) * 1.3;
    const phase = (time + random(key + 1) * period) % period;
    const flash = animated && (phase < 0.11 || phase > 0.18 && phase < 0.22);
    const strength = flash ? 0.85 + 0.15 * random(frame + key) : 0.12 + 0.1 * random(frame + key);
    const path = available[Math.floor(random(key + Math.floor(time / period)) * available.length)];
    const start = random(key + 2) + time * 0.045, span = 0.04 + length * 0.45, jitter = Math.min(path.width, path.height) * (0.008 + length * 0.014);
    const points: Point2[] = [];
    for (let j = 0; j <= 16; j++) {
      const p = sample(path, start + span * j / 16);
      const offset = Math.sin(Math.PI * j / 16) * (random(frame * 13 + key + j * 3.7) - 0.5) * jitter;
      points.push({ x: p.x + offset / path.width, y: p.y + (random(key + j) - 0.5) * offset / path.height });
    }
    bolts.push({ points, strength });
    if (flash && random(key + 9) > 0.4) {
      const origin = points[8], other = available[Math.floor(random(key + 11) * available.length)];
      let target: Point2 | undefined, nearest = Math.min(path.width, path.height) * 0.17;
      // Nearby inner/outer strokes or neighboring glyphs, never other graph identities.
      for (let k = 0; k < 24; k++) {
        const candidate = sample(other, k / 24), distance = Math.hypot((candidate.x - origin.x) * path.width, (candidate.y - origin.y) * path.height);
        if (distance > 2 && distance < nearest) { nearest = distance; target = candidate; }
      }
      if (target) bolts.push({ strength: strength * 0.65, points: Array.from({ length: 7 }, (_, j) => {
        const t = j / 6, offset = Math.sin(Math.PI * t) * (random(frame + key + j) - 0.5) * jitter * 2;
        return { x: origin.x + (target!.x - origin.x) * t + offset / path.width, y: origin.y + (target!.y - origin.y) * t - offset / path.height };
      }) });
    }
  }
  return bolts;
}
