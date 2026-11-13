/** Shared picking precision; consumer constraints still determine legal values. */
export const MAX_HALVING_ORDER = 8;
export function divisions(order: number, base = 6) {
  if (!Number.isInteger(order) || order < 0 || order > MAX_HALVING_ORDER || !Number.isInteger(base) || base < 1) throw Error('Invalid halving order.');
  return base * 2 ** order;
}
export function halvedValue(low: number, high: number, depth: number, fromHigh = false) {
  if (![low, high].every(Number.isFinite) || high < low || !Number.isInteger(depth) || depth < 0 || depth > 16) throw Error('Invalid halving interval.');
  const distance = (high - low) / 2 ** depth;
  return fromHigh ? high - distance : low + distance;
}
export const turnStep = (order: number, steps = 1) => steps / divisions(order);
/** Dragging uses the magnitude of the retained step; the pointer supplies direction.
 * A zero step intentionally holds the initial orientation. */
export function snapTurn(turn: number, order: number, steps = 1) {
  const interval = Math.abs(turnStep(order, steps));
  return interval ? Math.round(turn / interval) * interval : 0;
}
/** Accumulate successive pointer directions without jumping at the turn seam. */
export function turnDelta(previous: number, next: number) {
  const delta = next - previous;
  return delta - Math.floor(delta + .5);
}
/** Top is zero; positive proceeds clockwise in screen coordinates. */
export const directionTurn = (x: number, y: number) => Math.atan2(x, -y) / (Math.PI * 2);
