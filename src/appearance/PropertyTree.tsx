import { useState, type ReactNode } from "react";
import { collapseResidentBranch, ownerOf } from "../ui/layout";
import { EmbeddedGroup } from "../ui/EmbeddedGroup";
import { useUI } from "../ui/context";
import { PROPERTY_TREE, propertyPath, type PropertyNode } from "./propertyTree";
import { useAppearance } from "./Context";
import { propertyFor } from "./registry";
import { subtreeGesture } from "../workspaceActions";

export function PropertyTree({
  selected,
  onSelect,
  available,
  renderEditor,
  scope = "master",
  extraProperties = [],
  transient = false,
  initialOpen,
}: {
  selected: string;
  onSelect: (id: string) => void;
  available?: string[];
  renderEditor: (id: string) => ReactNode;
  scope?: string;
  extraProperties?: PropertyNode[];
  transient?: boolean;
  initialOpen?: string[];
}) {
  const ui = useUI(),
    ctx = useAppearance();
  const prefix = `@appearance-properties:${scope}:`;
  const [localOpen, setLocalOpen] = useState(() => new Set(initialOpen ?? ["color"]));

  const supported = (node: PropertyNode): boolean =>
    !available ||
    (!!node.property && available.includes(node.property)) ||
    (node.children ?? []).some(supported);
  const groupId = (id: string) => `property:${scope}:${id}`;
  const reveal = new Set<string>();
  if (ctx?.location) {
    const path = propertyPath(ctx.location.property);
    let key: string | undefined = `window:${groupId(path.at(-1) ?? ctx.location.property)}`;
    const effective = {
      ...ui.layout,
      windows: { ...Object.fromEntries(ui.defaults), ...ui.layout.windows },
    };
    while (key && !reveal.has(key)) {
      reveal.add(key);
      key = ownerOf(effective, key);
    }
  }
  const open = (node: PropertyNode) =>
    transient ? localOpen.has(node.id) :
    reveal.has(`window:${groupId(node.id)}`) ||
    !(
      ui.layout.windows[groupId(node.id)]?.collapsed ??
      !(ui.layout.panels[prefix + node.id] ?? node.id === "color")
    );
  const toggle = (node: PropertyNode, all = false) => {
    if (transient) {
      const expanded = !open(node);
      setLocalOpen(previous => {
        const next = new Set(previous);
        const visit = (item: PropertyNode) => { if (expanded) next.add(item.id); else next.delete(item.id); if (all) item.children?.forEach(visit); };
        visit(node); return next;
      });
      return;
    }
    ui.update((layout) => {
      const expanded = !open(node),
        windows = { ...Object.fromEntries(ui.defaults), ...layout.windows };
      let next = { ...layout, windows, panels: { ...layout.panels, [prefix + node.id]: expanded } };
      if (all) next = collapseResidentBranch(next, `window:${groupId(node.id)}`, !expanded);
      else if (windows[groupId(node.id)])
        next.windows[groupId(node.id)] = { ...windows[groupId(node.id)], collapsed: !expanded };
      return next;
    });
  };
  const row = (node: PropertyNode): ReactNode => {
    if (!supported(node)) return null;
    const expanded = open(node),
      children = (node.children ?? []).filter(supported),
      p = node.property && propertyFor(node.property);
    if (transient) return <div key={node.id} className={`property-node ${selected === node.property ? "is-selected" : ""}`}>
      <button type="button" aria-expanded={expanded} aria-pressed={selected === node.property} onClick={event => {
        if (node.property) onSelect(node.property);
        toggle(node, subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift"));
      }}>{node.label}</button>
      {p && node.property && expanded && <div className="property-node-editor">{renderEditor(node.property)}</div>}
      {expanded && children.length > 0 && <div className="property-node-children">{children.map(row)}</div>}
    </div>;
    return (
      <EmbeddedGroup
        key={node.id}
        id={groupId(node.id)}
        title={node.label}
        tooltip={node.tooltip}
        expanded={expanded}
        selected={selected === node.property}
        className={`property-node ${selected === node.property ? "is-selected" : ""}`}
        nodeId={node.id}
        onToggle={(event) => {
          if (event.detail > 1) return;
          if (subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift")) {
            toggle(node, true);
            return;
          }
          if (node.property) onSelect(node.property);
          toggle(node);
        }}
      >
        {(p || extraProperties.some(extra => extra.property === node.property)) && node.property && (
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
        {children.length > 0 && <div className="property-node-children">{children.map(row)}</div>}
      </EmbeddedGroup>
    );
  };
  return (
    <div className="property-roots" role="group" aria-label="Appearance properties">
      <small>Click a property to expand/collapse · subtree modifier for all levels</small>
      <div className="property-root-row">{[...PROPERTY_TREE, ...extraProperties].map(row)}</div>
    </div>
  );
}
