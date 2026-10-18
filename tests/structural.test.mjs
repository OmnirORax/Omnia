import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDocument,
  parseDocument,
  editorView,
  reconcileEditor,
  validateDocument,
} from "../src/graph/structural.ts";
import { validateChangeSet } from "../src/graph/changeset.ts";
import { projectSpatial } from "../src/graph/spatial.ts";

const legacyNode = (id, parentId = null) => ({
  id,
  label: id,
  notes: `${id} notes`,
  parentId,
  position: parentId ? { x: 28, y: 104 } : { x: 80, y: 80 },
  collapsed: false,
});
const legacy = () => ({
  format: "omnium-atlas",
  version: 1,
  nodes: [
    legacyNode("system"),
    legacyNode("subsystem", "system"),
    legacyNode("part", "subsystem"),
    legacyNode("external"),
  ],
  relationships: [{ id: "old-relation", source: "part", target: "external", label: "old wording" }],
});
const parse = (v) => parseDocument(JSON.stringify(v));
const frameScope = (entities, relationships = []) => ({
  anchorIds: entities.slice(0, 1),
  entityIds: entities,
  relationshipIds: relationships,
  excludedEntityIds: [],
  excludedRelationshipIds: [],
  depth: null,
});

test("v1 migration preserves containment as knowledge, references, labels and both layouts", () => {
  const source = legacy();
  source.nodes[1].spatialPosition = { x: 2, y: -1, z: 4 };
  const doc = parse(source);
  assert.equal(doc.version, 2);
  assert.deepEqual(
    doc.entities.map((e) => e.id),
    source.nodes.map((n) => n.id),
  );
  assert.deepEqual(
    doc.compositions.map((c) => [c.parentId, c.childId]),
    [
      ["system", "subsystem"],
      ["subsystem", "part"],
    ],
  );
  assert.deepEqual(doc.placements[1].spatialPosition, source.nodes[1].spatialPosition);
  assert.deepEqual(doc.placements[1].position, source.nodes[1].position);
  assert.deepEqual(
    doc.relationships[0].participants.map((p) => p.entityId),
    ["part", "external"],
  );
  assert.equal(doc.relationships[0].label, "old wording");
  assert.deepEqual(parse(doc), doc);
  assert.deepEqual(projectSpatial(editorView(doc)).nodes.find((n) => n.id === "subsystem").world, {
    x: 2.8,
    y: -1,
    z: 4.8,
  });
});

test("one identity supports multiple placements; connector choice is lexical and semantic relation does not move", () => {
  const doc = parse(legacy());
  doc.placements.push({
    ...structuredClone(doc.placements[1]),
    id: "000-reference",
    parentId: null,
    position: { x: 500, y: 500 },
    spatialPosition: { x: 9, y: 2, z: 3 },
  });
  doc.relationships.push({
    id: "to-subsystem",
    typeId: "legacy-untyped",
    label: "",
    qualifierIds: [],
    participants: [
      { roleId: "source", entityId: "external" },
      { roleId: "target", entityId: "subsystem" },
    ],
  });
  validateDocument(doc);
  assert.equal(
    editorView(doc).relationships.find((r) => r.id === "to-subsystem").target,
    "000-reference",
  );
  const original = JSON.stringify(doc.relationships);
  doc.placements.find((p) => p.id === "000-reference").hidden = true;
  assert.equal(
    editorView(doc).relationships.find((r) => r.id === "to-subsystem").target,
    "subsystem",
  );
  assert.equal(JSON.stringify(doc.relationships), original);
});

test("renderer edits update placements; visual reparenting alone adds no structural fact", () => {
  const doc = parse(legacy());
  const before = editorView(doc);
  const after = structuredClone(before);
  after.nodes.find((n) => n.id === "external").spatialPosition = { x: 3, y: 4, z: 5 };
  const updated = reconcileEditor(doc, before, after);
  assert.deepEqual(updated.placements.find((p) => p.id === "external").spatialPosition, {
    x: 3,
    y: 4,
    z: 5,
  });
  assert.deepEqual(updated.compositions, doc.compositions);
  assert.deepEqual(updated.relationships, doc.relationships);
});

test("frame filters the 3D projection without altering knowledge and reports stale references", () => {
  const doc = parse(legacy());
  doc.frames.push({
    id: "frame",
    name: "",
    question: "What changes?",
    scope: frameScope(["subsystem", "external"], []),
    locked: true,
    promoted: false,
    savedRevision: 0,
    history: [{ revision: 0, scope: frameScope(["system"]) }],
  });
  doc.activeFrameId = "frame";
  const original = JSON.stringify(doc.relationships);
  assert.deepEqual(
    projectSpatial(editorView(doc)).nodes.map((n) => n.id),
    ["subsystem", "external"],
  );
  assert.equal(editorView(doc).relationships.length, 0);
  doc.frames[0].scope.entityIds.push("deleted-later");
  assert.deepEqual(parse(doc).frames[0].scope.entityIds.at(-1), "deleted-later");
  assert.equal(JSON.stringify(doc.relationships), original);
});

test("frame depth traverses charted composition without copying entities", () => {
  const doc = parse(legacy());
  doc.frames.push({
    id: "depth-frame",
    name: "",
    question: "Inspect system",
    scope: { ...frameScope(["system"]), depth: 1 },
    locked: false,
    promoted: false,
    savedRevision: 0,
    history: [],
  });
  doc.activeFrameId = "depth-frame";
  assert.deepEqual(
    editorView(doc).nodes.map((n) => n.id),
    ["system", "subsystem"],
  );
  doc.frames[0].scope.depth = 2;
  assert.deepEqual(
    editorView(doc).nodes.map((n) => n.id),
    ["system", "subsystem", "part"],
  );
  assert.equal(doc.entities.length, 4);
});

test("editing a child in a frame does not erase its filtered-out visual parent", () => {
  const doc = parse(legacy());
  doc.frames.push({
    id: "isolated",
    name: "",
    question: "Part only",
    scope: frameScope(["part"]),
    locked: false,
    promoted: false,
    savedRevision: 0,
    history: [],
  });
  doc.activeFrameId = "isolated";
  const before = editorView(doc);
  assert.equal(before.nodes[0].parentId, null);
  const after = structuredClone(before);
  after.nodes[0].label = "Part revised";
  const next = reconcileEditor(doc, before, after);
  assert.equal(next.placements.find((p) => p.id === "part").parentId, "subsystem");
  assert.equal(next.entities.find((e) => e.id === "part").label, "Part revised");
  assert.deepEqual(next.compositions, doc.compositions);
});

test("external AI JSON round trip reuses a subsystem and atomically adds typed relationship and frame", () => {
  const initial = parse(legacy());
  const exported = JSON.stringify(initial);
  const readByExternalAI = parseDocument(exported);
  const proposal = {
    format: "omnium-changeset",
    version: 1,
    id: "proposal-1",
    baseRevision: readByExternalAI.revision,
    operations: [
      {
        op: "createRelationshipType",
        relationshipType: {
          id: "dependency-type",
          name: "Dependency",
          symbol: "⇢",
          definition: "Provisional",
          roles: [
            { id: "dependent", name: "Dependent" },
            { id: "required", name: "Required" },
          ],
        },
      },
      {
        op: "addPlacement",
        placement: {
          id: "subsystem-ref",
          entityId: "subsystem",
          parentId: null,
          position: { x: 440, y: 90 },
          spatialPosition: { x: 5, y: 0, z: 3 },
          collapsed: true,
          hidden: false,
        },
      },
      {
        op: "createRelationship",
        relationship: {
          id: "dependency-1",
          typeId: "dependency-type",
          participants: [
            { roleId: "dependent", entityId: "external" },
            { roleId: "required", entityId: "subsystem" },
          ],
          qualifierIds: [],
          label: "",
        },
      },
      {
        op: "createFrame",
        frame: {
          id: "investigation-1",
          name: "",
          question: "How does the external system use the subsystem?",
          scope: frameScope(["external", "subsystem"], ["dependency-1"]),
          locked: false,
          promoted: false,
          savedRevision: readByExternalAI.revision,
          history: [],
        },
      },
    ],
  };
  const before = JSON.stringify(initial);
  const preview = validateChangeSet(initial, JSON.parse(JSON.stringify(proposal)));
  assert.equal(JSON.stringify(initial), before, "preview cannot mutate the atlas");
  assert.equal(preview.lines.length, 4);
  const approved = parse(JSON.parse(JSON.stringify(preview.next)));
  assert.equal(approved.revision, 1);
  assert.equal(approved.entities.filter((e) => e.id === "subsystem").length, 1);
  assert.equal(approved.placements.filter((p) => p.entityId === "subsystem").length, 2);
  assert.deepEqual(approved.compositions, initial.compositions);
  assert.deepEqual(approved.relationships[0], initial.relationships[0]);
  assert.deepEqual(
    approved.relationships[1].participants.map((p) => p.entityId),
    ["external", "subsystem"],
  );
  assert.deepEqual(approved.frames[0].scope.relationshipIds, ["dependency-1"]);
  assert.ok(projectSpatial(editorView(approved)).nodes.some((n) => n.id === "subsystem-ref"));
  assert.throws(() => validateChangeSet(approved, proposal), /Stale/);
  const invalid = structuredClone(proposal);
  invalid.operations[1].placement.entityId = "missing";
  assert.throws(() => validateChangeSet(initial, invalid), /Missing placement entity/);
  assert.equal(JSON.stringify(initial), before, "rejected proposal cannot mutate the atlas");
});

test("conflicting updates and malformed IDs are rejected without applying any operation", () => {
  const doc = parse(legacy());
  const proposal = {
    format: "omnium-changeset",
    version: 1,
    id: "bad",
    baseRevision: doc.revision,
    operations: [
      { op: "createEntity", entity: { id: "new", label: "New", notes: "", aliases: [] } },
      {
        op: "updatePlacement",
        id: "system",
        expected: { id: "system" },
        placement: doc.placements[0],
      },
    ],
  };
  assert.throws(() => validateChangeSet(doc, proposal), /changed/);
  assert.equal(
    doc.entities.some((e) => e.id === "new"),
    false,
  );
  const duplicate = { ...proposal, operations: [proposal.operations[0], proposal.operations[0]] };
  assert.throws(() => validateChangeSet(doc, duplicate), /Duplicate/);
  const missingFrameReference = {
    ...proposal,
    operations: [
      {
        op: "createFrame",
        frame: {
          id: "bad-frame",
          name: "",
          question: "?",
          scope: frameScope(["unknown"]),
          locked: false,
          promoted: false,
          savedRevision: doc.revision,
          history: [],
        },
      },
    ],
  };
  assert.throws(() => validateChangeSet(doc, missingFrameReference), /Missing frame entity/);
  assert.deepEqual(emptyDocument().entities, []);
});
