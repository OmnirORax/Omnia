import {
  validateDocument,
  type Document,
  type Entity,
  type Placement,
  type RelationshipType,
  type StructuralRelationship,
  type Frame,
  type FrameScope,
  type Composition,
  type Variant,
} from "./structural.ts";

export type Operation =
  | { op: "createEntity"; entity: Entity }
  | { op: "addPlacement"; placement: Placement }
  | { op: "addComposition"; composition: Composition }
  | { op: "addVariant"; variant: Variant }
  | { op: "createRelationshipType"; relationshipType: RelationshipType }
  | { op: "createRelationship"; relationship: StructuralRelationship }
  | {
      op: "updateRelationship";
      id: string;
      expected: StructuralRelationship;
      relationship: StructuralRelationship;
    }
  | { op: "updatePlacement"; id: string; expected: Placement; placement: Placement }
  | { op: "createFrame"; frame: Frame }
  | { op: "refineFrame"; id: string; expectedScope: FrameScope; scope: FrameScope };
export type ChangeSet = {
  format: "omnium-changeset";
  version: 1;
  id: string;
  baseRevision: number;
  operations: Operation[];
};
export type Preview = { next: Document; lines: string[] };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const reject = (reason: string): never => {
  throw new Error(reason);
};
const hasId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0 && id.length <= 200;

/** Structural validation only. Human review remains responsible for epistemic correctness. */
export function validateChangeSet(doc: Document, input: unknown): Preview {
  if (!input || typeof input !== "object") reject("Expected a change set object.");
  const value = input as Partial<ChangeSet>;
  if (
    value.format !== "omnium-changeset" ||
    value.version !== 1 ||
    !hasId(value.id) ||
    !Number.isSafeInteger(value.baseRevision) ||
    !Array.isArray(value.operations) ||
    value.operations.length > 500
  )
    reject("Invalid change set header or operation list.");
  if (value.baseRevision !== doc.revision)
    reject(
      `Stale change set: expected revision ${value.baseRevision}, current revision ${doc.revision}.`,
    );
  const next: Document = structuredClone(doc);
  const lines: string[] = [];
  const unique = (list: { id: string }[], id: string, kind: string) => {
    if (!hasId(id)) reject(`Invalid ${kind} ID.`);
    if (list.some((x) => x.id === id)) reject(`Duplicate ${kind} ID: ${id}`);
  };
  const checkFrameReferences = (scope: FrameScope) => {
    if (
      !scope ||
      !Array.isArray(scope.entityIds) ||
      !Array.isArray(scope.anchorIds) ||
      !Array.isArray(scope.relationshipIds) ||
      !Array.isArray(scope.excludedEntityIds) ||
      !Array.isArray(scope.excludedRelationshipIds)
    )
      reject("Malformed frame scope.");
    for (const entityId of [...scope.entityIds, ...scope.anchorIds, ...scope.excludedEntityIds])
      if (!next.entities.some((e) => e.id === entityId))
        reject(`Missing frame entity: ${entityId}`);
    for (const relationshipId of [...scope.relationshipIds, ...scope.excludedRelationshipIds])
      if (!next.relationships.some((r) => r.id === relationshipId))
        reject(`Missing frame relationship: ${relationshipId}`);
  };
  const entityName = (entityId: string) =>
    next.entities.find((e) => e.id === entityId)?.label || entityId;
  const describeRelationship = (r: StructuralRelationship) => {
    const type = next.relationshipTypes.find((t) => t.id === r.typeId);
    const participants = r.participants
      .map(
        (p) =>
          `${type?.roles.find((role) => role.id === p.roleId)?.name || p.roleId}: ${entityName(p.entityId)} (${p.entityId})`,
      )
      .join("; ");
    return `${type?.name || r.typeId} [${participants}]${r.label ? ` — ${r.label}` : ""}`;
  };
  for (const raw of value.operations!) {
    if (!raw || typeof raw !== "object" || typeof raw.op !== "string")
      reject("Malformed operation.");
    const op = raw as Operation;
    switch (op.op) {
      case "createEntity":
        if (!op.entity) reject("Missing entity.");
        unique(next.entities, op.entity.id, "entity");
        next.entities.push(op.entity);
        lines.push(`Create entity ${op.entity.label} (${op.entity.id})`);
        break;
      case "addPlacement":
        if (!op.placement) reject("Missing placement.");
        unique(next.placements, op.placement.id, "placement");
        next.placements.push(op.placement);
        lines.push(
          `Place existing entity ${entityName(op.placement.entityId)} (${op.placement.entityId}) as ${op.placement.id}`,
        );
        break;
      case "addComposition":
        if (!op.composition) reject("Missing composition.");
        unique(next.compositions, op.composition.id, "composition");
        next.compositions.push(op.composition);
        lines.push(
          `Chart containment ${entityName(op.composition.parentId)} → ${entityName(op.composition.childId)}`,
        );
        break;
      case "addVariant":
        if (!op.variant) reject("Missing variant.");
        unique(next.variants ?? [], op.variant.id, "variant");
        next.variants = [...(next.variants ?? []), op.variant];
        lines.push(`Add owned variant ${entityName(op.variant.entityId)} to ${entityName(op.variant.ownerId)}; no structural containment added`);
        break;
      case "createRelationshipType":
        if (!op.relationshipType) reject("Missing relationship type.");
        unique(next.relationshipTypes, op.relationshipType.id, "relationship type");
        next.relationshipTypes.push(op.relationshipType);
        lines.push(`Define relationship type ${op.relationshipType.name}`);
        break;
      case "createRelationship":
        if (!op.relationship) reject("Missing relationship.");
        unique(next.relationships, op.relationship.id, "relationship");
        next.relationships.push(op.relationship);
        lines.push(
          `Chart relationship ${op.relationship.id}: ${describeRelationship(op.relationship)}`,
        );
        break;
      case "updateRelationship": {
        const current = next.relationships.find((r) => r.id === op.id);
        if (!current || !same(current, op.expected) || op.relationship?.id !== op.id)
          reject(`Relationship ${op.id} changed or does not exist.`);
        next.relationships = next.relationships.map((r) => (r.id === op.id ? op.relationship : r));
        lines.push(
          `Modify relationship ${op.id}: ${describeRelationship(op.expected)} → ${describeRelationship(op.relationship)}`,
        );
        break;
      }
      case "updatePlacement": {
        const current = next.placements.find((p) => p.id === op.id);
        if (!current || !same(current, op.expected) || op.placement?.id !== op.id)
          reject(`Placement ${op.id} changed or does not exist.`);
        next.placements = next.placements.map((p) => (p.id === op.id ? op.placement : p));
        lines.push(`Modify placement ${op.id}`);
        break;
      }
      case "createFrame":
        if (!op.frame) reject("Missing frame.");
        checkFrameReferences(op.frame.scope);
        unique(next.frames, op.frame.id, "frame");
        next.frames.push(op.frame);
        lines.push(
          `Create investigative frame ${op.frame.name || op.frame.question || op.frame.id}; identities: ${op.frame.scope.entityIds.map(entityName).join(", ")}; relationships: ${op.frame.scope.relationshipIds.join(", ")}`,
        );
        break;
      case "refineFrame": {
        const frame = next.frames.find((f) => f.id === op.id);
        if (!frame || frame.locked || !same(frame.scope, op.expectedScope))
          throw new Error(`Frame ${op.id} is locked, changed, or missing.`);
        checkFrameReferences(op.scope);
        frame.history.push({ revision: doc.revision, scope: structuredClone(frame.scope) });
        frame.scope = op.scope;
        lines.push(
          `Refine investigative frame ${op.id}; identities: ${op.scope.entityIds.map(entityName).join(", ")}; relationships: ${op.scope.relationshipIds.join(", ")}`,
        );
        break;
      }
      default:
        reject(`Unsupported operation: ${(op as { op: string }).op}`);
    }
    // Check each operation so an invalid reference cannot be repaired by a later operation.
    try {
      validateDocument(next);
    } catch (error) {
      reject(
        `Operation ${lines.length}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (!lines.length) reject("Change set contains no operations.");
  next.revision = doc.revision + 1;
  return { next: validateDocument(next), lines };
}

export function parseChangeSet(text: string): ChangeSet {
  if (text.length > 5_000_000) reject("Change set exceeds the 5 MB import limit.");
  return JSON.parse(text) as ChangeSet;
}
