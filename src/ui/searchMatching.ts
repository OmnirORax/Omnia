/** Search documents are prepared once per catalog snapshot, never on hover. */
export const normalizeSearch = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
type Entry = {
  key: string; label: string; heading?: string; aliases?:readonly string[];
  appearance?: { target: string; property?: string };
  appearanceProperties?: { id: string; label: string }[];
};
export function prepareSearchResults<T extends Entry>(entries: T[], shortcut: (entry: T) => string = () => "") {
  return entries.map(entry => ({ entry, label: normalizeSearch(entry.label),
    direct: normalizeSearch(`${entry.label} ${(entry.aliases??[]).join(" ")} ${shortcut(entry)}`),
    full: normalizeSearch(`${entry.heading ?? ""} ${entry.label} ${(entry.aliases??[]).join(" ")} ${shortcut(entry)}`),
    properties: entry.appearanceProperties?.map(property => ({ ...property, text: normalizeSearch(property.label) })) }));
}
/** A category match is a destination, not a request for all its property combinations.
 * Explicit context + property queries can still reveal the precise setter. */
export function matchSearchResults<T extends Entry>(index: ReturnType<typeof prepareSearchResults<T>>, query: string): T[] {
  const normalized = normalizeSearch(query).trim(), tokens = normalized.split(/\s+/).filter(Boolean);
  const hasAll = (text: string) => tokens.every(token => text.includes(token));
  const direct: { entry: T; rank: number }[] = [], contextual: T[] = [];
  for (const document of index) {
    const { entry, label } = document;
    if (hasAll(document.direct)) direct.push({ entry, rank: label === normalized ? 0 : label.startsWith(normalized) ? 1 : 2 });
    else if (hasAll(document.full)) contextual.push(entry);
    if (tokens.length < 2 || !entry.appearance) continue;
    for (const property of document.properties ?? []) {
      // Require both a property term and a separate target/context term. "Color"
      // alone belongs to the one shared Color command, not every consumer.
      if (!tokens.some(token => property.text.includes(token)) ||
          !tokens.some(token => !property.text.includes(token) && document.full.includes(token)) ||
          !hasAll(`${document.full} ${property.text}`)) continue;
      direct.push({ entry: { ...entry, key: `${entry.key}:${property.id}`, label: `${entry.label} · ${property.label}`,
        appearance: { target: entry.appearance.target, property: property.id }, appearanceProperties: undefined }, rank: 3 });
    }
  }
  return direct.length ? direct.sort((a, b) => a.rank - b.rank || a.entry.label.localeCompare(b.entry.label)).map(result => result.entry) : contextual;
}
