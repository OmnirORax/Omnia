import type { DockRect } from './docking';
import type { DockSide } from './dockTree';

const directions: { side: DockSide; x: number; y: number; symbol: string; label: string }[] = [
  { side: 'left', x: -1, y: 0, symbol: '◧', label: 'Dock left' },
  { side: 'tab', x: 0, y: 0, symbol: '▣', label: 'Group as tabs' },
  { side: 'right', x: 1, y: 0, symbol: '◨', label: 'Dock right' },
  { side: 'top', x: 0, y: -1, symbol: '⬒', label: 'Dock above' },
  { side: 'bottom', x: 0, y: 1, symbol: '⬓', label: 'Dock below' },
];

/** Drawing and hit testing share one non-overlapping cross, even on a tiny tab.
 * Adjacent hit cells meet halfway through the 4px visual gap. */
export function dockGuides(bounds: DockRect, viewport: DockRect) {
  const pitch = Math.min(32, viewport.width / 3, viewport.height / 3), size = Math.max(1, pitch - 4);
  const x = Math.max(viewport.x + pitch * 1.5, Math.min(bounds.x + bounds.width / 2, viewport.x + viewport.width - pitch * 1.5));
  const y = Math.max(viewport.y + pitch * 1.5, Math.min(bounds.y + bounds.height / 2, viewport.y + viewport.height - pitch * 1.5));
  return directions.map(direction => ({ ...direction,
    rect: { x: x + direction.x * pitch - size / 2, y: y + direction.y * pitch - size / 2, width: size, height: size },
    hit: { x: x + direction.x * pitch - pitch / 2, y: y + direction.y * pitch - pitch / 2, width: pitch, height: pitch },
  }));
}
export function dockGuideAt(bounds: DockRect, viewport: DockRect, x: number, y: number) {
  return dockGuides(bounds, viewport).find(({ hit }) => x >= hit.x && x < hit.x + hit.width && y >= hit.y && y < hit.y + hit.height)?.side;
}
