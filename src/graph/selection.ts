import { validateDocument, type Document } from "./structural.ts";
export function placementSubtree(doc: Document, ids: Iterable<string>) {
  const removed = new Set([...ids].filter((id) => doc.placements.some((p) => p.id === id)));
  for (const id of removed)
    for (const p of doc.placements)
      if (p.parentId === id || p.variantOwner?.placementId === id) removed.add(p.id);
  return removed;
}
/** Canonical subtree deletion: authored contents, owned variants and displayed descendants. */
export function deletionSummary(doc: Document, ids: Iterable<string>) {
  const selected = new Set(ids);
  const entities = new Set(doc.placements.filter((p) => selected.has(p.id)).map((p) => p.entityId));
  for (const entity of entities) {
    for (const c of doc.compositions) if (c.parentId === entity) entities.add(c.childId);
    for (const v of doc.variants ?? []) if (v.ownerId === entity) entities.add(v.entityId);
    const parents = new Set(doc.placements.filter((p) => p.entityId === entity).map((p) => p.id));
    for (const p of doc.placements)
      if (p.parentId && parents.has(p.parentId)) entities.add(p.entityId);
  }
  const displayed = placementSubtree(doc, selected);
  const otherReferences = doc.placements.filter(
    (p) => entities.has(p.entityId) && !displayed.has(p.id),
  ).length;
  const crossLinks =
    doc.relationships.filter((r) => {
      const refs = [...r.participants.map((p) => p.entityId), ...r.qualifierIds];
      return refs.some((id) => entities.has(id)) && refs.some((id) => !entities.has(id));
    }).length +
    doc.compositions.filter((c) => entities.has(c.parentId) !== entities.has(c.childId)).length;
  return { entities, otherReferences, crossLinks };
}
export function deleteConceptSubtrees(doc: Document, ids: Iterable<string>): Document {
  const { entities } = deletionSummary(doc, ids);
  if (!entities.size) return doc;
  const removed = new Set(doc.placements.filter((p) => entities.has(p.entityId)).map((p) => p.id));
  return validateDocument({
    ...doc,
    entities: doc.entities.filter((e) => !entities.has(e.id)),
    placements: doc.placements.filter((p) => !removed.has(p.id)),
    compositions: doc.compositions.filter(
      (c) => !entities.has(c.parentId) && !entities.has(c.childId),
    ),
    relationships: doc.relationships.filter(
      (r) =>
        !r.participants.some((p) => entities.has(p.entityId)) &&
        !r.qualifierIds.some((id) => entities.has(id)),
    ),
    variants: doc.variants?.filter((v) => !entities.has(v.ownerId) && !entities.has(v.entityId)),
    layoutViews: doc.layoutViews?.map((v) => ({
      ...v,
      positions: v.positions.filter((p) => !removed.has(p.placementId)),
    })),
  });
}
