type SearchAdapter = { available: () => boolean; open: () => void };
const adapters = new Map<string, Set<SearchAdapter>>();
export function registerFrameSearch(key: string, adapter: SearchAdapter) {
  const entries = adapters.get(key) ?? new Set<SearchAdapter>(); entries.add(adapter); adapters.set(key, entries);
  return () => { entries.delete(adapter); if (!entries.size) adapters.delete(key); };
}
export function searchFrame(key: string) {
  const adapter = [...(adapters.get(key) ?? [])].reverse().find(adapter => adapter.available());
  if (!adapter) return false;
  adapter.open(); return true;
}
