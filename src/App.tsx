import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import "./workbench.css";
import { descendants, newId, parseAtlas } from "./graph/model";
import type { Atlas, AtlasNode } from "./graph/model";
import {
  emptyDocument,
  editorView,
  expandPlacement,
  toggleSubtree,
  parseDocument,
  reconcileEditor,
  validateDocument,
  type Document as AtlasDocument,
  type Frame,
  type FrameScope,
} from "./graph/structural";
import { parseChangeSet, validateChangeSet, type Preview } from "./graph/changeset";
import { compactLayout, createPlacement, movePlacement, nearestFree, reparentStructure, reparentVisual, worldPositions, type ReflowScope, type GridSpacing } from "./graph/layout3d";
import { ACTIONS, SETTINGS_KEY, actionForKey, defaultSettings, isTypingTarget, keyConflict, loadSettings, normalizeKey, type ActionId, type WorkspaceSettings } from "./workspaceActions";
import type { ContextAction, ContextTarget, NavigationCommand } from "./SpatialWorkspace";
import { AppearanceControls, BinderControls } from "./AppearanceControls";
import { createLayoutView, hierarchyLayout, flowLayout, switchLayoutView } from "./graph/presentation";
import { addVariant, moveVariant, nodeEntityId, projectVariants, variantInstance } from "./graph/variants";
import { projectSpatial } from "./graph/spatial";
const SpatialWorkspace = lazy(() => import("./SpatialWorkspace"));

const STORAGE_KEY = "omnium.atlas.v2";
const LEGACY_STORAGE_KEY = "omnium.atlas.v1";
type ViewConfig = {
  format: "omnium-ui-template";
  version: 1 | 2;
  atlas: AtlasDocument | Atlas;
};
type Selection = { kind: "node" | "variant" | "relationship" | "composition"; id: string } | null;
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function loadInitial(): { atlas: AtlasDocument; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return { atlas: saved ? parseDocument(saved) : emptyDocument(), error: "" };
  } catch (e) {
    return {
      atlas: emptyDocument(),
      error: `Saved atlas could not be loaded. It has not been overwritten. ${message(e)}`,
    };
  }
}
function Workbench() {
  const [initial] = useState(loadInitial);
  const [document, setDocument] = useState(initial.atlas);
  const atlas = useMemo(() => editorView(document), [document]);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState(initial.error);
  const [autosave, setAutosave] = useState(!initial.error);
  const [saveStatus, setSaveStatus] = useState(initial.error ? "Autosave paused" : "Saved locally");
  const [revision, setRevision] = useState(0);
  const [past, setPast] = useState<AtlasDocument[]>([]);
  const [future, setFuture] = useState<AtlasDocument[]>([]);
  const [proposalText, setProposalText] = useState("");
  const [proposalPreview, setProposalPreview] = useState<Preview | null>(null);
  const [frameQuestion, setFrameQuestion] = useState("");
  const [entityLookup, setEntityLookup] = useState("");
  const [frameLookup, setFrameLookup] = useState("");
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [settings, setSettings] = useState<WorkspaceSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [layoutRule, setLayoutRule] = useState<"manual" | "hierarchy" | "compact" | "flow">("hierarchy");
  const [flowOrder, setFlowOrder] = useState({ typeId: "", fromRoleId: "", toRoleId: "" });
  const [capturing, setCapturing] = useState<ActionId | null>(null);
  const [constraintAxis, setConstraintAxis] = useState<"x" | "y" | "z" | null>(null);
  const [navCommand, setNavCommand] = useState<NavigationCommand | null>(null);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [insertContext, setInsertContext] = useState<{ parentId: string | null; world?: { x: number; y: number; z: number } } | null>(null);
  const [insertQuery, setInsertQuery] = useState("");
  const [optionNodeId, setOptionNodeId] = useState<string | null>(null);
  const [expandedVariants, setExpandedVariants] = useState<Set<string>>(() => new Set());
  const structuralGraph = useMemo(() => projectSpatial(atlas), [atlas]);
  const variantDisplay = useMemo(() => projectVariants(document, structuralGraph.nodes, expandedVariants), [document, structuralGraph, expandedVariants]);
  const fileInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const proposalInput = useRef<HTMLInputElement>(null);
  function navigate(kind: NavigationCommand["kind"], id?: string) {
    setNavCommand((old) => ({ sequence: (old?.sequence ?? 0) + 1, kind, id }));
  }
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { /* Settings are optional; atlas persistence is reported separately. */ }
  }, [settings]);
  function commitDocument(next: AtlasDocument) {
    try {
      const synced = next.layoutViews ? { ...next, layoutViews: next.layoutViews.map((view) => view.id === next.activeLayoutViewId ? { ...view, positions: next.placements.map((p) => ({ placementId: p.id, position: p.spatialPosition ?? { x: p.position.x / 100, y: p.parentId ? -2 : 0, z: p.position.y / 100 } })) } : view) } : next;
      const validated = validateDocument({ ...synced, revision: document.revision + 1 });
      setPast((p) => [...p.slice(-49), document]);
      setFuture([]);
      setDocument(validated);
      setProposalPreview(null);
      setRevision((r) => r + 1);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  function commit(next: Atlas) {
    try {
      const checked = parseAtlas(JSON.stringify(next));
      const result = reconcileEditor(document, atlas, checked);
      const active = result.frames.find((f) => f.id === result.activeFrameId);
      if (active && !active.locked) {
        for (const node of checked.nodes) {
          if (
            !atlas.nodes.some((old) => old.id === node.id) &&
            !active.scope.entityIds.includes(node.id)
          )
            active.scope.entityIds.push(node.id);
        }
      }
      commitDocument(result);
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    if (!revision || !autosave) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
      setSaveStatus("Saved locally");
    } catch {
      setSaveStatus("Not saved");
      setError("Local storage is unavailable or full. Export JSON now to keep your work.");
    }
  }, [document, revision, autosave]);
  function patchNode(id: string, changes: Partial<AtlasNode>) {
    if (changes.spatialPosition) {
      try { commitDocument(movePlacement(document, id, changes.spatialPosition, settings.spatial)); }
      catch (e) { setError(message(e)); }
      return;
    }
    commit({ ...atlas, nodes: atlas.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) });
  }
  function fit() {
    navigate("local", selection?.kind === "node" ? selection.id : undefined);
  }
  function addNode(parentId: string | null, atWorld?: { x: number; y: number; z: number }) {
    try {
      const entityId = newId();
      const next = structuredClone(document);
      next.entities.push({ id: entityId, label: "New node", aliases: [], notes: "" });
      if (parentId) {
        const parent = next.placements.find((p) => p.id === parentId);
        if (!parent) throw new Error("Parent placement missing.");
        next.compositions.push({ id: newId(), parentId: parent.entityId, childId: entityId });
        parent.collapsed = false;
      }
      const desired = atWorld && parentId ? (() => {
        const origin = worldPositions(next).get(parentId)!;
        return { x: atWorld.x - origin.x, y: atWorld.y - origin.y, z: atWorld.z - origin.z };
      })() : atWorld;
      const placed = createPlacement(next, entityId, parentId, settings.spatial, desired);
      const frame = placed.next.frames.find((f) => f.id === placed.next.activeFrameId);
      if (frame && !frame.locked) frame.scope.entityIds.push(entityId);
      if (frame?.locked) placed.next.activeFrameId = null;
      commitDocument(placed.next);
      setSelection({ kind: "node", id: placed.placementId });
      navigate("focus", placed.placementId);
    } catch (e) { setError(message(e)); }
  }
  function connect(connection: { source: string | null; target: string | null }) {
    if (!connection.source || !connection.target) return;
    const id = newId();
    commit({
      ...atlas,
      relationships: [
        ...atlas.relationships,
        { id, source: connection.source, target: connection.target, label: "" },
      ],
    });
    setSelection({ kind: "relationship", id });
  }
  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((f) => [document, ...f]);
    setPast((p) => p.slice(0, -1));
    setDocument({ ...previous, revision: document.revision + 1 });
    setSelection(null);
    setRevision((r) => r + 1);
  }
  function redo() {
    if (!future[0]) return;
    setPast((p) => [...p, document]);
    setDocument({ ...future[0], revision: document.revision + 1 });
    setFuture((f) => f.slice(1));
    setSelection(null);
    setRevision((r) => r + 1);
  }
  function exportJSON() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(document, null, 2)], { type: "application/json" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "omnium-atlas.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportTemplate() {
    const template: ViewConfig = {
      format: "omnium-ui-template",
      version: 2,
      atlas: document,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(template, null, 2)], { type: "application/json" }),
    );
    const link = window.document.createElement("a");
    link.href = url;
    link.download = "omnium-ui-template.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importTemplate(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("UI template exceeds the 5 MB import limit.");
      const value: unknown = JSON.parse(await file.text());
      if (
        !value ||
        typeof value !== "object" ||
        (value as ViewConfig).format !== "omnium-ui-template" ||
        ![1, 2].includes((value as ViewConfig).version)
      )
        throw new Error("Expected an Omnium UI template version 1 or 2.");
      const template = value as ViewConfig;
      const next = parseDocument(JSON.stringify(template.atlas));
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas and UI layout with this template? You can undo this action.",
        )
      )
        return;
      commitDocument(next);
      setSelection(null);
      setOptionNodeId(null); setExpandedVariants(new Set());
    } catch (e) {
      setError(`Template import failed. Your atlas was not changed. ${message(e)}`);
    } finally {
      if (templateInput.current) templateInput.current.value = "";
    }
  }
  async function importJSON(file?: File) {
    if (!file) return;
    try {
      if (file.size > 5_000_000) throw new Error("Atlas exceeds the 5 MB import limit.");
      const next = parseDocument(await file.text());
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas with this file? You can undo this action. Export first to keep a separate backup.",
        )
      )
        return;
      commitDocument(next);
      setSelection(null);
      setOptionNodeId(null); setExpandedVariants(new Set());
      fit();
    } catch (e) {
      setError(`Import failed. Your atlas was not changed. ${message(e)}`);
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  const selectedNode =
    selection?.kind === "node" ? atlas.nodes.find((n) => n.id === selection.id) : undefined;
  const selectedRelationship =
    selection?.kind === "relationship"
      ? atlas.relationships.find((r) => r.id === selection.id)
      : undefined;
  const selectedPlacement = selectedNode
    ? document.placements.find((p) => p.id === selectedNode.id)
    : undefined;
  const selectedEntity = document.entities.find((e) => e.id === selectedPlacement?.entityId);
  const selectedVariant = selection?.kind === "variant" ? variantInstance(document, selection.id)?.variant : undefined;
  const variantEntity = document.entities.find((e) => e.id === selectedVariant?.entityId);
  const selectedRelationData = document.relationships.find(
    (r) => r.id === selectedRelationship?.id,
  );
  const activeFrame = document.frames.find((f) => f.id === document.activeFrameId);
  const selectedComposition = selection?.kind === "composition" ? document.compositions.find((c) => c.id === selection.id) : undefined;
  const activeLayout = document.layoutViews?.find((v) => v.id === document.activeLayoutViewId);
  const flowType = document.relationshipTypes.find((t) => t.id === flowOrder.typeId) ?? document.relationshipTypes[0];
  const resolvedOrder = { typeId: flowType?.id ?? "", fromRoleId: flowOrder.fromRoleId || flowType?.roles[0]?.id || "", toRoleId: flowOrder.toRoleId || flowType?.roles[1]?.id || "" };
  function switchView(id: string) {
    try { commitDocument(switchLayoutView(document, id)); navigate(["hierarchy", "flow"].includes(document.layoutViews?.find((v) => v.id === id)?.rule ?? "") ? "hierarchy" : "local", selection?.kind === "node" ? selection.id : undefined); }
    catch (e) { setError(message(e)); }
  }
  function newView() {
    try {
      const name = layoutRule === "hierarchy" ? "Hierarchy" : layoutRule === "compact" ? "Compact" : layoutRule === "flow" ? "Directed flow" : "Manual";
      commitDocument(createLayoutView(document, layoutRule, `${name} ${(document.layoutViews?.length ?? 0) + 1}`, settings.spatial, resolvedOrder));
      navigate(["hierarchy", "flow"].includes(layoutRule) ? "hierarchy" : "local", selection?.kind === "node" ? selection.id : undefined);
    } catch (e) { setError(message(e)); }
  }
  function reapplyView() {
    if (!activeLayout) return;
    try {
      const next = activeLayout.rule === "hierarchy" ? hierarchyLayout(document) : activeLayout.rule === "flow" ? flowLayout(document, activeLayout.ordering) : compactLayout(document, { kind: "all" }, settings.spatial);
      commitDocument(next);
      navigate(["hierarchy", "flow"].includes(activeLayout.rule) ? "hierarchy" : "local");
    } catch (e) { setError(message(e)); }
  }
  function removeView() {
    if (!activeLayout || activeLayout.id === "authored-layout") return;
    try {
      const fallback = document.layoutViews?.find((v) => v.id !== activeLayout.id)?.id;
      const restored = fallback ? switchLayoutView(document, fallback) : { ...document, activeLayoutViewId: null };
      commitDocument({ ...restored, layoutViews: restored.layoutViews?.filter((v) => v.id !== activeLayout.id) });
      navigate("local");
    } catch (e) { setError(message(e)); }
  }
  const forbiddenParents = selectedNode ? descendants(atlas, selectedNode.id) : new Set<string>();
  function reveal(id: string) {
    const ancestors = new Set<string>();
    let node = atlas.nodes.find((n) => n.id === id);
    while (node?.parentId) {
      ancestors.add(node.parentId);
      node = atlas.nodes.find((n) => n.id === node!.parentId);
    }
    if (atlas.nodes.some((n) => ancestors.has(n.id) && n.collapsed))
      commit({
        ...atlas,
        nodes: atlas.nodes.map((n) => (ancestors.has(n.id) ? { ...n, collapsed: false } : n)),
      });
    setSelection({ kind: "node", id });
    navigate("focus", id);
  }
  function options() {
    return atlas.nodes.map((n) => (
      <option key={n.id} value={n.id}>
        {n.label || "Untitled node"}
      </option>
    ));
  }
  function insertExisting(entityId: string, parentId: string | null = null, atWorld?: { x: number; y: number; z: number }) {
    const entity = document.entities.find((e) => e.id === entityId);
    if (!entity) {
      setError("Choose an existing identity.");
      return;
    }
    try {
      const next = structuredClone(document);
      if (parentId) {
        const parent = next.placements.find((p) => p.id === parentId);
        if (!parent) throw new Error("Parent placement missing.");
        parent.collapsed = false;
      }
      const desired = atWorld && parentId ? (() => {
        const origin = worldPositions(next).get(parentId)!;
        return { x: atWorld.x - origin.x, y: atWorld.y - origin.y, z: atWorld.z - origin.z };
      })() : atWorld;
      const placed = createPlacement(next, entityId, parentId, settings.spatial, desired);
      const frame = placed.next.frames.find((f) => f.id === placed.next.activeFrameId);
      if (frame && !frame.locked && !frame.scope.entityIds.includes(entityId)) frame.scope.entityIds.push(entityId);
      if (frame?.locked) placed.next.activeFrameId = null;
      commitDocument(placed.next);
      setSelection({ kind: "node", id: placed.placementId });
      navigate("focus", placed.placementId);
      setInsertContext(null);
    } catch (e) { setError(message(e)); }
  }
  function removePlacement(id: string) {
    commitDocument({
      ...document,
      placements: document.placements
        .filter((p) => p.id !== id)
        .map((p) => (p.parentId === id ? { ...p, parentId: null } : p)),
    });
    setSelection(null);
  }
  function deleteIdentity(entityId: string) {
    const entity = document.entities.find((e) => e.id === entityId);
    if (
      !entity ||
      !window.confirm(
        `Delete identity “${entity.label}”, every placement, and all relationships involving it? This can be undone.`,
      )
    )
      return;
    const removedPlacementIds = new Set(
      document.placements.filter((p) => p.entityId === entityId).map((p) => p.id),
    );
    // Preserve other entities even when their visual parent disappears.
    commitDocument({
      ...document,
      entities: document.entities.filter((e) => e.id !== entityId),
      placements: document.placements
        .filter((p) => p.entityId !== entityId)
        .map((p) => (removedPlacementIds.has(p.parentId ?? "") ? { ...p, parentId: null } : p)),
      compositions: document.compositions.filter(
        (c) => c.parentId !== entityId && c.childId !== entityId,
      ),
      relationships: document.relationships.filter(
        (r) =>
          !r.participants.some((p) => p.entityId === entityId) &&
          !r.qualifierIds.includes(entityId),
      ),
      variants: document.variants?.filter((v) => v.ownerId !== entityId && v.entityId !== entityId),
    });
    setSelection(null);
  }
  function navigateIdentity(entityId: string) {
    const other = document.placements.find(
      (p) => p.entityId === entityId && p.id !== selectedPlacement?.id,
    );
    if (other) {
      const ancestors = new Set<string>();
      let cursor = other.parentId;
      while (cursor) {
        ancestors.add(cursor);
        cursor = document.placements.find((p) => p.id === cursor)?.parentId ?? null;
      }
      commitDocument({
        ...document,
        activeFrameId: null,
        placements: document.placements.map((p) =>
          p.id === other.id
            ? { ...p, hidden: false }
            : ancestors.has(p.id)
              ? { ...p, collapsed: false, hidden: false }
              : p,
        ),
      });
      setSelection({ kind: "node", id: other.id });
      navigate("focus", other.id);
    } else
      setError(
        "This identity has no other placement. Its charted relationships remain available in the inspector.",
      );
  }
  function updateRelation(changes: Partial<NonNullable<typeof selectedRelationData>>) {
    if (!selectedRelationData) return;
    commitDocument({
      ...document,
      relationships: document.relationships.map((r) =>
        r.id === selectedRelationData.id ? { ...r, ...changes } : r,
      ),
    });
  }
  function createType() {
    const name = window.prompt("New relationship type name (provisional)");
    if (!name?.trim()) return;
    const id = newId();
    commitDocument({
      ...document,
      relationshipTypes: [
        ...document.relationshipTypes,
        {
          id,
          name: name.trim(),
          symbol: "",
          definition: "",
          roles: [
            { id: "source", name: "From" },
            { id: "target", name: "To" },
          ],
        },
      ],
    });
  }
  function patchType(
    typeId: string,
    changes: Partial<(typeof document.relationshipTypes)[number]>,
  ) {
    commitDocument({
      ...document,
      relationshipTypes: document.relationshipTypes.map((t) =>
        t.id === typeId ? { ...t, ...changes } : t,
      ),
    });
  }
  function makeScope(entityIds: string[]): FrameScope {
    return {
      anchorIds: entityIds.slice(0, 1),
      entityIds,
      relationshipIds: [],
      excludedEntityIds: [],
      excludedRelationshipIds: [],
      depth: null,
    };
  }
  function createFrame() {
    const q = frameQuestion.trim();
    const selectedIds = selectedEntity ? [selectedEntity.id] : [];
    const tokens = q.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
    const matched = document.entities
      .filter(
        (e) =>
          tokens.length > 0 &&
          tokens.some(
            (word) =>
              e.label.toLowerCase().includes(word) ||
              e.aliases.some((a) => a.toLowerCase().includes(word)),
          ),
      )
      .map((e) => e.id);
    const entityIds = [...new Set([...selectedIds, ...matched])];
    const frame: Frame = {
      id: newId(),
      name: "",
      question: q,
      scope: makeScope(entityIds),
      locked: false,
      promoted: false,
      discarded: false,
      savedRevision: document.revision,
      history: [],
    };
    commitDocument({ ...document, frames: [...document.frames, frame], activeFrameId: frame.id });
    setFrameQuestion("");
    setSelection(null);
  }
  function refineFrame(scope: FrameScope) {
    if (!activeFrame || activeFrame.locked) return;
    const next = structuredClone(document);
    const frame = next.frames.find((f) => f.id === activeFrame.id)!;
    frame.history.push({ revision: document.revision, scope: structuredClone(frame.scope) });
    frame.scope = scope;
    commitDocument(next);
  }
  function reviewProposal() {
    try {
      setProposalPreview(validateChangeSet(document, parseChangeSet(proposalText)));
      setError("");
    } catch (e) {
      setProposalPreview(null);
      setError(`Proposal rejected. ${message(e)}`);
    }
  }
  function toggleNode(id: string) {
    const placement = document.placements.find((p) => p.id === id);
    if (!placement) return;
    if (placement.collapsed) {
      try { commitDocument(expandPlacement(document, id)); }
      catch (e) { setError(message(e)); }
    } else commitDocument({ ...document, placements: document.placements.map((p) => p.id === id ? { ...p, collapsed: true } : p) });
  }
  function nodeClicked(id: string) {
    const isVariant = variantDisplay.instances.get(id);
    if (isVariant?.kind === "add") { createVariant(isVariant.ownerNodeId); return; }
    if (connectionSource) {
      if (isVariant) { setError("Insert a structural reference before connecting a variant to the atlas."); return; }
      if (connectionSource !== id) connect({ source: connectionSource, target: id });
      setConnectionSource(null);
      return;
    }
    setSelection({ kind: isVariant ? "variant" : "node", id });
    setOptionNodeId(id);
    setExpandedVariants((current) => new Set([...current, id]));
    navigate("variants", id);
  }
  function nodeDoubleClicked(id: string) {
    setOptionNodeId(null);
    setExpandedVariants((current) => { const next = new Set(current); next.delete(id); return next; });
    setSelection({ kind: variantInstance(document, id) ? "variant" : "node", id });
    const placement = document.placements.find((p) => p.id === id);
    if (placement && (document.compositions.some((c) => c.parentId === placement.entityId) || document.placements.some((p) => p.parentId === id))) toggleNode(id);
    navigate("focus", id);
  }
  function nodeSubtreeClicked(id: string) {
    if (!document.placements.some((p) => p.id === id)) return;
    try {
      const next = toggleSubtree(document, id);
      if (next !== document) commitDocument(next);
      setSelection({ kind: "node", id }); setOptionNodeId(null);
      setExpandedVariants((current) => { const remaining = new Set(current); remaining.delete(id); return remaining; });
      navigate("local", id);
    } catch (e) { setError(message(e)); }
  }
  function toggleVariants(id: string) {
    setExpandedVariants((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function createVariant(ownerNodeId: string) {
    const ownerId = nodeEntityId(document, ownerNodeId);
    if (!ownerId) return;
    try {
      const { next, variant } = addVariant(document, ownerId);
      const expanded = new Set([...expandedVariants, ownerNodeId]);
      const display = projectVariants(next, structuralGraph.nodes, expanded);
      const instance = [...display.instances].find(([, item]) => item.kind === "variant" && item.variant.id === variant.id && item.ownerNodeId === ownerNodeId);
      commitDocument(next); setExpandedVariants(expanded); setOptionNodeId(ownerNodeId);
      navigate("variants", ownerNodeId);
      if (instance) { setSelection({ kind: "variant", id: instance[0] }); }
      setTimeout(() => window.document.querySelector<HTMLInputElement>('[aria-label="Variant name"]')?.focus(), 0);
    } catch (e) { setError(message(e)); }
  }
  function removeVariant(id: string) {
    const instance = variantInstance(document, id);
    if (!instance) return;
    commitDocument({ ...document, variants: document.variants?.filter((v) => v.id !== instance.variant.id) });
    setSelection(null);
  }
  function moveDisplayedNode(id: string, position: { x: number; y: number; z: number }, preview = false) {
    if (variantInstance(document, id)) {
      const next = moveVariant(document, id, position, [...structuralGraph.nodes, ...variantDisplay.nodes], settings.spatial.spacing);
      if (!preview) commitDocument(next);
      return projectVariants(next, structuralGraph.nodes, expandedVariants).nodes.find((n) => n.id === id)!.world;
    }
    const local = nearestFree(document, id, position, settings.spatial);
    if (!preview) commitDocument(movePlacement(document, id, local, settings.spatial));
    return local;
  }
  function compact(scope: ReflowScope) {
    try { commitDocument(compactLayout(document, scope, settings.spatial)); navigate("local", selection?.kind === "node" ? selection.id : undefined); }
    catch (e) { setError(message(e)); }
  }
  function nestReason(id: string, targetId: string): string | null {
    if (variantDisplay.instances.has(id) || variantDisplay.instances.has(targetId)) return "Variants belong to their owner; they are not structural components.";
    try { reparentStructure(document, id, targetId, settings.spatial); return null; }
    catch (e) { return message(e); }
  }
  function nest(id: string, targetId: string) {
    try {
      commitDocument(reparentStructure(document, id, targetId, settings.spatial));
      setSelection({ kind: "node", id }); navigate("focus", targetId);
    } catch (e) { setError(message(e)); }
  }
  function contextAction(action: ContextAction, target: ContextTarget) {
    const id = target.kind === "node" ? target.id : null;
    const variant = id ? variantInstance(document, id) : null;
    if (variant) {
      if (action === "edit" || action === "focus") { setSelection({ kind: "variant", id: id! }); navigate("focus", id!); }
      else if (action === "removeVariant") removeVariant(id!);
      else if (action === "deleteIdentity") deleteIdentity(variant.variant.entityId);
      return;
    }
    switch (action) {
      case "createChild": if (id) addNode(id); break;
      case "createAt": if (target.kind === "space") addNode(null, target.world); break;
      case "insertExisting": setInsertQuery(""); setInsertContext({ parentId: id, world: target.kind === "space" ? target.world : undefined }); break;
      case "connect": if (id) { setConnectionSource(id); setSelection({ kind: "node", id }); } break;
      case "toggle": if (id) toggleNode(id); break;
      case "focus": if (id) { setSelection({ kind: "node", id }); navigate("focus", id); } break;
      case "edit": if (id) { setSelection({ kind: "node", id }); navigate("focus", id); setTimeout(() => window.document.querySelector<HTMLInputElement>('[aria-label="Node name"]')?.focus(), 0); } break;
      case "removePlacement": if (id) removePlacement(id); break;
      case "deleteIdentity": if (id) { const entityId = document.placements.find((p) => p.id === id)?.entityId; if (entityId) deleteIdentity(entityId); } break;
      case "compact": compact(activeFrame ? { kind: "frame", frameId: activeFrame.id } : { kind: "all" }); break;
      case "fitAll": navigate("all"); break;
      case "settings": setSettingsOpen(true); break;
    }
  }
  function runAction(action: ActionId) {
    switch (action) {
      case "focus": if (selection?.kind === "node" || selection?.kind === "variant") navigate("focus", selection.id); break;
      case "fitLocal": navigate("local", selection?.kind === "node" ? selection.id : undefined); break;
      case "fitAll": navigate("all"); break;
      case "back": navigate("back"); break;
      case "newNode": addNode(null); break;
      case "newChild": if (selection?.kind === "node") addNode(selection.id); break;
      case "connect": if (selection?.kind === "node") setConnectionSource(selection.id); break;
      case "expand": if (selection?.kind === "node") toggleNode(selection.id); break;
      case "expandAll": if (selection?.kind === "node") nodeSubtreeClicked(selection.id); break;
      case "toggleSnap": setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: old.spatial.spacing ? 0 : 2 } })); break;
      case "axisX": setConstraintAxis("x"); break;
      case "axisY": setConstraintAxis("y"); break;
      case "axisZ": setConstraintAxis("z"); break;
      case "compactSelected": if (selection?.kind === "node") compact({ kind: "subsystem", placementId: selection.id }); break;
      case "compactFrame": if (activeFrame) compact({ kind: "frame", frameId: activeFrame.id }); break;
      case "compactAll": compact({ kind: "all" }); break;
      case "undo": undo(); break;
      case "redo": redo(); break;
      case "cancel": setConnectionSource(null); setInsertContext(null); setSettingsOpen(false); setOptionNodeId(null); navigate("cancel"); break;
      case "settings": setSettingsOpen(true); break;
    }
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (capturing) {
        event.preventDefault();
        const key = normalizeKey(event);
        if (key === "Esc") { setCapturing(null); return; }
        if (["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
        const conflict = keyConflict(settings.bindings, capturing, key);
        if (conflict) { setError(`Key ${key} is already assigned to ${ACTIONS.find((a) => a.id === conflict)?.label}.`); return; }
        setSettings((old) => ({ ...old, bindings: { ...old.bindings, [capturing]: key } }));
        setCapturing(null); setError(""); return;
      }
      if (isTypingTarget(event.target)) return;
      const action = actionForKey(settings.bindings, normalizeKey(event));
      if (!action || event.repeat) return;
      if ((settingsOpen || insertContext) && action !== "cancel") return;
      event.preventDefault(); runAction(action);
    };
    const keyup = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const action = actionForKey(settings.bindings, normalizeKey(event));
      if (action === "axisX" || action === "axisY" || action === "axisZ") setConstraintAxis(null);
    };
    window.addEventListener("keydown", keydown); window.addEventListener("keyup", keyup);
    return () => { window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup); };
  });
  function outline(parentId: string | null): React.ReactNode {
    return (
      <ul>
        {atlas.nodes
          .filter((n) => n.parentId === parentId)
          .map((n) => (
            <li key={n.id}>
              <div className="outline-row">
                {atlas.nodes.some((c) => c.parentId === n.id) ? (
                  <button
                    aria-label={`${n.collapsed ? "Expand" : "Collapse"} branch ${n.label}`}
                    onClick={() => patchNode(n.id, { collapsed: !n.collapsed })}
                  >
                    {n.collapsed ? "▸" : "▾"}
                  </button>
                ) : (
                  <span className="outline-spacer" />
                )}
                <button
                  className={selection?.id === n.id ? "outline-name active" : "outline-name"}
                  onClick={() => reveal(n.id)}
                  title={n.label}
                >
                  {n.label || "Untitled node"}
                </button>
              </div>
              {!n.collapsed && outline(n.id)}
            </li>
          ))}
      </ul>
    );
  }
  return (
    <div className="workbench">
      <header className="toolbar">
        <div className="brand">
          <strong>Omnium</strong>
          <span>Atlas workbench</span>
        </div>
        <div className="toolbar-actions">
          <label className="toolbar-snap">View<select aria-label="Layout view" value={document.activeLayoutViewId ?? "authored-layout"} onChange={(event) => switchView(event.target.value)}>
            {!document.layoutViews?.some((v) => v.id === "authored-layout") && <option value="authored-layout">Authored layout</option>}
            {document.layoutViews?.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
          </select></label>
          <label className="toolbar-snap">New view rule<select aria-label="New view rule" value={layoutRule} onChange={(event) => setLayoutRule(event.target.value as typeof layoutRule)}><option value="hierarchy">Hierarchy · top down</option><option value="flow">Directed flow · chosen roles</option><option value="compact">Compact · 3D</option><option value="manual">Manual · copy current</option></select></label>
          {layoutRule === "flow" && flowType && <>
            <label className="toolbar-snap">Order type<select aria-label="View relationship type" value={flowType.id} onChange={(event) => setFlowOrder({ typeId: event.target.value, fromRoleId: "", toRoleId: "" })}>{document.relationshipTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label className="toolbar-snap">Upstream role<select aria-label="View upstream role" value={resolvedOrder.fromRoleId} onChange={(event) => setFlowOrder({ ...resolvedOrder, fromRoleId: event.target.value })}>{flowType.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
            <label className="toolbar-snap">Downstream role<select aria-label="View downstream role" value={resolvedOrder.toRoleId} onChange={(event) => setFlowOrder({ ...resolvedOrder, toRoleId: event.target.value })}>{flowType.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          </>}
          <button onClick={newView}>+ Layout view</button>
          <button onClick={() => addNode(null)}>+ Node</button>
          <label className="toolbar-snap">Snap
            <select aria-label="Snap spacing" value={settings.spatial.spacing} onChange={(event) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: Number(event.target.value) as GridSpacing } }))}>
              {[0, 0.25, 0.5, 1, 2, 5].map((step) => <option key={step} value={step}>{step || "Off"}</option>)}
            </select>
          </label>
          <button onClick={() => setSettingsOpen(true)}>Workspace settings</button>
          <button onClick={undo} disabled={!past.length}>
            Undo
          </button>
          <button onClick={redo} disabled={!future.length}>
            Redo
          </button>
          <button onClick={exportJSON}>Export JSON</button>
          <button onClick={exportTemplate}>Save UI template</button>
          <button onClick={() => fileInput.current?.click()}>Import JSON</button>
          <button onClick={() => templateInput.current?.click()}>Load UI template</button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void importJSON(e.target.files?.[0]);
            }}
          />
          <input
            ref={templateInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void importTemplate(e.target.files?.[0]);
            }}
          />
        </div>
        <span className="save-status" role="status">
          {saveStatus} · {atlas.nodes.length} nodes · {atlas.relationships.length} relationships
        </span>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}
      {!autosave && (
        <div className="error">
          Autosave is paused to protect the unreadable saved document. Export your work before
          replacing it.
          <button
            onClick={() => {
              if (window.confirm("Replace the unreadable local save with the current atlas?")) {
                setAutosave(true);
                setRevision((r) => r + 1);
              }
            }}
          >
            Replace local save
          </button>
        </div>
      )}
      <main className="workspace">
        <aside className="sidebar">
          <section>
            <h2>Reuse identity</h2>
            <label>
              Find an existing entity or subsystem
              <input
                aria-label="Find existing identity"
                value={entityLookup}
                onChange={(e) => setEntityLookup(e.target.value)}
                placeholder="Search labels, aliases or IDs"
              />
            </label>
            {entityLookup && (
              <ul className="relationship-list">
                {document.entities
                  .filter((e) =>
                    `${e.id} ${e.label} ${e.aliases.join(" ")}`
                      .toLowerCase()
                      .includes(entityLookup.toLowerCase()),
                  )
                  .slice(0, 20)
                  .map((e) => (
                    <li key={e.id}>
                      <button onClick={() => insertExisting(e.id)}>
                        Insert {e.label || e.id} · {e.id}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {document.placements
              .filter((p) => p.hidden)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() =>
                    commitDocument({
                      ...document,
                      placements: document.placements.map((x) =>
                        x.id === p.id ? { ...x, hidden: false } : x,
                      ),
                    })
                  }
                >
                  Show hidden{" "}
                  {document.entities.find((e) => e.id === p.entityId)?.label || p.entityId}
                </button>
              ))}
          </section>
          <section>
            <h2>Hierarchy</h2>
            {activeLayout && <><label>View name<input aria-label="View name" value={activeLayout.name} onChange={(event) => commitDocument({ ...document, layoutViews: document.layoutViews?.map((v) => v.id === activeLayout.id ? { ...v, name: event.target.value } : v) })} /></label><p>Rule: {activeLayout.rule}. Switching views preserves the arrangement you leave.</p>{activeLayout.rule !== "manual" && <button onClick={reapplyView}>Reapply view rule</button>}{activeLayout.id !== "authored-layout" && <button onClick={removeView}>Remove view</button>}</>}
            {atlas.nodes.length ? (
              <nav aria-label="Node hierarchy">{outline(null)}</nav>
            ) : (
              <p>Add a node to begin your atlas.</p>
            )}
          </section>
          <section>
            <h2>Investigative frames</h2>
            <label>
              Question or objective
              <input
                aria-label="Frame question"
                value={frameQuestion}
                onChange={(e) => setFrameQuestion(e.target.value)}
                placeholder="Optional; selected identity becomes anchor"
              />
            </label>
            <button onClick={createFrame}>Start frame</button>
            <label>
              Reopen frame
              <select
                aria-label="Reopen frame"
                value={document.activeFrameId ?? ""}
                onChange={(e) => {
                  commitDocument({ ...document, activeFrameId: e.target.value || null });
                  setSelection(null);
                }}
              >
                <option value="">Whole atlas</option>
                {document.frames
                  .filter((f) => !f.discarded)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name || f.question || f.id}
                    </option>
                  ))}
              </select>
            </label>
            {document.frames
              .filter((f) => f.discarded)
              .map((f) => (
                <button
                  key={f.id}
                  onClick={() =>
                    commitDocument({
                      ...document,
                      activeFrameId: f.id,
                      frames: document.frames.map((item) =>
                        item.id === f.id ? { ...item, discarded: false } : item,
                      ),
                    })
                  }
                >
                  Recover discarded frame: {f.name || f.question || f.id}
                </button>
              ))}
            {activeFrame && (
              <>
                <p>
                  Saved at knowledge revision {activeFrame.savedRevision}. Current revision{" "}
                  {document.revision}.
                </p>
                <p>
                  Missing references:{" "}
                  {[...activeFrame.scope.entityIds, ...activeFrame.scope.anchorIds]
                    .filter((id) => !document.entities.some((e) => e.id === id))
                    .concat(
                      activeFrame.scope.relationshipIds.filter(
                        (id) => !document.relationships.some((r) => r.id === id),
                      ),
                    )
                    .join(", ") || "None"}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={activeFrame.locked}
                    onChange={(e) =>
                      commitDocument({
                        ...document,
                        frames: document.frames.map((f) =>
                          f.id === activeFrame.id ? { ...f, locked: e.target.checked } : f,
                        ),
                      })
                    }
                  />{" "}
                  Lock frame scope
                </label>
                <label>
                  Find identity to include
                  <input
                    aria-label="Find frame identity"
                    value={frameLookup}
                    onChange={(e) => setFrameLookup(e.target.value)}
                  />
                </label>
                {frameLookup &&
                  document.entities
                    .filter((e) =>
                      `${e.id} ${e.label} ${e.aliases.join(" ")}`
                        .toLowerCase()
                        .includes(frameLookup.toLowerCase()),
                    )
                    .slice(0, 10)
                    .map((e) => (
                      <button
                        key={e.id}
                        disabled={activeFrame.locked}
                        onClick={() => {
                          refineFrame({
                            ...activeFrame.scope,
                            entityIds: [...new Set([...activeFrame.scope.entityIds, e.id])],
                            excludedEntityIds: activeFrame.scope.excludedEntityIds.filter(
                              (id) => id !== e.id,
                            ),
                          });
                          setFrameLookup("");
                        }}
                      >
                        Include {e.label || e.id}
                      </button>
                    ))}
                {activeFrame.scope.entityIds.map((id) => (
                  <div key={id}>
                    {document.entities.find((e) => e.id === id)?.label || `Missing: ${id}`}
                    <button
                      disabled={activeFrame.locked}
                      onClick={() =>
                        refineFrame({
                          ...activeFrame.scope,
                          entityIds: activeFrame.scope.entityIds.filter((x) => x !== id),
                          excludedEntityIds: [
                            ...new Set([...activeFrame.scope.excludedEntityIds, id]),
                          ],
                        })
                      }
                    >
                      Exclude
                    </button>
                  </div>
                ))}
                <label>
                  Exploration depth
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={activeFrame.scope.depth ?? ""}
                    disabled={activeFrame.locked}
                    onChange={(e) =>
                      refineFrame({
                        ...activeFrame.scope,
                        depth: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </label>
                <p>Charted relationships in frame</p>
                {document.relationships
                  .filter((r) =>
                    r.participants.every((p) => activeFrame.scope.entityIds.includes(p.entityId)),
                  )
                  .map((r) => (
                    <label key={r.id}>
                      <input
                        type="checkbox"
                        disabled={activeFrame.locked}
                        checked={activeFrame.scope.relationshipIds.includes(r.id)}
                        onChange={(e) =>
                          refineFrame({
                            ...activeFrame.scope,
                            relationshipIds: e.target.checked
                              ? [...activeFrame.scope.relationshipIds, r.id]
                              : activeFrame.scope.relationshipIds.filter((id) => id !== r.id),
                          })
                        }
                      />{" "}
                      {r.label || document.relationshipTypes.find((t) => t.id === r.typeId)?.name} (
                      {r.id})
                    </label>
                  ))}
                {activeFrame.history.length > 0 && (
                  <button
                    disabled={activeFrame.locked}
                    onClick={() => refineFrame(activeFrame.history.at(-1)!.scope)}
                  >
                    Restore previous scope
                  </button>
                )}
                <button
                  onClick={() =>
                    commitDocument({
                      ...document,
                      frames: document.frames.map((f) =>
                        f.id === activeFrame.id
                          ? {
                              ...f,
                              promoted: true,
                              name: f.name || f.question || `Boundary ${f.id.slice(0, 8)}`,
                            }
                          : f,
                      ),
                    })
                  }
                >
                  Promote as reusable boundary
                </button>
                <button onClick={() => commitDocument({ ...document, activeFrameId: null })}>
                  Close frame
                </button>
                <button
                  onClick={() =>
                    commitDocument({
                      ...document,
                      activeFrameId: null,
                      frames: document.frames.map((f) =>
                        f.id === activeFrame.id ? { ...f, discarded: true } : f,
                      ),
                    })
                  }
                >
                  Discard frame
                </button>
              </>
            )}
          </section>
          <section className="inspector">
            <h2>{selectedVariant ? "Variant" : selectedComposition ? "Composition binder" : selectedRelationship ? "Relationship" : selectedNode ? "Node" : "Inspector"}</h2>
            {selectedVariant && variantEntity ? <>
              <p>Variant of {document.entities.find((e) => e.id === selectedVariant.ownerId)?.label || selectedVariant.ownerId}. Owned by this node, separate from structural contents.</p>
              <p>Identity: <code>{variantEntity.id}</code></p>
              <label>Name<input aria-label="Variant name" maxLength={500} value={variantEntity.label} onChange={(event) => commitDocument({ ...document, entities: document.entities.map((e) => e.id === variantEntity.id ? { ...e, label: event.target.value } : e) })} /></label>
              <label>Notes<textarea aria-label="Variant notes" maxLength={10000} value={variantEntity.notes} onChange={(event) => commitDocument({ ...document, entities: document.entities.map((e) => e.id === variantEntity.id ? { ...e, notes: event.target.value } : e) })} /></label>
              <AppearanceControls label="Variant" value={selectedVariant.appearance} defaults={{ color: "#bda1ec", opacity: 1 }} onChange={(appearance) => commitDocument({ ...document, variants: document.variants?.map((v) => v.id === selectedVariant.id ? { ...v, appearance } : v) })} />
              <button onClick={() => selection && removeVariant(selection.id)}>Remove variant from owner</button>
              <button className="danger" onClick={() => deleteIdentity(variantEntity.id)}>Delete variant identity and all references</button>
            </> : selectedNode ? (
              <>
                <p>
                  Identity: <code>{selectedEntity?.id}</code>
                  <br />
                  Placement: <code>{selectedNode.id}</code>
                </p>
                <p>
                  {document.placements.filter((p) => p.entityId === selectedEntity?.id).length}{" "}
                  placement(s) reference this identity.
                </p>
                <button onClick={() => selectedEntity && navigateIdentity(selectedEntity.id)}>
                  Navigate other reference
                </button>
                <p>
                  Structural contents:{" "}
                  {document.compositions.filter((c) => c.parentId === selectedEntity?.id).length}
                </p>
                {document.compositions.some((c) => c.parentId === selectedEntity?.id) && (
                  <>
                    <button
                      onClick={() =>
                        selectedNode.collapsed
                          ? commitDocument(expandPlacement(document, selectedNode.id))
                          : patchNode(selectedNode.id, { collapsed: true })
                      }
                    >
                      {selectedNode.collapsed
                        ? "Expand structural contents"
                        : "Collapse structural contents"}
                    </button>
                    {!selectedNode.collapsed &&
                      document.compositions
                        .filter((c) => c.parentId === selectedEntity?.id)
                        .map((c) => (
                          <div key={c.id} className="structural-parent-row"><button onClick={() => navigateIdentity(c.childId)}>
                            {document.entities.find((e) => e.id === c.childId)?.label || c.childId}
                          </button><button onClick={() => setSelection({ kind: "composition", id: c.id })}>Edit composition binder</button></div>
                        ))}
                  </>
                )}
                <p>
                  Relationships:{" "}
                  {document.relationships
                    .filter((r) => r.participants.some((p) => p.entityId === selectedEntity?.id))
                    .map(
                      (r) =>
                        `${document.relationshipTypes.find((t) => t.id === r.typeId)?.name ?? r.typeId} (${r.id})`,
                    )
                    .join(", ") || "None charted"}
                </p>
                <label>
                  Name
                  <input
                    aria-label="Node name"
                    value={selectedNode.label}
                    maxLength={500}
                    onChange={(e) => patchNode(selectedNode.id, { label: e.target.value })}
                  />
                </label>
                <AppearanceControls label="Node" value={selectedPlacement?.appearance} defaults={{ color: "#dce9fa", opacity: 1 }} onChange={(appearance) => commitDocument({ ...document, placements: document.placements.map((p) => p.id === selectedNode.id ? { ...p, appearance } : p) })} />
                <label>
                  Aliases (comma-separated)
                  <input
                    aria-label="Entity aliases"
                    value={selectedEntity?.aliases.join(", ") ?? ""}
                    onChange={(e) => {
                      if (!selectedEntity) return;
                      commitDocument({
                        ...document,
                        entities: document.entities.map((item) =>
                          item.id === selectedEntity.id
                            ? {
                                ...item,
                                aliases: e.target.value
                                  .split(",")
                                  .map((alias) => alias.trim())
                                  .filter(Boolean),
                              }
                            : item,
                        ),
                      });
                    }}
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    aria-label="Node notes"
                    value={selectedNode.notes}
                    maxLength={10000}
                    rows={4}
                    onChange={(e) => patchNode(selectedNode.id, { notes: e.target.value })}
                  />
                </label>
                <label>
                  Visual parent (placement only)
                  <select
                    aria-label="Node parent"
                    value={selectedNode.parentId ?? ""}
                    onChange={(e) => {
                      try { commitDocument(reparentVisual(document, selectedNode.id, e.target.value || null, settings.spatial)); navigate("focus", selectedNode.id); }
                      catch (error) { setError(message(error)); }
                    }}
                  >
                    <option value="">None (root)</option>
                    {atlas.nodes
                      .filter((n) => n.id !== selectedNode.id && !forbiddenParents.has(n.id))
                      .map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.label || "Untitled node"}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Structural container
                  <select
                    aria-label="Structural container"
                    value=""
                    onChange={(e) => {
                      if (!selectedEntity) return;
                      if (
                        e.target.value &&
                        !document.compositions.some(
                          (c) => c.parentId === e.target.value && c.childId === selectedEntity.id,
                        )
                      )
                        commitDocument({
                          ...document,
                          compositions: [
                            ...document.compositions,
                            { id: newId(), parentId: e.target.value, childId: selectedEntity.id },
                          ],
                        });
                    }}
                  >
                    <option value="">Add structural container…</option>
                    {document.entities
                      .filter((e) => e.id !== selectedEntity?.id)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label || e.id}
                        </option>
                      ))}
                  </select>
                </label>
                {document.compositions
                  .filter((c) => c.childId === selectedEntity?.id)
                  .map((c) => (
                    <div key={c.id} className="structural-parent-row">
                      {document.entities.find((e) => e.id === c.parentId)?.label || c.parentId}
                      <button
                        onClick={() =>
                          commitDocument({
                            ...document,
                            compositions: document.compositions.filter((x) => x.id !== c.id),
                          })
                        }
                      >
                        Remove structural containment
                      </button>
                    </div>
                  ))}
                <div className="spatial-fields" aria-label="3D position">
                  <h3>3D position (local XYZ)</h3>
                  {(["x", "y", "z"] as const).map((axis) => {
                    const fallback = {
                      x: selectedNode.position.x / 100,
                      y: selectedNode.parentId ? -2 : 0,
                      z: selectedNode.position.y / 100,
                    };
                    const coordinates = selectedNode.spatialPosition ?? fallback;
                    return (
                      <label key={axis}>
                        {axis.toUpperCase()}
                        <input
                          aria-label={`3D ${axis.toUpperCase()} position`}
                          type="number"
                          step="0.1"
                          min="-10000"
                          max="10000"
                          value={coordinates[axis]}
                          onChange={(event) => {
                            const value = Number(event.target.value);
                            if (Number.isFinite(value) && Math.abs(value) <= 10000)
                              patchNode(selectedNode.id, {
                                spatialPosition: { ...coordinates, [axis]: value },
                              });
                          }}
                        />
                      </label>
                    );
                  })}
                  {selectedNode.spatialPosition && (
                    <button
                      onClick={() => patchNode(selectedNode.id, { spatialPosition: {
                        x: selectedNode.position.x / 100,
                        y: selectedNode.parentId ? -2 : 0,
                        z: selectedNode.position.y / 100,
                      } })}
                    >
                      Move near legacy 2D position
                    </button>
                  )}
                </div>
                <button onClick={() => addNode(selectedNode.id)}>+ Child node</button>
                <label>
                  <input
                    type="checkbox"
                    checked={selectedPlacement?.hidden ?? false}
                    onChange={(e) =>
                      commitDocument({
                        ...document,
                        placements: document.placements.map((p) =>
                          p.id === selectedNode.id ? { ...p, hidden: e.target.checked } : p,
                        ),
                      })
                    }
                  />{" "}
                  Hide this placement
                </label>
                <button onClick={() => removePlacement(selectedNode.id)}>
                  Remove this placement
                </button>
                <button
                  className="danger"
                  onClick={() => selectedEntity && deleteIdentity(selectedEntity.id)}
                >
                  Delete identity and all references
                </button>
                {forbiddenParents.size > 0 && (
                  <button
                    onClick={() => {
                      patchNode(selectedNode.id, { collapsed: !selectedNode.collapsed });
                      fit();
                    }}
                  >
                    {selectedNode.collapsed ? "Expand children" : "Collapse children"}
                  </button>
                )}
              </>
            ) : selectedComposition ? (
              <>
                <p>{document.entities.find((e) => e.id === selectedComposition.parentId)?.label} → {document.entities.find((e) => e.id === selectedComposition.childId)?.label}</p>
                <p>Authored structural composition. This binder is independent of spatial positioning.</p>
                <BinderControls composition value={selectedComposition} onChange={(changes) => commitDocument({ ...document, compositions: document.compositions.map((c) => c.id === selectedComposition.id ? { ...c, ...changes } : c) })} />
              </>
            ) : selectedRelationship ? (
              <>
                <p>
                  Relationship ID: <code>{selectedRelationship.id}</code>
                </p>
                {selectedRelationData && <BinderControls value={selectedRelationData} onChange={updateRelation} />}
                <label>
                  Type
                  <select
                    aria-label="Relationship type"
                    value={selectedRelationData?.typeId ?? ""}
                    onChange={(e) => {
                      const type = document.relationshipTypes.find((t) => t.id === e.target.value);
                      if (type && selectedRelationData)
                        updateRelation({
                          typeId: type.id,
                          participants: selectedRelationData.participants
                            .slice(0, 2)
                            .map((p, i) => ({ ...p, roleId: type.roles[i].id })),
                        });
                    }}
                  >
                    {document.relationshipTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.symbol} {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Label
                  <input
                    aria-label="Relationship label"
                    maxLength={500}
                    value={selectedRelationship.label}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, label: e.target.value } : r,
                        ),
                      })
                    }
                  />
                </label>
                <label>
                  From
                  <select
                    aria-label="Relationship source"
                    value={selectedRelationship.source}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, source: e.target.value } : r,
                        ),
                      })
                    }
                  >
                    {options()}
                  </select>
                </label>
                <label>
                  To
                  <select
                    aria-label="Relationship target"
                    value={selectedRelationship.target}
                    onChange={(e) =>
                      commit({
                        ...atlas,
                        relationships: atlas.relationships.map((r) =>
                          r.id === selectedRelationship.id ? { ...r, target: e.target.value } : r,
                        ),
                      })
                    }
                  >
                    {options()}
                  </select>
                </label>
                {selectedRelationData?.participants.slice(0, 2).map((participant, i) => {
                  const type = document.relationshipTypes.find(
                    (t) => t.id === selectedRelationData.typeId,
                  );
                  return (
                    <label key={i}>
                      Participant {i + 1} role
                      <select
                        value={participant.roleId}
                        onChange={(e) =>
                          updateRelation({
                            participants: selectedRelationData.participants.map((p, index) =>
                              index === i ? { ...p, roleId: e.target.value } : p,
                            ),
                          })
                        }
                      >
                        {type?.roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
                <button
                  className="danger"
                  onClick={() => {
                    commit({
                      ...atlas,
                      relationships: atlas.relationships.filter(
                        (r) => r.id !== selectedRelationship.id,
                      ),
                    });
                    setSelection(null);
                  }}
                >
                  Delete relationship
                </button>
              </>
            ) : (
              <p>Select a node or relationship to edit it.</p>
            )}
          </section>
          <section>
            <h2>Connect nodes</h2>
            <p>Choose endpoints below to add a directed relationship.</p>
            <label>
              From
              <select
                aria-label="New relationship source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Choose node</option>
                {options()}
              </select>
            </label>
            <label>
              To
              <select
                aria-label="New relationship target"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                <option value="">Choose node</option>
                {options()}
              </select>
            </label>
            <button
              disabled={
                !atlas.nodes.some((n) => n.id === source) ||
                !atlas.nodes.some((n) => n.id === target)
              }
              onClick={() => connect({ source, target })}
            >
              Add relationship
            </button>
          </section>
          <section>
            <h2>Relationship types</h2>
            <button onClick={createType}>+ Define type</button>
            {document.relationshipTypes.map((type) => (
              <div key={type.id}>
                <label>
                  Type name{" "}
                  <input
                    aria-label={`Type name ${type.id}`}
                    value={type.name}
                    onChange={(e) => patchType(type.id, { name: e.target.value })}
                  />
                </label>
                <label>
                  Display symbol{" "}
                  <input
                    aria-label={`Type symbol ${type.id}`}
                    value={type.symbol}
                    maxLength={50}
                    onChange={(e) => patchType(type.id, { symbol: e.target.value })}
                  />
                </label>
                <label>
                  Definition{" "}
                  <textarea
                    aria-label={`Type definition ${type.id}`}
                    value={type.definition}
                    onChange={(e) => patchType(type.id, { definition: e.target.value })}
                  />
                </label>
                {type.roles.slice(0, 2).map((role, i) => (
                  <label key={role.id}>
                    Role {i + 1}
                    <input
                      aria-label={`Role ${i + 1} ${type.id}`}
                      value={role.name}
                      onChange={(e) =>
                        patchType(type.id, {
                          roles: type.roles.map((r) =>
                            r.id === role.id ? { ...r, name: e.target.value } : r,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            ))}
          </section>
          <section>
            <h2>External AI proposal</h2>
            <p>
              Export the atlas JSON for an external AI. Ask it for an <code>omnium-changeset</code>{" "}
              with this document revision ({document.revision}) and stable IDs. Valid structure
              still needs your factual review.
            </p>
            <textarea
              aria-label="Change set JSON"
              rows={7}
              value={proposalText}
              onChange={(e) => {
                setProposalText(e.target.value);
                setProposalPreview(null);
              }}
              placeholder="Paste change-set JSON"
            />
            <button onClick={() => proposalInput.current?.click()}>
              Load change-set JSON file
            </button>
            <input
              ref={proposalInput}
              type="file"
              accept=".json,application/json"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && file.size > 5_000_000)
                  setError("Change set exceeds the 5 MB import limit.");
                else if (file)
                  void file
                    .text()
                    .then((value) => {
                      setProposalText(value);
                      setProposalPreview(null);
                    })
                    .catch((error) => setError(message(error)));
                event.target.value = "";
              }}
            />
            <button onClick={reviewProposal}>Validate and preview</button>
            {proposalPreview && (
              <div className="proposal-preview">
                <p>Proposed changes at revision {document.revision}:</p>
                <ul>
                  {proposalPreview.lines.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    if (window.confirm("Apply these reviewed structural changes?")) {
                      commitDocument(proposalPreview.next);
                      setProposalText("");
                    }
                  }}
                >
                  Approve and apply atomically
                </button>
              </div>
            )}
          </section>
          {atlas.relationships.length > 0 && (
            <section>
              <h2>Relationships</h2>
              <p>
                3D links connect through collapsed ancestors. This list retains every relationship.
              </p>
              <ul className="relationship-list">
                {atlas.relationships.map((r) => (
                  <li key={r.id}>
                    <button
                      className={selection?.id === r.id ? "active" : ""}
                      onClick={() => setSelection({ kind: "relationship", id: r.id })}
                    >
                      {atlas.nodes.find((n) => n.id === r.source)?.label || "Untitled"} →{" "}
                      {atlas.nodes.find((n) => n.id === r.target)?.label || "Untitled"}
                      <small>{r.label || "Unlabelled relationship"}</small>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="help">
            <p>
              Left-drag empty space to pan; right-drag to rotate; scroll to zoom. Drag a name to move it. Shift-drag it onto another name to nest. Click a binder to edit its operators and appearance.
            </p>
            <button onClick={() => compact({ kind: "all" })}>Compact entire atlas</button>
            <button disabled={selection?.kind !== "node"} onClick={() => selection?.kind === "node" && compact({ kind: "subsystem", placementId: selection.id })}>Compact selected subsystem</button>
            <button disabled={!activeFrame} onClick={() => activeFrame && compact({ kind: "frame", frameId: activeFrame.id })}>Compact current frame</button>
            <p>
              Autosave is specific to this browser and origin. Export JSON for a portable backup.
              This is a private local atlas.
            </p>
          </section>
        </aside>
        <div className="canvas" aria-label="Atlas canvas">
          <Suspense fallback={<div className="spatial-loading">Opening 3D workspace…</div>}>
            <SpatialWorkspace
              atlas={atlas}
              document={document}
              selectedId={selection?.kind === "node" || selection?.kind === "variant" ? selection.id : null}
              variantDisplay={variantDisplay}
              optionNodeId={optionNodeId}
              expandedVariants={expandedVariants}
              onToggleVariants={toggleVariants}
              onAddVariant={createVariant}
              onDismissOptions={() => setOptionNodeId(null)}
              settings={settings}
              command={navCommand}
              constraintAxis={constraintAxis}
              onNodeClick={nodeClicked}
              onNodeDoubleClick={nodeDoubleClicked}
              onSubtreeClick={nodeSubtreeClicked}
              onBinderSelect={(id, kind) => setSelection({ kind, id })}
              resolveMove={(id, local) => moveDisplayedNode(id, local, true)}
              onMove={(id, local) => { try { moveDisplayedNode(id, local); } catch (e) { setError(message(e)); } }}
              canNest={nestReason}
              onNest={nest}
              onContextAction={contextAction}
            />
          </Suspense>
          {!atlas.nodes.length && (
            <div className="empty-state">
              <h1>Build your atlas</h1>
              <button onClick={() => addNode(null)}>+ Add first node</button>
            </div>
          )}
        </div>
      </main>
      {connectionSource && <div className="operation-banner" role="status">Select another name to connect from {atlas.nodes.find((n) => n.id === connectionSource)?.label || "selected node"}. <button onClick={() => setConnectionSource(null)}>Cancel</button></div>}
      {insertContext && <div className="workspace-dialog-backdrop" onClick={() => setInsertContext(null)}><div className="workspace-dialog" role="dialog" aria-label="Insert existing entity" onClick={(event) => event.stopPropagation()}>
        <h2>Insert existing entity or subsystem</h2>
        <input autoFocus aria-label="Search existing entities" value={insertQuery} onChange={(event) => setInsertQuery(event.target.value)} placeholder="Search label, alias, or ID" />
        <div className="entity-results">{document.entities.filter((entity) => `${entity.id} ${entity.label} ${entity.aliases.join(" ")}`.toLowerCase().includes(insertQuery.toLowerCase())).slice(0, 30).map((entity) => <button key={entity.id} onClick={() => insertExisting(entity.id, insertContext.parentId, insertContext.world)}>{entity.label || entity.id}<small>{entity.id}</small></button>)}</div>
        <button onClick={() => setInsertContext(null)}>Close</button>
      </div></div>}
      {settingsOpen && <div className="workspace-dialog-backdrop" onClick={() => setSettingsOpen(false)}><div className="workspace-dialog settings-dialog" role="dialog" aria-label="Workspace settings" onClick={(event) => event.stopPropagation()}>
        <h2>Workspace settings</h2>
        <label>Snap spacing<select aria-label="Settings snap spacing" value={settings.spatial.spacing} onChange={(event) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, spacing: Number(event.target.value) as GridSpacing } }))}>{[0, 0.25, 0.5, 1, 2, 5].map((step) => <option key={step} value={step}>{step || "Off"}</option>)}</select></label>
        <label>Minimum placement clearance radius<input type="number" min="0.25" max="3" step="0.05" value={settings.spatial.radius} onChange={(event) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, radius: Math.max(0.25, Math.min(3, Number(event.target.value) || 0.25)) } }))} /></label>
        <label>Collision clearance<input type="number" min="0" max="2" step="0.05" value={settings.spatial.clearance} onChange={(event) => setSettings((old) => ({ ...old, spatial: { ...old.spatial, clearance: Math.max(0, Math.min(2, Number(event.target.value) || 0)) } }))} /></label>
        {(["leftEmpty", "rightEmpty"] as const).map((button) => <label key={button}>{button === "leftEmpty" ? "Left-drag empty space" : "Right-drag empty space"}<select value={settings.mouse[button]} onChange={(event) => setSettings((old) => ({ ...old, mouse: { ...old.mouse, [button]: event.target.value as WorkspaceSettings["mouse"][typeof button] } }))}><option value="pan">Pan</option><option value="rotate">Rotate</option><option value="none">None</option></select></label>)}
        <label>Expand/collapse subtree click modifier<select aria-label="Subtree click modifier" value={settings.mouse.subtreeModifier} onChange={(event) => setSettings((old) => ({ ...old, mouse: { ...old.mouse, subtreeModifier: event.target.value as WorkspaceSettings["mouse"]["subtreeModifier"] } }))}><option value="shift">Shift</option><option value="alt">Alt</option><option value="ctrl">Ctrl / Cmd</option><option value="none">Off</option></select></label>
        <h2>Keyboard actions</h2>
        {ACTIONS.some((action) => keyConflict(settings.bindings, action.id, settings.bindings[action.id])) && <p role="alert">Some bindings conflict. Reassign or clear the duplicate keys.</p>}
        {Array.from(new Set(ACTIONS.map((action) => action.category))).map((category) => <div key={category} className="settings-category"><h3>{category}</h3>{ACTIONS.filter((action) => action.category === category).map((action) => <div key={action.id} className="binding-row"><span>{action.label}</span><button onClick={() => setCapturing(action.id)}>{capturing === action.id ? "Press a key…" : settings.bindings[action.id] || "Unassigned"}</button><button aria-label={`Clear ${action.label} binding`} onClick={() => setSettings((old) => ({ ...old, bindings: { ...old.bindings, [action.id]: "" } }))}>×</button></div>)}</div>)}
        <div className="dialog-actions"><button onClick={() => { setSettings(defaultSettings()); setCapturing(null); }}>Restore defaults</button><button onClick={() => { setSettingsOpen(false); setCapturing(null); }}>Close</button></div>
      </div></div>}
    </div>
  );
}
export default function App() {
  return <Workbench />;
}
