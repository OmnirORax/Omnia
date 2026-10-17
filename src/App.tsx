import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Node, NodeProps, NodeChange, Connection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./workbench.css";
import { descendants, emptyAtlas, newId, parseAtlas, removeNode, reparent } from "./graph/model";
import type { Atlas, AtlasNode } from "./graph/model";
import { projectAtlas } from "./graph/projection";

const STORAGE_KEY = "omnium.atlas.v1";
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
  const fileInput = useRef<HTMLInputElement>(null);
  const flow = useReactFlow<Card>();
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
          <button onClick={() => addNode(null)}>+ Node</button>
          <button onClick={undo} disabled={!past.length}>
            Undo
          </button>
          <button onClick={redo} disabled={!future.length}>
            Redo
          </button>
          <button onClick={exportJSON}>Export JSON</button>
          <button onClick={() => fileInput.current?.click()}>Import JSON</button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              void importJSON(e.target.files?.[0]);
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
            <p>Drag from a right handle to a left handle, or choose endpoints below.</p>
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
                Dashed canvas edges (↗) connect through collapsed ancestors. This list retains every
                relationship.
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
              Drag nodes to arrange. Use Parent to change containment. Scroll to zoom; drag the
              canvas to pan. Fit view using the canvas controls.
            </p>
            <p>
              Autosave is specific to this browser and origin. Export JSON for a portable backup.
              This is a private local atlas.
            </p>
          </section>
        </aside>
        <div className="canvas" aria-label="Atlas canvas">
          <ReactFlow<Card>
            nodes={viewNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={(changes: NodeChange<Card>[]) =>
              setViewNodes((nodes) => applyNodeChanges(changes, nodes))
            }
            onNodeDragStop={(_, node) =>
              patchNode(node.id, {
                position: node.parentId
                  ? { x: Math.max(24, node.position.x), y: Math.max(96, node.position.y) }
                  : node.position,
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
            fitView
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
