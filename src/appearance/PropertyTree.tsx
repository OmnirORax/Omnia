import { useFrameExpansion } from "../ui/frameExpansion";
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
  editable,
  renderEditor,
  scope = "master",
  extraProperties = [],
  transient = false,
  initialOpen,
}: {
  selected: string;
  onSelect: (id: string) => void;
  available?: string[];
  editable?: string[];
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
  const canEdit = (node: PropertyNode): boolean =>
    (!!node.property && (!available || available.includes(node.property)) && (!editable || editable.includes(node.property))) ||
    (node.children ?? []).some(canEdit);
  const allNodes = [...PROPERTY_TREE, ...extraProperties];
  const expansionIds = (nodes: PropertyNode[]): string[] => nodes.flatMap(node => supported(node) && canEdit(node) ? [node.id, ...expansionIds(node.children ?? [])] : []);
  useFrameExpansion(true, transient && expansionIds(allNodes).some(id => localOpen.has(id)), expanded => {
    ctx?.locate(null, true);
    if (transient) setLocalOpen(new Set(expanded ? expansionIds(allNodes) : []));
  });
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
    if (!supported(node) || !canEdit(node)) return null;
    // A branch may exist only to expose supported descendants. Its own property
    // then remains unavailable even though the branch can still be expanded.
    const property = node.property && (!available || available.includes(node.property)) && (!editable || editable.includes(node.property)) ? node.property : undefined;
    const expanded = open(node),
      children = (node.children ?? []).filter(child => supported(child) && canEdit(child)),
      p = property && propertyFor(property),
      isSelected = !!property && selected === property;
    if (transient) return <div key={node.id} className={`property-node ${isSelected ? "is-selected" : ""}`}>
      <button type="button" aria-expanded={expanded} aria-pressed={isSelected} onClick={event => {
        if (property) onSelect(property);
        toggle(node, subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift"));
      }}>{node.label}</button>
      {p && property && expanded && <div data-appearance-editor className="property-node-editor">{renderEditor(property)}</div>}
      {expanded && children.length > 0 && <div className="property-node-children">{children.map(row)}</div>}
    </div>;
    return (
      <EmbeddedGroup
        key={node.id}
        id={groupId(node.id)}
        title={node.label}
        tooltip={node.property && !property ? "Expand for supported child properties." : node.tooltip}
        expanded={expanded}
        selected={isSelected}
        className={`property-node ${isSelected ? "is-selected" : ""}`}
        nodeId={node.id}
        onToggle={(event) => {
          if (event.detail > 1) return;
          if (subtreeGesture(event.nativeEvent, ctx?.subtreeModifier ?? "shift")) {
            toggle(node, true);
            return;
          }
          if (property) onSelect(property);
          toggle(node);
        }}
      >
        {(p || extraProperties.some(extra => extra.property === property)) && property && (
          <div
            data-appearance-editor className="property-node-editor"
            onFocusCapture={() => {
              if (property !== selected) onSelect(property);
            }}
            onPointerDownCapture={() => {
              if (property !== selected) onSelect(property);
            }}
          >
            {renderEditor(property)}
          </div>
        )}
        {children.length > 0 && <div className="property-node-children">{children.map(row)}</div>}
      </EmbeddedGroup>
    );
  };
  return (
    <div data-appearance-editor className="property-roots" role="group" aria-label="Appearance properties">
      <small>Click a property to expand/collapse · subtree modifier for all levels</small>
      <div className="property-root-row">{[...PROPERTY_TREE, ...extraProperties].map(row)}</div>
    </div>
  );
}
