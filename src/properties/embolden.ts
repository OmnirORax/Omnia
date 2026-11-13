/** Bold strength is additional to the browser's native/synthetic weight.
 * A broad centered text stroke closes letter counters and joins neighbours:
 * cap it at 0.09em and make low strengths useful. Normal text stays untouched.
 */
export function emboldenStrokeEm(amount = 0): number {
  const value = Math.max(0, Math.min(10, amount));
  return Math.round(Math.pow(value / 10, 0.8) * 900) / 10000;
}

