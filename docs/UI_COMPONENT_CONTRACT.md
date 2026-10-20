# Shared UI component contract

New features must use the existing UI ownership, rendering, customization, history and persistence contracts. A clickable header is not the object it represents.

- Actions use `FunctionControl`/the function registry. The shared `NativeActions` adapter also discovers ordinary buttons in new frames, preserving their original handlers. Stable `data-ui-id` keys protect customized actions from markup/list reordering. Automatically discovered expandable buttons remain customizable but are not draggable as incomplete headers; use the shared group component for their payload.
- Fields use `UIField`, which moves the label and input together.
- Expandable groups use `EmbeddedGroup`; floating windows use `FloatingWindow`. Both are complete window residents in the same `UILayout.windows` model. Moving a group moves its header, editors, children and behavior together. New property definitions receive this automatically through `PropertyTree`.
- An embedded group's `inline.parent` records its original home. Until detached, that home participates in normal ownership, pinning and cycle validation. Docking and floating use the same operations as existing windows, not a second property-specific layout store.
- Default children stay mounted when collapsed. A moved child can therefore render outside its original parent without losing its handlers. Portals project content at its current owner; headers are never copied as substitutes for live contents. If the originating feature is explicitly closed, the destination shows a context-unavailable message rather than an empty slot.
- Drop resolution must produce a compatible destination and a visible preview before committing. Self/descendant containment and pinned targets reject unchanged. Cancelled or rejected operations must preserve the original layout. Hiding a source requires a real destination renderer.
- Regrouping is UI organization only. It must not change property applicability, values, canonical knowledge or relationships.
- Subtree expansion and search revelation follow current UI ownership, including moved-in children, rather than a hardcoded initial property hierarchy.
- Each completed move is one UI undo operation and must survive template/browser save and reload. Existing icons/styles must migrate when a previously button-only group becomes a complete resident.

The model regression in `tests/ui-nesting.test.mjs` exercises generic embedded ownership, cycle/pin rejection, undo and JSON persistence. The focused UI regression exercises actual property nesting and a newly introduced group; it is intentionally separate from the broad browser suites.

Stable native anchor identity and current container ownership are separate contexts. Moving a group must not change the IDs/anchors of its fields; the new container context must not replace their original home scope.
