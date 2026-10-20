import type { ReactNode } from "react";
import { useUI } from "../ui/context";
import { PROPERTY_TREE, propertyPath, subtreeIds, type PropertyNode } from "./propertyTree";
import { useAppearance } from "./Context";
import { propertyFor } from "./registry";
import { subtreeGesture } from "../workspaceActions";

export function PropertyTree({
  selected,
  onSelect,
  available,
  renderEditor,
  scope = "master",
}: {
  selected: string;
  onSelect: (id: string) => void;
  available?: string[];
  renderEditor: (id: string) => ReactNode;
  scope?: string;
}) {
  const ui = useUI(),
    ctx = useAppearance();
  const prefix = `@appearance-properties:${scope}:`;
  const reveal = ctx?.location ? propertyPath(ctx.location.property) : [];
  const supported = (node: PropertyNode): boolean =>
    !available ||
    (!!node.property && available.includes(node.property)) ||
    (node.children ?? []).some(supported);
  const open = (node: PropertyNode) =>
    reveal.includes(node.id) || (ui.layout.panels[prefix + node.id] ?? node.id === "color");
  const toggle = (node: PropertyNode, all = false) =>
    ui.update((layout) => ({
      ...layout,
      panels: {
        ...layout.panels,
        ...Object.fromEntries(
          (all ? subtreeIds(node) : [node.id]).map((id) => [prefix + id, !open(node)]),
        ),
      },
    }));
  const row = (node: PropertyNode): ReactNode => {
    if (!supported(node)) return null;
    const expanded = open(node),
      children = (node.children ?? []).filter(supported),
      p = node.property && propertyFor(node.property);
    return (
      <div
        className={`property-node ${selected === node.property ? "is-selected" : ""}`}
        key={node.id}
        data-property-node={node.id}
      >
        <div className="property-node-heading">
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} property ${node.label}`}
            aria-expanded={expanded}
            onClick={(event) =>
              toggle(node, subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift"))
            }
          >
            {expanded ? "▾" : "▸"}
          </button>
          <button
            type="button"
            className="property-node-name"
            aria-pressed={selected === node.property}
            onClick={(event) => {
              if (subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift")) {
                toggle(node, true);
                return;
              }
              if (node.property) onSelect(node.property);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              toggle(node);
            }}
          >
            {node.label}
          </button>
        </div>
        {expanded && (
          <div className="property-node-contents">
            {p && node.property && (
              <div
                className="property-node-editor"
                onFocusCapture={() => {
                  if (node.property && node.property !== selected) onSelect(node.property);
                }}
                onPointerDownCapture={() => {
                  if (node.property && node.property !== selected) onSelect(node.property);
                }}
              >
                {renderEditor(node.property)}
              </div>
            )}
            {children.length > 0 && (
              <div className="property-node-children">{children.map(row)}</div>
            )}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="property-roots" role="group" aria-label="Appearance properties">
      <small>
        Click to select · double-click to expand/collapse · subtree modifier for all levels
      </small>
      <div className="property-root-row">{PROPERTY_TREE.map(row)}</div>
    </div>
  );
}
