import type {Document} from "./geometryTypes.ts";
export function placementSubtree(doc: Document, ids: Iterable<string>) {
  const removed = new Set([...ids].filter((id) => doc.placements.some((p) => p.id === id)));
  for (const id of removed)
    for (const p of doc.placements)
      if (p.parentId === id || p.variantOwner?.placementId === id) removed.add(p.id);
  return removed;
}
