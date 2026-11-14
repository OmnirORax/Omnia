/** Compare JSON state without serializing shared assets/unchanged subtrees.
 * State owners use immutable snapshots; renderer/DOM objects do not belong here. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!sameValue(a[i] === undefined ? null : a[i], b[i] === undefined ? null : b[i])) return false;
    return true;
  }
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left).filter(key => left[key] !== undefined), other = Object.keys(right).filter(key => right[key] !== undefined);
  return keys.length === other.length && keys.every(key => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}
