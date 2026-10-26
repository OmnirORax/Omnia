import { parseAtlas as parseLegacyAtlas, type Atlas as LegacyAtlas } from "./model.ts";
import { defaultNodeOffset } from "./labels.ts";
import { worldPositions } from "./coordinates.ts";
import { validateAsset, validateVisual, type Visual, type VisualAsset } from "./assets.ts";

export type XY = { x: number; y: number };
export type XYZ = XY & { z: number };
export type Entity = { id: string; label: string; aliases: string[]; notes: string };
export type Appearance = { color: string; opacity: number; glow?: number };
// Editable annotations, not an executable grammar or a definition of truth.
export type BinderOperator = { id: string; text: string };
export type BinderPresentation = { appearance?: Appearance; textAppearance?: Appearance; operators?: BinderOperator[]; text?: string; visual?: Visual };
export type Placement = {
  id: string;
  entityId: string;
  parentId: string | null;
  position: XY;
  spatialPosition?: XYZ;
  /** Visual facing only; independent of identity, containment and child layout. */
  orientation?: XYZ & { w: number };
  collapsed: boolean;
  hidden: boolean;
  appearance?: Appearance;
  visual?: Visual;
  nestingBinder?: BinderPresentation;
  variantOwner?: { placementId: string; variantId: string };
};
export type Composition = { id: string; parentId: string; childId: string } & BinderPresentation;
/** Ownership of a variant reference is separate from authored structural composition. */
export type Variant = { id: string; ownerId: string; entityId: string; position?: XYZ } & BinderPresentation;
export type RelationshipType = {
  id: string;
  name: string;
  symbol: string;
  roles: { id: string; name: string }[];
  definition: string;
};
export type StructuralRelationship = BinderPresentation & {
  id: string;
  typeId: string;
  participants: { roleId: string; entityId: string }[];
  label: string;
  qualifierIds: string[];
};
export type LayoutView = {
  id: string;
  name: string;
  rule: "manual" | "hierarchy" | "compact" | "flow";
  ordering?: { typeId: string; fromRoleId: string; toRoleId: string };
  positions: { placementId: string; position: XYZ }[];
};
export type FrameScope = {
  anchorIds: string[];
  entityIds: string[];
  relationshipIds: string[];
  excludedEntityIds: string[];
  excludedRelationshipIds: string[];
  depth: number | null;
};
export type Frame = {
  id: string;
  name: string;
  question: string;
  scope: FrameScope;
  locked: boolean;
  promoted: boolean;
  discarded?: boolean;
  savedRevision: number;
  history: { revision: number; scope: FrameScope }[];
};
export type Document = {
  format: "omnium-atlas";
  version: 2;
  revision: number;
  entities: Entity[];
  placements: Placement[];
  compositions: Composition[];
  relationshipTypes: RelationshipType[];
  relationships: StructuralRelationship[];
  frames: Frame[];
  activeFrameId: string | null;
  layoutViews?: LayoutView[];
  activeLayoutViewId?: string | null;
  variants?: Variant[];
  assets?: VisualAsset[];
  /** Distinguishes migrated layouts from legacy synthetic variant representations. */
  variantPlacementsVersion?: 1;
};

export const UNTYPED_ID = "legacy-untyped";
export const emptyDocument = (): Document => ({
  format: "omnium-atlas",
  version: 2,
  revision: 0,
  entities: [],
  placements: [],
  compositions: [],
  relationshipTypes: [
    {
      id: UNTYPED_ID,
      name: "Unclassified",
      symbol: "",
      definition: "Legacy or not yet classified",
      roles: [
        { id: "source", name: "From" },
        { id: "target", name: "To" },
      ],
    },
  ],
  relationships: [],
  frames: [],
  activeFrameId: null,
});

const fail = (message: string): never => {
  throw new Error(message);
};
const unique = (ids: string[], what: string) => {
  if (new Set(ids).size !== ids.length) fail(`Duplicate ${what} ID.`);
};
const id = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;
const str = (v: unknown, max = 10000): v is string => typeof v === "string" && v.length <= max;
const rec = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every(id);
const point = (v: unknown, axis: string[]): boolean =>
  rec(v) &&
  axis.every(
    (a) =>
      typeof v[a] === "number" && Number.isFinite(v[a]) && Math.abs(v[a] as number) <= 1_000_000,
  );
function validatePresentation(value: BinderPresentation) {
  if (value.text !== undefined && !str(value.text, 500)) fail("Invalid binder text.");
  for (const a of [value.appearance, value.textAppearance])
    if (a !== undefined && (!rec(a) || !/^#[0-9a-f]{6}$/i.test(a.color) || !Number.isFinite(a.opacity) || a.opacity < 0 || a.opacity > 1 || (a.glow !== undefined && (!Number.isFinite(a.glow) || a.glow < 0 || a.glow > 2)))) fail("Invalid appearance.");
  if (value.operators !== undefined) {
    if (!Array.isArray(value.operators) || value.operators.length > 32 || value.operators.some((o) => !rec(o) || !id(o.id) || !str(o.text, 500))) fail("Invalid binder operators.");
    unique(value.operators.map((o) => o.id), "binder operator");
  }
}
const has = (list: string[], value: string, what: string) => {
  if (!list.includes(value)) fail(`Missing ${what}: ${value}`);
};

/** Legacy parentId was authored containment, so migration records both semantic and visual links. */
export function migrateAtlas(legacy: LegacyAtlas): Document {
  const doc = emptyDocument();
  doc.entities = legacy.nodes.map((n) => ({
    id: n.id,
    label: n.label,
    aliases: [],
    notes: n.notes,
  }));
  doc.placements = legacy.nodes.map((n) => ({
    id: n.id,
    entityId: n.id,
    parentId: n.parentId,
    position: n.position,
    ...(n.spatialPosition ? { spatialPosition: n.spatialPosition } : {}),
    collapsed: n.collapsed,
    hidden: false,
  }));
  doc.compositions = legacy.nodes
    .filter((n) => n.parentId)
    .map((n) => ({
      id: `legacy-composition:${n.id}`,
      parentId: n.parentId!,
      childId: n.id,
    }));
  doc.relationships = legacy.relationships.map((r) => ({
    id: r.id,
    typeId: UNTYPED_ID,
    participants: [
      { roleId: "source", entityId: r.source },
      { roleId: "target", entityId: r.target },
    ],
    label: r.label,
    qualifierIds: [],
  }));
  return validateDocument(doc);
}

export function parseDocument(input: string): Document {
  if (input.length > 5_000_000) fail("Atlas exceeds the 5 MB import limit.");
  const value: unknown = JSON.parse(input);
  if (!rec(value) || value.format !== "omnium-atlas") throw new Error("Expected an Omnium atlas.");
  if (value.version === 1) return migrateAtlas(parseLegacyAtlas(input));
  if (value.version !== 2) fail("Unsupported Omnium atlas version.");
  const doc = validateDocument(value as Document);
  return doc.variantPlacementsVersion === 1 ? doc : ensureVariantPlacements(doc);
}

/** Upgrade earlier variant stand-ins to ordinary, initially gated placements. */
export function ensureVariantPlacements(doc: Document, onlyOwnerId?: string, onlyVariantId?: string): Document {
  if (!doc.variants?.length) return doc;
  const next = structuredClone(doc); let changed = doc.variantPlacementsVersion !== 1;
  next.variantPlacementsVersion = 1;
  for (let i = 0; i < next.placements.length; i++) {
    const owner = next.placements[i];
    if (onlyOwnerId && owner.id !== onlyOwnerId) continue;
    let index = 0;
    for (const v of next.variants!.filter((v) => v.ownerId === owner.entityId)) {
      if (onlyVariantId && v.id !== onlyVariantId) { index++; continue; }
      if (next.placements.some((p) => p.variantOwner?.placementId === owner.id && p.variantOwner.variantId === v.id)) { index++; continue; }
      const label = next.entities.find((e) => e.id === v.entityId)!.label;
      const ownerLabel = next.entities.find((e) => e.id === owner.entityId)!.label;
      next.placements.push({ id: crypto.randomUUID(), entityId: v.entityId, parentId: owner.id, position: { x: 28, y: 104 + index * 112 }, spatialPosition: v.position ?? defaultNodeOffset(ownerLabel, label, index), collapsed: true, hidden: false, ...(!doc.variantPlacementsVersion && v.appearance ? { appearance: v.appearance } : {}), variantOwner: { placementId: owner.id, variantId: v.id } });
      if (next.placements.length > 4000) throw new Error("Variant placements exceed the 4,000 placement limit. Original data was preserved.");
      index++; changed = true;
    }
  }
  return changed ? validateDocument(next) : doc;
}

export function validateDocument(doc: Document): Document {
  if (
    !rec(doc) ||
    doc.format !== "omnium-atlas" ||
    doc.version !== 2 ||
    !Number.isSafeInteger(doc.revision) ||
    doc.revision < 0
  )
    fail("Invalid document header or revision.");
  for (const key of [
    "entities",
    "placements",
    "compositions",
    "relationshipTypes",
    "relationships",
    "frames",
  ] as const)
    if (!Array.isArray(doc[key]) || doc[key].length > 10000) fail(`Invalid ${key} list.`);
  for (const key of [
    "entities",
    "placements",
    "compositions",
    "relationshipTypes",
    "relationships",
    "frames",
  ] as const)
    if (doc[key].some((item) => !rec(item))) fail(`Invalid ${key} entry.`);
  if (doc.entities.length > 2000 || doc.placements.length > 4000)
    fail("Atlas entity/placement limit exceeded.");
  if (doc.assets !== undefined) {
    if (!Array.isArray(doc.assets) || doc.assets.length > 256) fail("Invalid assets list.");
    unique(doc.assets.map((a) => a?.id), "asset");
    doc.assets.forEach(validateAsset);
    if (doc.assets.reduce((sum, a) => sum + a.dataUrl.length, 0) > 3_500_000) fail("Embedded assets exceed the 3.5 MB atlas budget.");
  }
  for (const value of [...doc.placements, ...doc.compositions, ...doc.relationships, ...(doc.variants ?? [])]) validateVisual(value.visual, doc.assets ?? []);
  for (const p of doc.placements) if (p.nestingBinder) { validatePresentation(p.nestingBinder); validateVisual(p.nestingBinder.visual, doc.assets ?? []); }
  for (const [key, list] of [
    ["entity", doc.entities],
    ["placement", doc.placements],
    ["composition", doc.compositions],
    ["relationship type", doc.relationshipTypes],
    ["relationship", doc.relationships],
    ["frame", doc.frames],
  ] as const)
    unique(
      list.map((v) => v.id),
      key,
    );
  const entityIds = doc.entities.map((e) => e.id);
  const placementIds = doc.placements.map((p) => p.id);
  for (const e of doc.entities)
    if (
      !id(e.id) ||
      !str(e.label, 500) ||
      !str(e.notes) ||
      !Array.isArray(e.aliases) ||
      !e.aliases.every((a) => str(a, 500))
    )
      fail("Invalid entity.");
  if (doc.variants !== undefined) {
    if (doc.variantPlacementsVersion !== undefined && doc.variantPlacementsVersion !== 1) fail("Unsupported variant placement version.");
    if (!Array.isArray(doc.variants) || doc.variants.length > 4000 || doc.variants.some((v) => !rec(v))) fail("Invalid variants list.");
    unique(doc.variants.map((v) => v.id), "variant");
    unique(doc.variants.map((v) => `${v.ownerId}\u0000${v.entityId}`), "owner/variant pair");
    const owned = new Map<string, string[]>();
    for (const v of doc.variants) {
      if (!id(v.id) || !id(v.ownerId) || !id(v.entityId) || v.ownerId === v.entityId || (v.position !== undefined && !point(v.position, ["x", "y", "z"]))) fail("Invalid variant ownership.");
      has(entityIds, v.ownerId, "variant owner"); has(entityIds, v.entityId, "variant entity"); validatePresentation(v);
      owned.set(v.ownerId, [...(owned.get(v.ownerId) ?? []), v.entityId]);
    }
    const checked = new Set<string>();
    const visit = (entityId: string, path: Set<string>) => {
      if (path.has(entityId)) fail("Variant ownership cycle.");
      if (path.size > 50) fail("Maximum variant nesting depth is 50.");
      if (checked.has(entityId)) return;
      const nextPath = new Set(path); nextPath.add(entityId);
      for (const child of owned.get(entityId) ?? []) visit(child, nextPath);
      checked.add(entityId);
    };
    for (const owner of owned.keys()) visit(owner, new Set());
  }
  for (const p of doc.placements) {
    validatePresentation(p);
    if (p.variantOwner !== undefined) {
      const link = p.variantOwner;
      if (!rec(link) || !id(link.placementId) || !id(link.variantId) || link.placementId === p.id) fail("Invalid variant visibility reference.");
      const owner = doc.placements.find((item) => item.id === link.placementId);
      const variant = doc.variants?.find((v) => v.id === link.variantId);
      if (!owner || !variant || variant.ownerId !== owner.entityId || variant.entityId !== p.entityId) fail("Missing or mismatched variant visibility reference.");
    }
    if (
      !id(p.id) ||
      !id(p.entityId) ||
      !(p.parentId === null || id(p.parentId)) ||
      !point(p.position, ["x", "y"]) ||
      (p.spatialPosition !== undefined && !point(p.spatialPosition, ["x", "y", "z"])) ||
      (p.orientation !== undefined && (!point(p.orientation, ["x", "y", "z", "w"]) ||
        Math.abs(Math.hypot(p.orientation.x, p.orientation.y, p.orientation.z, p.orientation.w) - 1) > .0001)) ||
      typeof p.collapsed !== "boolean" ||
      typeof p.hidden !== "boolean"
    )
      fail("Invalid placement.");
    has(entityIds, p.entityId, "placement entity");
    if (p.parentId) has(placementIds, p.parentId, "visual parent");
    if (p.parentId && (p.position.x < 24 || p.position.y < 96))
      fail("Child positions must leave room for the parent header.");
    const seen = new Set([p.id]);
    let cursor = p.parentId;
    while (cursor) {
      if (seen.has(cursor)) fail("Visual containment cycle.");
      seen.add(cursor);
      if (seen.size > 50) fail("Maximum nesting depth is 50.");
      cursor = doc.placements.find((x) => x.id === cursor)?.parentId ?? null;
    }
  }
  const gateDone = new Set<string>();
  function checkVisibility(current: string, path: Set<string>) {
    if (path.has(current)) fail("Cyclic placement visibility dependencies.");
    if (gateDone.has(current)) return;
    const p = doc.placements.find((p) => p.id === current)!;
    const nextPath = new Set(path); nextPath.add(current);
    for (const dependency of new Set([p.parentId, p.variantOwner?.placementId].filter((id): id is string => !!id))) checkVisibility(dependency, nextPath);
    gateDone.add(current);
  }
  for (const p of doc.placements) checkVisibility(p.id, new Set());
  for (const c of doc.compositions) {
    validatePresentation(c);
    if (!id(c.id) || !id(c.parentId) || !id(c.childId) || c.parentId === c.childId)
      fail("Invalid structural composition.");
    has(entityIds, c.parentId, "composition parent");
    has(entityIds, c.childId, "composition child");
  }
  unique(
    doc.compositions.map((c) => `${c.parentId}\u0000${c.childId}`),
    "structural composition pair",
  );
  const componentChildren = new Map<string, string[]>();
  for (const c of doc.compositions)
    componentChildren.set(c.parentId, [...(componentChildren.get(c.parentId) ?? []), c.childId]);
  function visitComposition(current: string, path: Set<string>) {
    if (path.has(current)) fail("Structural containment cycle.");
    const nextPath = new Set(path);
    nextPath.add(current);
    for (const child of componentChildren.get(current) ?? []) visitComposition(child, nextPath);
  }
  for (const parent of componentChildren.keys()) visitComposition(parent, new Set());
  for (const t of doc.relationshipTypes) {
    if (
      !id(t.id) ||
      !str(t.name, 500) ||
      !str(t.symbol, 50) ||
      !str(t.definition) ||
      !Array.isArray(t.roles) ||
      t.roles.length < 2 ||
      t.roles.length > 20 ||
      t.roles.some((r) => !id(r.id) || !str(r.name, 500))
    )
      fail("Invalid relationship type.");
    unique(
      t.roles.map((r) => r.id),
      "participant role",
    );
  }
  for (const r of doc.relationships) {
    validatePresentation(r);
    if (
      !id(r.id) ||
      !id(r.typeId) ||
      !str(r.label, 500) ||
      !Array.isArray(r.participants) ||
      r.participants.length < 2 ||
      r.participants.length > 20 ||
      !ids(r.qualifierIds)
    )
      fail("Invalid relationship.");
    const type = doc.relationshipTypes.find((t) => t.id === r.typeId);
    if (!type) throw new Error(`Missing relationship type: ${r.typeId}`);
    for (const p of r.participants) {
      if (!id(p.roleId) || !id(p.entityId)) fail("Invalid participant.");
      has(entityIds, p.entityId, "relationship participant");
      has(
        type.roles.map((role) => role.id),
        p.roleId,
        "relationship role",
      );
    }
    for (const q of r.qualifierIds) has(entityIds, q, "qualifier");
  }
  if (doc.layoutViews !== undefined) {
    if (!Array.isArray(doc.layoutViews) || doc.layoutViews.length > 100 || doc.layoutViews.some((v) => !rec(v))) fail("Invalid layout views.");
    unique(doc.layoutViews.map((v) => v.id), "layout view");
    for (const v of doc.layoutViews) {
      if (!rec(v) || !id(v.id) || !str(v.name, 500) || !["manual", "hierarchy", "compact", "flow"].includes(v.rule) || !Array.isArray(v.positions) || v.positions.length > 4000) fail("Invalid layout view.");
      if (v.ordering !== undefined && (!rec(v.ordering) || !id(v.ordering.typeId) || !id(v.ordering.fromRoleId) || !id(v.ordering.toRoleId) || v.ordering.fromRoleId === v.ordering.toRoleId)) fail("Invalid view ordering roles.");
      if (v.positions.some((p) => !rec(p))) fail("Invalid view position.");
      unique(v.positions.map((p) => p.placementId), "view placement");
      for (const p of v.positions) if (!rec(p) || !id(p.placementId) || !point(p.position, ["x", "y", "z"])) fail("Invalid view position.");
    }
  }
  if (doc.activeLayoutViewId != null && !doc.layoutViews?.some((v) => v.id === doc.activeLayoutViewId)) fail("Missing active layout view.");
  for (const f of doc.frames) {
    if (
      !id(f.id) ||
      !str(f.name, 500) ||
      !str(f.question) ||
      typeof f.locked !== "boolean" ||
      typeof f.promoted !== "boolean" ||
      (f.discarded !== undefined && typeof f.discarded !== "boolean") ||
      !Number.isSafeInteger(f.savedRevision) ||
      !Array.isArray(f.history) ||
      f.history.some((h) => !rec(h) || !Number.isSafeInteger(h.revision))
    )
      fail("Invalid frame.");
    for (const scope of [f.scope, ...f.history.map((h) => h.scope)]) {
      if (
        !rec(scope) ||
        !ids(scope.anchorIds) ||
        !ids(scope.entityIds) ||
        !ids(scope.relationshipIds) ||
        !ids(scope.excludedEntityIds) ||
        !ids(scope.excludedRelationshipIds) ||
        !(
          scope.depth === null ||
          (Number.isInteger(scope.depth) &&
            (scope.depth as number) >= 0 &&
            (scope.depth as number) <= 50)
        )
      )
        fail("Invalid frame scope.");
      // Deleted references remain in frames so reopening can report them rather than silently losing the investigation.
    }
  }
  if (doc.activeFrameId !== null)
    has(
      doc.frames.map((f) => f.id),
      doc.activeFrameId,
      "active frame",
    );
  return doc;
}

/** Compatibility adapter for the existing 3D renderer; it is never persisted. */
export function editorView(doc: Document, expandedVariants: ReadonlySet<string> = new Set()): LegacyAtlas {
  const active = doc.frames.find((f) => f.id === doc.activeFrameId);
  const allowed = active ? new Set(active.scope.entityIds.concat(active.scope.anchorIds)) : null;
  if (active && allowed && active.scope.depth !== null) {
    let frontier = [...active.scope.anchorIds];
    for (let level = 0; level < active.scope.depth; level++) {
      const children = doc.compositions
        .filter((c) => frontier.includes(c.parentId))
        .map((c) => c.childId);
      for (const child of children) allowed.add(child);
      frontier = children;
      if (!frontier.length) break;
    }
  }
  const excluded = new Set(active?.scope.excludedEntityIds ?? []);
  const gated = new Map<string, boolean>();
  const canReveal = (p: Placement): boolean => {
    if (gated.has(p.id)) return gated.get(p.id)!;
    const owner = p.variantOwner && doc.placements.find((item) => item.id === p.variantOwner!.placementId)!;
    const parent = p.parentId && doc.placements.find((item) => item.id === p.parentId)!;
    const visible = (!owner || (!owner.hidden && !excluded.has(owner.entityId) && (!allowed || allowed.has(owner.entityId)) && expandedVariants.has(owner.id) && canReveal(owner))) && (!parent || canReveal(parent));
    gated.set(p.id, visible); return visible;
  };
  const visible = doc.placements.filter(
    (p) => canReveal(p) && !p.hidden && !excluded.has(p.entityId) && (!allowed || allowed.has(p.entityId)),
  );
  const visibleIds = new Set(visible.map((p) => p.id));
  const worlds = worldPositions(doc);
  const nodes = visible.map((p) => {
    const e = doc.entities.find((x) => x.id === p.entityId)!;
    return {
      id: p.id,
      label: e.label,
      notes: e.notes,
      parentId: p.parentId && visibleIds.has(p.parentId) ? p.parentId : null,
      position: p.position,
      ...(p.parentId && !visibleIds.has(p.parentId) ? { spatialPosition: worlds.get(p.id)! } : p.spatialPosition ? { spatialPosition: p.spatialPosition } : {}),
      collapsed: p.collapsed,
      ...(p.variantOwner ? { variantOwnerId: p.variantOwner.placementId } : {}),
    };
  });
  const first = new Map<string, string>();
  // Explicit endpoint policy: lowest lexical visible placement ID, then its closest visible ancestor.
  for (const p of [...visible].sort((a, b) => a.id.localeCompare(b.id)))
    if (!first.has(p.entityId)) first.set(p.entityId, p.id);
  const includedRelations = active ? new Set(active.scope.relationshipIds) : null;
  const relationships = doc.relationships.flatMap((r) => {
    if (
      (includedRelations && !includedRelations.has(r.id)) ||
      active?.scope.excludedRelationshipIds.includes(r.id)
    )
      return [];
    const a = first.get(r.participants[0]?.entityId),
      b = first.get(r.participants[1]?.entityId);
    if (!a || !b) return [];
    const type = doc.relationshipTypes.find((t) => t.id === r.typeId);
    return [{ id: r.id, source: a, target: b, label: r.label || type?.symbol || type?.name || "" }];
  });
  return { format: "omnium-atlas", version: 1, nodes, relationships };
}

/** Reveals direct charted components as placements, never as copied identities or facts. */
export function expandPlacement(doc: Document, placementId: string): Document {
  const next = structuredClone(doc);
  expandInPlace(next, placementId);
  return validateDocument(next);
}
function expandInPlace(next: Document, placementId: string) {
  const parent = next.placements.find((p) => p.id === placementId);
  if (!parent) throw new Error(`Missing placement: ${placementId}`);
  const components = next.compositions.filter((c) => c.parentId === parent.entityId);
  const activeFrame = next.frames.find((f) => f.id === next.activeFrameId);
  if (activeFrame && !activeFrame.locked) {
    const added = components.filter((c) => !activeFrame.scope.entityIds.includes(c.childId));
    if (added.length) {
      activeFrame.history.push({
        revision: next.revision,
        scope: structuredClone(activeFrame.scope),
      });
      activeFrame.scope.entityIds.push(...added.map((c) => c.childId));
    }
  }
  for (const component of components) {
    if (next.placements.some((p) => p.parentId === placementId && p.entityId === component.childId && !p.variantOwner))
      continue;
    const index = next.placements.filter((p) => p.parentId === placementId).length;
    next.placements.push({
      id: crypto.randomUUID(),
      entityId: component.childId,
      parentId: placementId,
      position: { x: 28, y: 104 + index * 112 },
      spatialPosition: defaultNodeOffset(next.entities.find((e) => e.id === parent.entityId)!.label, next.entities.find((e) => e.id === component.childId)!.label, index),
      collapsed: true,
      hidden: false,
    });
    if (next.placements.length > 4000) throw new Error("Expansion exceeds the 4,000 placement limit. No changes were applied.");
  }
  parent.collapsed = false;
}

/** Expand every authored level, or collapse an already fully expanded subtree, atomically. */
export function toggleSubtree(doc: Document, placementId: string): Document {
  if (!doc.placements.some((p) => p.id === placementId)) throw new Error("Subtree placement is missing.");
  const reachable: Placement[] = [], pending = [placementId];
  let fullyExpanded = true, expandable = false;
  for (let i = 0; i < pending.length; i++) {
    const p = doc.placements.find((item) => item.id === pending[i])!;
    const children = doc.placements.filter((c) => c.parentId === p.id && !c.hidden && !c.variantOwner);
    reachable.push(p); pending.push(...children.map((c) => c.id));
    const components = doc.compositions.filter((c) => c.parentId === p.entityId);
    if (children.length || components.length) {
      expandable = true;
      if (p.collapsed || components.some((c) => !doc.placements.some((child) => child.parentId === p.id && child.entityId === c.childId && !child.variantOwner))) fullyExpanded = false;
    }
  }
  if (!expandable) return doc;
  const next = structuredClone(doc);
  if (fullyExpanded) {
    const ids = new Set(reachable.map((p) => p.id));
    for (const p of next.placements) if (ids.has(p.id)) p.collapsed = true;
  } else {
    const queue = [placementId];
    for (let i = 0; i < queue.length; i++) {
      expandInPlace(next, queue[i]);
      queue.push(...next.placements.filter((p) => p.parentId === queue[i] && !p.hidden && !p.variantOwner).map((p) => p.id));
    }
  }
  return validateDocument(next);
}

/** Reconcile edits from the pre-existing editor while keeping semantic identity separate. */
export function reconcileEditor(doc: Document, before: LegacyAtlas, after: LegacyAtlas): Document {
  const next = structuredClone(doc);
  const oldNodes = new Map(before.nodes.map((n) => [n.id, n]));
  const newNodes = new Map(after.nodes.map((n) => [n.id, n]));
  for (const n of after.nodes) {
    const prior = oldNodes.get(n.id);
    if (!prior) {
      next.entities.push({ id: n.id, label: n.label, aliases: [], notes: n.notes });
      next.placements.push({
        id: n.id,
        entityId: n.id,
        parentId: n.parentId,
        position: n.position,
        ...(n.spatialPosition ? { spatialPosition: n.spatialPosition } : {}),
        collapsed: n.collapsed,
        hidden: false,
      });
      if (n.parentId)
        next.compositions.push({
          id: crypto.randomUUID(),
          parentId: next.placements.find((p) => p.id === n.parentId)!.entityId,
          childId: n.id,
        });
    } else {
      const p = next.placements.find((x) => x.id === n.id)!;
      const e = next.entities.find((x) => x.id === p.entityId)!;
      e.label = n.label;
      e.notes = n.notes;
      if (prior.parentId !== n.parentId) p.parentId = n.parentId;
      p.position = n.position;
      // Unchanged projected world coordinates must not overwrite canonical local coordinates.
      if (JSON.stringify(prior.spatialPosition) !== JSON.stringify(n.spatialPosition)) {
        const parent = p.parentId && !oldNodes.has(p.parentId) ? worldPositions(doc).get(p.parentId) : undefined;
        p.spatialPosition = n.spatialPosition && parent ? { x: n.spatialPosition.x - parent.x, y: n.spatialPosition.y - parent.y, z: n.spatialPosition.z - parent.z } : n.spatialPosition;
      }
      p.collapsed = n.collapsed;
    }
  }
  const removed = before.nodes.filter((n) => !newNodes.has(n.id)).map((n) => n.id);
  if (removed.length) {
    const removedEntities = next.placements
      .filter((p) => removed.includes(p.id))
      .map((p) => p.entityId);
    next.placements = next.placements.filter((p) => !removed.includes(p.id));
    const unplaced = removedEntities.filter(
      (eid) => !next.placements.some((p) => p.entityId === eid),
    );
    next.entities = next.entities.filter((e) => !unplaced.includes(e.id));
    next.compositions = next.compositions.filter(
      (c) => !unplaced.includes(c.parentId) && !unplaced.includes(c.childId),
    );
    next.relationships = next.relationships.filter(
      (r) => !r.participants.some((p) => unplaced.includes(p.entityId)),
    );
  }
  const afterR = new Map(after.relationships.map((r) => [r.id, r]));
  next.relationships = next.relationships.filter(
    (r) => !before.relationships.some((x) => x.id === r.id) || afterR.has(r.id),
  );
  for (const r of after.relationships) {
    const prior = before.relationships.find((x) => x.id === r.id);
    const existing = next.relationships.find((x) => x.id === r.id);
    if (!existing)
      next.relationships.push({
        id: r.id,
        typeId: UNTYPED_ID,
        participants: [
          { roleId: "source", entityId: next.placements.find((p) => p.id === r.source)!.entityId },
          { roleId: "target", entityId: next.placements.find((p) => p.id === r.target)!.entityId },
        ],
        label: r.label,
        qualifierIds: [],
      });
    else if (
      prior &&
      (prior.source !== r.source || prior.target !== r.target || prior.label !== r.label)
    ) {
      existing.participants[0].entityId = next.placements.find((p) => p.id === r.source)!.entityId;
      existing.participants[1].entityId = next.placements.find((p) => p.id === r.target)!.entityId;
      existing.label = r.label;
    }
  }
  return validateDocument(next);
}
