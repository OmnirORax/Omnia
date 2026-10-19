# Omnia direction

Omnia is intended to become a shared environment where humans and AI construct, explore, understand and manipulate knowledge through structured nodegraphs.

- **Omnium:** a genuinely three-dimensional, spatial, hierarchical nodegraph. Three-dimensional space is essential.
- **Omnic:** a future visual and structural language using nodes, symbols, typed operators, relationships, nesting and possibly spatial arrangements. Its grammar is still undesigned; do not invent it during implementation.
- **AI access:** AI should eventually read and modify graph data directly through structured operations, without screenshots or English as an intermediate representation.
- **Semantic independence:** graph meaning and identity must not depend on a renderer, appearance, spatial layout or English labels.
- **Extensibility:** Omnic should be able to grow without repeatedly rebuilding Omnium.

For each task, implement the requested capability with the smallest compatible change. Preserve existing functionality and user data. Keep semantic graph data distinct from view state, make costly-to-reverse decisions explicit, and avoid speculative features or abstractions.

The current workbench is 3D only. Its version-2 document separates identity, charted composition and typed relationships, placements, and investigative frames. A visual parent is not a semantic parent. Version-1 authored `parentId` values migrate into both kinds of link. External AI contributes through revision-checked JSON operations that require human review; structurally valid proposals do not establish epistemic truth. Retain legacy 2D coordinates in imported data, but do not rebuild a 2D editor unless the user requests one.

Nodes currently appear as full camera-facing text bars centered on their placement anchors, replacing spheres. Future symbols/icons/structural renderings must preserve those referent IDs. Directional binders distinguish charted composition, typed relationships, and visual-only nesting. Binder operators are editable text annotations pending user-authored Omnic grammar. Color/opacity and saved coordinate views are presentation state. Hierarchy and user-configured flow ordering may rearrange coordinates, but must never invent relationships or change canonical identity.

Single-click opens developer-defined node options (currently Variants); double-click expands/collapses structural contents. Variants are owned canonical references with a separate hidden-by-default expansion mode and a reserved add control. Ownership is not authored structural composition, and revealing variants must never clone internal knowledge or create structural children. Option categories are extended in source code only.

Shift-click (configurable) expands every charted structural level beneath a node, or collapses a fully expanded subtree, in one undoable operation. This reveals references without inventing facts; it is distinct from Shift-drag nesting and from variant expansion.
