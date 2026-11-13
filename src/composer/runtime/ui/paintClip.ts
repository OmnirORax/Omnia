/** Canvas overlays must obey the same overflow ancestors as their DOM sources.
 * Create once per paint pass: shared ancestors are measured only once. */
export type PaintClip = { x: number; y: number; width: number; height: number };
export function createPaintClipReader(width: number, height: number) {
  const viewport: PaintClip = { x: 0, y: 0, width, height };
  const children = new WeakMap<HTMLElement, PaintClip>();
  const clips = (overflow: string) => /^(hidden|clip|scroll|auto)$/.test(overflow);
  const forChildren = (element: HTMLElement): PaintClip => {
    const cached = children.get(element);
    if (cached) return cached;
    const inherited = element.parentElement ? forChildren(element.parentElement) : viewport;
    const style = getComputedStyle(element);
    const contain = /\b(paint|strict|content)\b/.test(style.contain);
    let result = inherited;
    if (contain || clips(style.overflowX) || clips(style.overflowY)) {
      const bounds = element.getBoundingClientRect();
      const scaleX = element.offsetWidth ? bounds.width / element.offsetWidth : 1;
      const scaleY = element.offsetHeight ? bounds.height / element.offsetHeight : 1;
      const left = bounds.left + element.clientLeft * scaleX;
      const top = bounds.top + element.clientTop * scaleY;
      const x = contain || clips(style.overflowX) ? Math.max(inherited.x, left) : inherited.x;
      const y = contain || clips(style.overflowY) ? Math.max(inherited.y, top) : inherited.y;
      const right = contain || clips(style.overflowX) ? Math.min(inherited.x + inherited.width, left + element.clientWidth * scaleX) : inherited.x + inherited.width;
      const bottom = contain || clips(style.overflowY) ? Math.min(inherited.y + inherited.height, top + element.clientHeight * scaleY) : inherited.y + inherited.height;
      result = { x, y, width: Math.max(0, right - x), height: Math.max(0, bottom - y) };
    }
    children.set(element, result);
    return result;
  };
  return (element: HTMLElement, contents = false) => contents ? forChildren(element)
    : element.parentElement ? forChildren(element.parentElement) : viewport;
}
export function clipCanvas(context: CanvasRenderingContext2D, clip: PaintClip) {
  context.beginPath(); context.rect(clip.x, clip.y, clip.width, clip.height); context.clip();
}
