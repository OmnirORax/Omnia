export type ResizeRect = { x: number; y: number; width: number; height: number };
const equal = (a: ResizeRect, b: ResizeRect) => ["x", "y", "width", "height"].every(key => Math.abs(a[key as keyof ResizeRect] - b[key as keyof ResizeRect]) < 1);
/** One geometry snapshot per invocation; no layout reads while hovering choices. */
export function resizeLevels(current: ResizeRect, frames: ResizeRect[], viewport: ResizeRect): ResizeRect[] {
  const right = current.x + current.width, bottom = current.y + current.height;
  const edges = (values: number[], min: number, max: number, descending: boolean) => [...new Set(values.filter(value => value >= min && value <= max))].sort((a, b) => descending ? b - a : a - b);
  const lefts = edges([...frames.flatMap(r => [r.x, r.x + r.width]), viewport.x], viewport.x, current.x - 1, true);
  const rights = edges([...frames.flatMap(r => [r.x, r.x + r.width]), viewport.x + viewport.width], right + 1, viewport.x + viewport.width, false);
  const tops = edges([...frames.flatMap(r => [r.y, r.y + r.height]), viewport.y], viewport.y, current.y - 1, true);
  const bottoms = edges([...frames.flatMap(r => [r.y, r.y + r.height]), viewport.y + viewport.height], bottom + 1, viewport.y + viewport.height, false);
  const result: ResizeRect[] = [];
  const count = Math.min(9, Math.max(lefts.length, rights.length, tops.length, bottoms.length));
  for (let i = 0; i < count; i++) {
    const x = lefts[i] ?? viewport.x, y = tops[i] ?? viewport.y;
    const rect = { x, y, width: (rights[i] ?? viewport.x + viewport.width) - x, height: (bottoms[i] ?? viewport.y + viewport.height) - y };
    if (rect.width > 0 && rect.height > 0 && !equal(rect, current) && !result.some(old => equal(old, rect))) result.push(rect);
  }
  if (!result.some(rect => equal(rect, viewport))) result.push(viewport);
  return result;
}
