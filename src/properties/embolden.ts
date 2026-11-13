/** Relative stroke size used only when a document span is explicitly formatted Bold.
 * Normal text and 3D labels remain unchanged regardless of slider strength. */
export function emboldenStrokeEm(amount = 0): number {
  return Math.max(0, Math.min(10, amount)) / 40;
}

