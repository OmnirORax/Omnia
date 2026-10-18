import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  applyNodeChanges,
  useReactFlow,
} from "@xyflow/react";
import type { Node, NodeProps, NodeChange, Connection, Viewport } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./workbench.css";
import { descendants, emptyAtlas, newId, parseAtlas, removeNode, reparent } from "./graph/model";
import type { Atlas, AtlasNode } from "./graph/model";
import { projectAtlas } from "./graph/projection";
const SpatialWorkspace = lazy(() => import("./SpatialWorkspace"));

const STORAGE_KEY = "omnium.atlas.v1";
const VIEW_STORAGE_KEY = "omnium.view.v1";
const DEFAULT_GRID = 24;
type ViewConfig = {
  format: "omnium-ui-template";
  version: 1;
  atlas: Atlas;
  viewport: Viewport;
  snapEnabled: boolean;
  gridSize: number;
};
type Selection = { kind: "node" | "relationship"; id: string } | null;
type Card = Node<
  { label: string; collapsed: boolean; childCount: number; toggle: () => void },
  "atlas"
>;
function AtlasCard({ data, selected }: NodeProps<Card>) {
  return (
    <div
      className={`atlas-card ${selected ? "is-selected" : ""} ${data.childCount && !data.collapsed ? "is-container" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: 42 }}
        aria-label="Incoming relationship"
      />
      <div className="node-heading">
        {data.childCount > 0 && (
          <button
            className="nodrag nopan collapse-button"
            onClick={data.toggle}
            aria-label={`${data.collapsed ? "Expand" : "Collapse"} ${data.label}`}
          >
            {data.collapsed ? "▸" : "▾"}
          </button>
        )}
        <span title={data.label}>{data.label || "Untitled node"}</span>
      </div>
      {data.childCount > 0 && (
        <div className="node-caption">
          {data.childCount} child{data.childCount === 1 ? "" : "ren"}
          {data.collapsed ? " · collapsed" : ""}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ top: 42 }}
        aria-label="Outgoing relationship"
      />
    </div>
  );
}
const nodeTypes = { atlas: AtlasCard };
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
function loadInitial(): { atlas: Atlas; error: string } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { atlas: saved ? parseAtlas(saved) : emptyAtlas(), error: "" };
  } catch (e) {
    return {
      atlas: emptyAtlas(),
      error: `Saved atlas could not be loaded. It has not been overwritten. ${message(e)}`,
    };
  }
}
function Workbench() {
  const [initial] = useState(loadInitial);
  const [atlas, setAtlas] = useState(initial.atlas);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState(initial.error);
  const [autosave, setAutosave] = useState(!initial.error);
  const [saveStatus, setSaveStatus] = useState(initial.error ? "Autosave paused" : "Saved locally");
  const [revision, setRevision] = useState(0);
  const [past, setPast] = useState<Atlas[]>([]);
  const [future, setFuture] = useState<Atlas[]>([]);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState("");
  const [workspaceView, setWorkspaceView] = useState<"2d" | "3d">(() => {
    try {
      return localStorage.getItem("omnium.workspace.view.v1") === "3d" ? "3d" : "2d";
    } catch {
      return "2d";
    }
  });
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState(DEFAULT_GRID);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const fileInput = useRef<HTMLInputElement>(null);
  const templateInput = useRef<HTMLInputElement>(null);
  const flow = useReactFlow<Card>();
  useEffect(() => {
    try {
      localStorage.setItem("omnium.workspace.view.v1", workspaceView);
    } catch {
      /* view preference is optional */
    }
  }, [workspaceView]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved) {
        const value = JSON.parse(saved) as Partial<ViewConfig>;
        if (
          value.viewport &&
          typeof value.viewport.x === "number" &&
          typeof value.viewport.y === "number" &&
          typeof value.viewport.zoom === "number"
        )
          setViewport(value.viewport);
        if (typeof value.snapEnabled === "boolean") setSnapEnabled(value.snapEnabled);
        if (
          typeof value.gridSize === "number" &&
          [8, 12, 16, 24, 32, 48, 64].includes(value.gridSize)
        )
          setGridSize(value.gridSize);
      }
    } catch {
      /* use defaults */
    }
  }, []);
  function commit(next: Atlas) {
    try {
      const validated = parseAtlas(JSON.stringify(next));
      setPast((p) => [...p.slice(-49), atlas]);
      setFuture([]);
      setAtlas(validated);
      setRevision((r) => r + 1);
      setError("");
    } catch (e) {
      setError(message(e));
    }
  }
  useEffect(() => {
    if (!revision || !autosave) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(atlas));
      setSaveStatus("Saved locally");
    } catch {
      setSaveStatus("Not saved");
      setError("Local storage is unavailable or full. Export JSON now to keep your work.");
    }
  }, [atlas, revision, autosave]);
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ viewport, snapEnabled, gridSize }));
    } catch {
      /* view persistence is best effort */
    }
  }, [viewport, snapEnabled, gridSize]);
  const projection = useMemo(() => projectAtlas(atlas), [atlas]);
  const renderedNodes: Card[] = projection.nodes.map((n) => ({
    id: n.id,
    type: "atlas",
    position: n.position,
    parentId: n.parentId ?? undefined,
    style: { width: n.width, height: n.height },
    selected: selection?.kind === "node" && selection.id === n.id,
    data: {
      label: n.label,
      collapsed: n.collapsed,
      childCount: n.childCount,
      toggle: () => patchNode(n.id, { collapsed: !n.collapsed }),
    },
  }));
  const [viewNodes, setViewNodes] = useState<Card[]>(renderedNodes);
  // Transient drag positions and measurements belong to the view only.
  useEffect(() => {
    setViewNodes(renderedNodes);
  }, [atlas, selection]);
  const edges = projection.relationships.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    label: `${r.label || "Relationship"}${r.projected ? " ↗" : ""}`,
    selected: selection?.kind === "relationship" && selection.id === r.id,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: {
      stroke: "#687586",
      strokeWidth: 1.8,
      strokeDasharray: r.projected ? "6 4" : undefined,
    },
    labelStyle: { fill: "#24354b", fontSize: 12 },
    labelBgPadding: [6, 4] as [number, number],
  }));
  function patchNode(id: string, changes: Partial<AtlasNode>) {
    commit({ ...atlas, nodes: atlas.nodes.map((n) => (n.id === id ? { ...n, ...changes } : n)) });
  }
  function fit() {
    setTimeout(() => {
      void flow.fitView({ padding: 0.18, duration: 180 });
    }, 80);
  }
  function addNode(parentId: string | null) {
    const id = newId();
    const siblings = atlas.nodes.filter((n) => n.parentId === parentId);
    const y = Math.max(
      104,
      ...siblings.map(
        (n) => n.position.y + (projection.nodes.find((p) => p.id === n.id)?.height ?? 84) + 28,
      ),
    );
    commit({
      ...atlas,
      nodes: [
        ...atlas.nodes.map((n) => (n.id === parentId ? { ...n, collapsed: false } : n)),
        {
          id,
          label: "New node",
          notes: "",
          parentId,
          collapsed: false,
          position: parentId
            ? { x: 28, y }
            : {
                x: Math.max(
                  60,
                  ...siblings.map(
                    (n) =>
                      n.position.x +
                      (projection.nodes.find((p) => p.id === n.id)?.width ?? 232) +
                      68,
                  ),
                ),
                y: 60,
              },
        },
      ],
    });
    setSelection({ kind: "node", id });
    fit();
  }
  function connect(connection: Pick<Connection, "source" | "target">) {
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
    setFuture((f) => [atlas, ...f]);
    setPast((p) => p.slice(0, -1));
    setAtlas(previous);
    setSelection(null);
    setRevision((r) => r + 1);
  }
  function redo() {
    if (!future[0]) return;
    setPast((p) => [...p, atlas]);
    setAtlas(future[0]);
    setFuture((f) => f.slice(1));
    setSelection(null);
    setRevision((r) => r + 1);
  }
  function exportJSON() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(atlas, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "omnium-atlas.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportTemplate() {
    const template: ViewConfig = {
      format: "omnium-ui-template",
      version: 1,
      atlas,
      viewport,
      snapEnabled,
      gridSize,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(template, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
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
        (value as ViewConfig).version !== 1
      )
        throw new Error("Expected an Omnium UI template version 1.");
      const template = value as ViewConfig;
      const next = parseAtlas(JSON.stringify(template.atlas));
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas and UI layout with this template? You can undo this action.",
        )
      )
        return;
      commit(next);
      setViewport(template.viewport);
      setSnapEnabled(Boolean(template.snapEnabled));
      setGridSize(
        [8, 12, 16, 24, 32, 48, 64].includes(template.gridSize) ? template.gridSize : DEFAULT_GRID,
      );
      setSelection(null);
      setTimeout(() => {
        flow.setViewport(template.viewport, { duration: 180 });
      }, 80);
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
      const next = parseAtlas(await file.text());
      if (
        atlas.nodes.length &&
        !window.confirm(
          "Replace the current atlas with this file? You can undo this action. Export first to keep a separate backup.",
        )
      )
        return;
      commit(next);
      setSelection(null);
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
    fit();
  }
  function options() {
    return atlas.nodes.map((n) => (
      <option key={n.id} value={n.id}>
        {n.label || "Untitled node"}
      </option>
    ));
  }
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
          <div className="view-switch" aria-label="Workspace view">
            <button
              className={workspaceView === "2d" ? "active" : ""}
              aria-pressed={workspaceView === "2d"}
              onClick={() => setWorkspaceView("2d")}
            >
              2D
            </button>
            <button
              className={workspaceView === "3d" ? "active" : ""}
              aria-pressed={workspaceView === "3d"}
              onClick={() => setWorkspaceView("3d")}
            >
              3D
            </button>
          </div>
          <button onClick={() => addNode(null)}>+ Node</button>
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
        {workspaceView === "2d" && (
          <div className="snap-controls" aria-label="Canvas snapping controls">
            <label className="snap-toggle">
              <input
                type="checkbox"
                checked={snapEnabled}
                onChange={(e) => setSnapEnabled(e.target.checked)}
              />{" "}
              Snap
            </label>
            <label className="grid-select">
              Grid
              <select value={gridSize} onChange={(e) => setGridSize(Number(e.target.value))}>
                {[8, 12, 16, 24, 32, 48, 64].map((size) => (
                  <option key={size} value={size}>
                    {size}px
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
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
            <h2>Hierarchy</h2>
            {atlas.nodes.length ? (
              <nav aria-label="Node hierarchy">{outline(null)}</nav>
            ) : (
              <p>Add a node to begin your atlas.</p>
            )}
          </section>
          <section className="inspector">
            <h2>{selectedRelationship ? "Relationship" : selectedNode ? "Node" : "Inspector"}</h2>
            {selectedNode ? (
              <>
                <label>
                  Name
                  <input
                    aria-label="Node name"
                    value={selectedNode.label}
                    maxLength={500}
                    onChange={(e) => patchNode(selectedNode.id, { label: e.target.value })}
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
                  Parent
                  <select
                    aria-label="Node parent"
                    value={selectedNode.parentId ?? ""}
                    onChange={(e) => {
                      commit(reparent(atlas, selectedNode.id, e.target.value || null));
                      fit();
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
                {workspaceView === "3d" && (
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
                        onClick={() => patchNode(selectedNode.id, { spatialPosition: undefined })}
                      >
                        Use 2D-derived position
                      </button>
                    )}
                  </div>
                )}
                <button onClick={() => addNode(selectedNode.id)}>+ Child node</button>
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
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete “${selectedNode.label}”, ${forbiddenParents.size} descendant(s), and their relationships?`,
                      )
                    ) {
                      commit(removeNode(atlas, selectedNode.id));
                      setSelection(null);
                    }
                  }}
                >
                  Delete node
                </button>
              </>
            ) : selectedRelationship ? (
              <>
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
            <p>
              {workspaceView === "2d"
                ? "Drag from a right handle to a left handle, or choose endpoints below."
                : "Choose endpoints below to add a directed relationship."}
            </p>
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
          {atlas.relationships.length > 0 && (
            <section>
              <h2>Relationships</h2>
              <p>
                {workspaceView === "2d"
                  ? "Dashed canvas edges (↗) connect through collapsed ancestors."
                  : "3D links connect through collapsed ancestors."}{" "}
                This list retains every relationship.
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
              {workspaceView === "2d"
                ? "Drag nodes to arrange. Use Parent to change containment. Scroll to zoom; drag the canvas to pan."
                : "Drag nodes to arrange them in 3D. Use Parent to change containment. Drag empty space to rotate, right-drag to pan, and scroll to zoom."}
            </p>
            <p>
              Autosave is specific to this browser and origin. Export JSON for a portable backup.
              This is a private local atlas.
            </p>
          </section>
        </aside>
        <div className="canvas" aria-label="Atlas canvas">
          {workspaceView === "3d" ? (
            <Suspense fallback={<div className="spatial-loading">Opening 3D workspace…</div>}>
              <SpatialWorkspace
                atlas={atlas}
                selectedId={selection?.kind === "node" ? selection.id : null}
                onSelect={(id) => setSelection(id ? { kind: "node", id } : null)}
                onMove={(id, spatialPosition) => patchNode(id, { spatialPosition })}
              />
            </Suspense>
          ) : (
            <>
              <ReactFlow<Card>
                nodes={viewNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={(changes: NodeChange<Card>[]) =>
                  setViewNodes((nodes) => applyNodeChanges(changes, nodes))
                }
                snapToGrid={snapEnabled}
                snapGrid={[gridSize, gridSize]}
                onMoveEnd={(_, nextViewport) => setViewport(nextViewport)}
                onNodeDragStop={(_, node) =>
                  patchNode(node.id, {
                    position: node.parentId
                      ? {
                          x: Math.max(
                            24,
                            snapEnabled
                              ? Math.round(node.position.x / gridSize) * gridSize
                              : node.position.x,
                          ),
                          y: Math.max(
                            96,
                            snapEnabled
                              ? Math.round(node.position.y / gridSize) * gridSize
                              : node.position.y,
                          ),
                        }
                      : {
                          x: snapEnabled
                            ? Math.round(node.position.x / gridSize) * gridSize
                            : node.position.x,
                          y: snapEnabled
                            ? Math.round(node.position.y / gridSize) * gridSize
                            : node.position.y,
                        },
                  })
                }
                onConnect={connect}
                onNodeClick={(_, node) => setSelection({ kind: "node", id: node.id })}
                onEdgeClick={(_, edge) => setSelection({ kind: "relationship", id: edge.id })}
                onPaneClick={() => setSelection(null)}
                deleteKeyCode={null}
                multiSelectionKeyCode={null}
                selectionKeyCode={null}
                minZoom={0.08}
                maxZoom={2}
                defaultViewport={viewport}
              >
                <Background gap={24} size={1} color="#cbd2dc" />
                <Controls showInteractive={false} />
              </ReactFlow>
              {!atlas.nodes.length && (
                <div className="empty-state">
                  <h1>Build your atlas</h1>
                  <p>
                    Add a node, name it, and add children.
                    <br />
                    Connect nodes across branches as the structure develops.
                  </p>
                  <button onClick={() => addNode(null)}>+ Add first node</button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
export default function App() {
  return (
    <ReactFlowProvider>
      <Workbench />
    </ReactFlowProvider>
  );
}
