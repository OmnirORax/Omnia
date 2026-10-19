import {
  editorView,
  validateDocument,
  type Document,
  type LayoutView,
  type XYZ,
} from "./structural.ts";
import { compactLayout, localPosition, type SpatialSettings } from "./layout3d.ts";
import { labelSize } from "./labels.ts";

/** Parent-before-child layout. It reads composition but only writes local coordinates. */
export function hierarchyLayout(doc: Document): Document {
  const next = structuredClone(doc),
    byId = new Map(next.placements.map((p) => [p.id, p]));
  const entityFirst = new Map<string, string>();
  for (const p of [...next.placements].sort((a, b) => a.id.localeCompare(b.id)))
    if (!entityFirst.has(p.entityId)) entityFirst.set(p.entityId, p.id);
  const parentOf = new Map<string, string | null>();
  for (const p of next.placements) {
    // Authored composition may inform a view without rewriting visual nesting.
    const authored = next.compositions
      .filter((c) => c.childId === p.entityId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((c) => entityFirst.get(c.parentId))
      .find((id) => id && id !== p.id);
    parentOf.set(p.id, p.parentId ?? authored ?? null);
  }
  // Multiple representations can create a placement cycle even when identities form a DAG.
  for (const p of next.placements) {
    const seen = new Set([p.id]);
    let cursor = parentOf.get(p.id);
    while (cursor) {
      if (seen.has(cursor)) {
        parentOf.set(p.id, p.parentId);
        break;
      }
      seen.add(cursor);
      cursor = parentOf.get(cursor);
    }
  }
  const children = (id: string | null) =>
    next.placements
      .filter((p) => parentOf.get(p.id) === id)
      .sort((a, b) => a.id.localeCompare(b.id));
  const widths = new Map<string, number>();
  const size = (id: string) =>
    labelSize(next.entities.find((e) => e.id === byId.get(id)!.entityId)!.label);
  const width = (id: string): number => {
    const cached = widths.get(id);
    if (cached) return cached;
    const kids = byId.get(id)!.collapsed ? [] : children(id);
    const result = Math.max(
      size(id).width + 1.4,
      kids.reduce((sum, c) => sum + width(c.id), 0),
    );
    widths.set(id, result);
    return result;
  };
  const targets = new Map<string, XYZ>();
  const place = (id: string, x: number, y: number) => {
    targets.set(id, { x, y, z: 0 });
    const kids = children(id),
      total = kids.reduce((sum, c) => sum + width(c.id), 0);
    let left = x - total / 2;
    for (const child of kids) {
      place(
        child.id,
        left + width(child.id) / 2,
        y - Math.max(3, (size(id).height + size(child.id).height) / 2 + 1.8),
      );
      left += width(child.id);
    }
  };
  const roots = children(null);
  let left = -roots.reduce((sum, p) => sum + width(p.id), 0) / 2;
  for (const p of roots) {
    place(p.id, left + width(p.id) / 2, 0);
    left += width(p.id);
  }
  for (const p of next.placements) {
    const world = targets.get(p.id)!;
    const parent = p.parentId ? targets.get(p.parentId)! : { x: 0, y: 0, z: 0 };
    p.spatialPosition = { x: world.x - parent.x, y: world.y - parent.y, z: world.z - parent.z };
  }
  return validateDocument(next);
}
const snapshot = (doc: Document) =>
  doc.placements.map((p) => ({ placementId: p.id, position: localPosition(p) }));
/** Direction comes from user-chosen type/roles. Cyclic participants share a level. */
export function flowLayout(doc: Document, ordering: LayoutView["ordering"]): Document {
  if (!ordering) throw new Error("Choose a relationship type and ordering roles.");
  const type = doc.relationshipTypes.find((t) => t.id === ordering.typeId);
  if (
    !type ||
    !type.roles.some((r) => r.id === ordering.fromRoleId) ||
    !type.roles.some((r) => r.id === ordering.toRoleId) ||
    ordering.fromRoleId === ordering.toRoleId
  )
    throw new Error("The view's relationship type or roles are missing or invalid.");
  const next = structuredClone(doc),
    ids = next.entities.map((e) => e.id).sort();
  const edges = new Map(ids.map((id) => [id, new Set<string>()]));
  for (const r of next.relationships.filter((r) => r.typeId === ordering.typeId)) {
    const from = r.participants.filter((p) => p.roleId === ordering.fromRoleId);
    const to = r.participants.filter((p) => p.roleId === ordering.toRoleId);
    for (const a of from) for (const b of to) edges.get(a.entityId)!.add(b.entityId);
  }
  // Tarjan components prevent directed cycles from producing infinite depth.
  let serial = 0;
  const indices = new Map<string, number>(),
    low = new Map<string, number>();
  const stack: string[] = [],
    onStack = new Set<string>(),
    components: string[][] = [];
  const visit = (id: string) => {
    indices.set(id, serial);
    low.set(id, serial++);
    stack.push(id);
    onStack.add(id);
    for (const target of edges.get(id)!) {
      if (!indices.has(target)) {
        visit(target);
        low.set(id, Math.min(low.get(id)!, low.get(target)!));
      } else if (onStack.has(target)) low.set(id, Math.min(low.get(id)!, indices.get(target)!));
    }
    if (low.get(id) === indices.get(id)) {
      const component: string[] = [];
      let top: string;
      do {
        top = stack.pop()!;
        onStack.delete(top);
        component.push(top);
      } while (top !== id);
      components.push(component);
    }
  };
  for (const id of ids) if (!indices.has(id)) visit(id);
  const componentOf = new Map<string, number>();
  components.forEach((c, i) => c.forEach((id) => componentOf.set(id, i)));
  const parents = components.map(() => new Set<number>());
  for (const [from, targets] of edges)
    for (const to of targets)
      if (componentOf.get(from) !== componentOf.get(to))
        parents[componentOf.get(to)!].add(componentOf.get(from)!);
  const levels = new Map<number, number>();
  const level = (i: number): number => {
    if (levels.has(i)) return levels.get(i)!;
    const value = Math.max(0, ...[...parents[i]].map((p) => level(p) + 1));
    levels.set(i, value);
    return value;
  };
  const rows = new Map<number, typeof next.placements>();
  for (const p of next.placements) {
    const y = level(componentOf.get(p.entityId)!);
    rows.set(y, [...(rows.get(y) ?? []), p]);
  }
  const targets = new Map<string, XYZ>();
  const rowHeight = Math.max(3.5, ...next.entities.map((e) => labelSize(e.label).height + 1.8));
  for (const [y, row] of rows) {
    row.sort((a, b) => a.id.localeCompare(b.id));
    const widths = row.map(
      (p) => labelSize(next.entities.find((e) => e.id === p.entityId)!.label).width + 1.4,
    );
    let left = -widths.reduce((a, b) => a + b, 0) / 2;
    row.forEach((p, i) => {
      targets.set(p.id, { x: left + widths[i] / 2, y: -y * rowHeight, z: 0 });
      left += widths[i];
    });
  }
  for (const p of next.placements) {
    const world = targets.get(p.id)!,
      parent = p.parentId ? targets.get(p.parentId)! : { x: 0, y: 0, z: 0 };
    p.spatialPosition = { x: world.x - parent.x, y: world.y - parent.y, z: world.z - parent.z };
  }
  return validateDocument(next);
}
export function switchLayoutView(doc: Document, id: string): Document {
  const next = structuredClone(doc);
  if (!next.layoutViews)
    next.layoutViews = [
      { id: "authored-layout", name: "Authored layout", rule: "manual", positions: snapshot(doc) },
    ];
  const outgoing = next.layoutViews.find(
    (v) => v.id === (next.activeLayoutViewId ?? "authored-layout"),
  );
  if (outgoing) outgoing.positions = snapshot(doc);
  const incoming = next.layoutViews.find((v) => v.id === id);
  if (!incoming) throw new Error("Layout view missing.");
  const positions = new Map(incoming.positions.map((p) => [p.placementId, p.position]));
  for (const p of next.placements)
    if (positions.has(p.id)) p.spatialPosition = positions.get(p.id)!;
  next.activeLayoutViewId = id;
  return validateDocument(next);
}
export function createLayoutView(
  doc: Document,
  rule: LayoutView["rule"],
  name: string,
  settings: SpatialSettings,
  ordering?: LayoutView["ordering"],
): Document {
  const next = switchLayoutView(doc, doc.activeLayoutViewId ?? "authored-layout");
  const arranged =
    rule === "hierarchy"
      ? hierarchyLayout(next)
      : rule === "compact"
        ? compactLayout(next, { kind: "all" }, settings)
        : rule === "flow"
          ? flowLayout(next, ordering)
          : next;
  const view: LayoutView = {
    id: crypto.randomUUID(),
    name,
    rule,
    positions: snapshot(arranged),
    ...(rule === "flow" ? { ordering } : {}),
  };
  arranged.layoutViews!.push(view);
  arranged.activeLayoutViewId = view.id;
  return validateDocument(arranged);
}

export type DisplayBinder = {
  key: string;
  id: string;
  kind: "relationship" | "composition" | "visual";
  source: string;
  target: string;
  label: string;
  color?: string;
  opacity?: number;
};
export function chartedBinders(doc: Document): DisplayBinder[] {
  const atlas = editorView(doc),
    placements = new Map(doc.placements.map((p) => [p.id, p]));
  const binders: DisplayBinder[] = atlas.relationships.map((r) => {
    const canonical = doc.relationships.find((item) => item.id === r.id)!;
    return {
      ...r,
      key: r.id,
      kind: "relationship",
      label: [...(canonical.operators ?? []).map((o) => o.text), r.label]
        .filter(Boolean)
        .join(" · "),
      color: canonical.appearance?.color,
      opacity: canonical.appearance?.opacity,
    };
  });
  const represented = new Set<string>();
  for (const node of atlas.nodes) {
    if (!node.parentId) continue;
    const parent = placements.get(node.parentId)!,
      child = placements.get(node.id)!;
    const comp = doc.compositions.find(
      (c) => c.parentId === parent.entityId && c.childId === child.entityId,
    );
    if (comp) represented.add(comp.id);
    binders.push({
      key: `nest:${node.id}`,
      id: comp?.id ?? node.id,
      kind: comp ? "composition" : "visual",
      source: node.parentId,
      target: node.id,
      label: comp ? comp.operators?.map((o) => o.text).join(" · ") || "contains" : "visual nesting",
      color: comp?.appearance?.color,
      opacity: comp?.appearance?.opacity,
    });
  }
  for (const comp of doc.compositions.filter((c) => !represented.has(c.id))) {
    const first = (entityId: string) =>
      atlas.nodes
        .filter((n) => placements.get(n.id)?.entityId === entityId)
        .sort((a, b) => a.id.localeCompare(b.id))[0]?.id;
    const source = first(comp.parentId),
      target = first(comp.childId);
    if (source && target)
      binders.push({
        key: comp.id,
        id: comp.id,
        kind: "composition",
        source,
        target,
        label: comp.operators?.map((o) => o.text).join(" · ") || "contains",
        color: comp.appearance?.color,
        opacity: comp.appearance?.opacity,
      });
  }
  return binders;
}
