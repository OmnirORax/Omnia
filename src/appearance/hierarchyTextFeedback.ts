/** Transient bridge to text-effect canvases that paint above native glyphs.
 * Keys are the existing effect-scope IDs; no property values or selection writes. */
let owner: symbol | null = null, sources = new Map<string, WeakMap<Element, number>>(), level = 0;
const listeners = new Set<() => void>();
export function setHierarchyTextSources(token: symbol, entries: { key: string; element: Element; scale: number }[]) {
  owner = token; sources = new Map();
  for (const entry of entries) {
    const elements = sources.get(entry.key) ?? new WeakMap<Element, number>();
    elements.set(entry.element, entry.scale); sources.set(entry.key, elements);
  }
  for (const listener of listeners) listener();
}
export function updateHierarchyTextLevel(token: symbol, value: number) {
  if (owner !== token) return;
  level = value; for (const listener of listeners) listener();
}
export function hierarchyTextLevel(key: string, element: Element) {
  const scale = sources.get(key)?.get(element);
  return scale === undefined ? undefined : 1 - (1 - level) * scale;
}
export function clearHierarchyTextFeedback(token: symbol) {
  if (owner !== token) return;
  owner = null; sources.clear(); for (const listener of listeners) listener();
}
export function subscribeHierarchyTextFeedback(listener: () => void) {
  listeners.add(listener); return () => { listeners.delete(listener); };
}
