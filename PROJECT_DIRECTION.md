# Omnia direction

Omnia is intended to become a shared environment where humans and AI construct, explore, understand and manipulate knowledge through structured nodegraphs.

- **Omnium:** a genuinely three-dimensional, spatial, hierarchical nodegraph. Three-dimensional space is essential.
- **Omnic:** a future visual and structural language using nodes, symbols, typed operators, relationships, nesting and possibly spatial arrangements. Its grammar is still undesigned; do not invent it during implementation.
- **AI access:** AI should eventually read and modify graph data directly through structured operations, without screenshots or English as an intermediate representation.
- **Semantic independence:** graph meaning and identity must not depend on a renderer, appearance, spatial layout or English labels.
- **Extensibility:** Omnic should be able to grow without repeatedly rebuilding Omnium.

For each task, implement the requested capability with the smallest compatible change. Preserve existing functionality and user data. Keep semantic graph data distinct from view state, make costly-to-reverse decisions explicit, and avoid speculative features or abstractions.

The interface is user-arrangeable: individual global functions/settings can float, snap into named frames whose outline follows their slots, use text or icon buttons, and be pinned. Windows are draggable, resizable and collapsible. Entity-specific context menus retain fixed membership and the clicked entity; only internal order, shape and size are customized. UI templates are portable presentation configuration, separate from canonical graph knowledge. The user will supply the future website default; do not invent a replacement aesthetic.

UI frames can contain frames/windows, with measured contours around actual residents and explicit insertion previews. Fields travel with their labels; input editing remains distinct from dragging. Frame handles support icons and geometry; mini controls remain owned but rearrangeable. Category magnetism is local, proximity-limited, controlled by a per-frame on/off setting. UI layout/settings have their own undo history (Shift+MB4/MB5), independent of graph history. UI containment never asserts structural knowledge.

The current workbench is 3D only. Its version-2 document separates identity, charted composition and typed relationships, placements, and investigative frames. A visual parent is not a semantic parent. Version-1 authored `parentId` values migrate into both kinds of link. External AI contributes through revision-checked JSON operations that require human review; structurally valid proposals do not establish epistemic truth. Retain legacy 2D coordinates in imported data, but do not rebuild a 2D editor unless the user requests one.

Nodes currently appear as full camera-facing text bars centered on their placement anchors, replacing spheres. Future symbols/icons/structural renderings must preserve those referent IDs. Directional binders distinguish charted composition, typed relationships, and visual-only nesting. Binder operators are editable text annotations pending user-authored Omnic grammar. Color/opacity and saved coordinate views are presentation state. Hierarchy and user-configured flow ordering may rearrange coordinates, but must never invent relationships or change canonical identity.

Single-click opens developer-defined node options (currently Variants); double-click expands/collapses structural contents. Variants are owned canonical references with a separate hidden-by-default expansion mode and a reserved add control. Ownership is not authored structural composition, and revealing variants must never clone internal knowledge or create structural children. Option categories are extended in source code only.

A variant is otherwise a normal node, including its own authored children, deeper structures, relationships, reusable referent, context menu, inspector, and shortcuts. Use ordinary placements with an explicit owner visibility gate; do not introduce restricted stand-in nodes or separate editing paths. Closing a variant mode hides its displayed subtree without changing its knowledge. Multiple references share canonical identity while retaining independent placement state.

Node and binder visuals can combine text, Unicode characters, Iconify/custom images, and self-contained GLB assets. Store portable resources once, reference them from presentation state, and retain canonical text/IDs independently. Binder display text and symbols do not redefine relationship meaning. Layout uses actual visual footprints; camera-dependent readability offsets are not authored coordinates.

Delete on a selection removes its canonical concepts and subnodes globally, including other representations and owned variants. Warn about shared/outside references and preserve the entire prior document for one-step undo. Representation-only removal remains explicitly separate. Ctrl/Cmd-drag selects; Shift gestures retain subtree expansion/nesting by default. Keep the hoverable, editable shortcut display and keyboard/mouse handling connected to the same action registry.

Shift-click (configurable) expands every charted structural level beneath a node, or collapses a fully expanded subtree, in one undoable operation. This reveals references without inventing facts; it is distinct from Shift-drag nesting and from variant expansion.
