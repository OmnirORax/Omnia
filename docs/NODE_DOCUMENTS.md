# Node documents and the English–Omnic lexicon

The user is transferring an English Obsidian atlas into Omnic. English is a
temporary scaffold: paste English, insert the user's mapped Composer glyphs
before matching words, then edit/delete English word by word until Omnic remains.
This explicitly authorizes lexical mappings; it does not infer equivalence from
renderings or finalize Omnic grammar. Ordinary type/delete/select/cut/copy/paste
is the intended scope. No rich document suite or automatic translation engine.

## Use

1. Save a glyph in Composer, open the existing Omnic library and select it.
2. Enter comma-separated **English variants**, then **Save name / tags / words**.
3. Click a node name → **Document**. Paste English into its document surface.
4. Delete English independently of its preceding glyph; type, cut, copy and paste
   normally. Wait for **Saved locally** before leaving. **Lexicon** returns to the library.

This extends the current library. Its collections, tags, filters, saved revisions,
pins, copies, shared references, atlas switching and workspace/cloud portability
keep their existing owners. “Recipe” remains an internal structural format term.

## Portable ownership

`Entity.text?: {version: 1, content: (string | {glyph: string})[]}` and
`Entity.lexiconWords?: string[]` are optional, backward-compatible fields.
Glyph IDs reference canonical entities with saved `omnic` definitions. A document
is shared by reused placements, including other atlases. English and glyphs are
independent siblings: deleting English does not remove/reinsert its glyph.
Removing a referenced canonical object fails validation until its document uses
are removed. Atlas/workspace exports include both fields; independent atlas import
remaps text references along with the existing canonical/recipe references.

No HTML, SVG, image bytes or DOM nodes are stored in documents. Browser editing
DOM serializes to validated text and object IDs. External pasted HTML is ignored;
plain text is escaped. Internal clipboard uses validated mixed-document JSON,
preserving references without annotating them again. Unknown IDs reject paste;
outside apps receive plain text with bracketed object names. JSON export is the
lossless cross-workspace transfer route.

## Matching and editing

Compile explicit mappings into a Unicode-aware token trie. Match whole words,
case-insensitively with NFC normalization; retain source spelling and whitespace.
Longest explicit phrase wins, without crossing a newline. Conflicting mappings
remain English. No stemming, inferred synonyms, semantic disambiguation, or
background changes to existing passages. Typing does not automatically annotate.

The browser owns the contenteditable caret and native text undo. Paste/cut use
the browser editing transaction (`execCommand`) so they participate in native
undo. Workspace commits batch after 700 ms idle, and flush on blur, explicit close,
visibility/page hide and unmount. Commits use the existing `omnium` history and
IndexedDB workspace persistence. They merge the body into the latest canonical
pool rather than a captured document snapshot. Native text undo while editing
and workspace history outside editing retain their existing scopes.

## Bounds and verification

One node-anchored DOM document is open at a time. It follows the existing camera
projection scheduler without per-pointer React updates. Text input does not
update the 3D name texture per keystroke. Prepared matching and canonical glyph
images cache across text saves; static object images use shared Blob URLs and
lazy loading. `RENDER_BUDGET.omnicTextPrimitives` caps distinct prepared geometry
at 32,000 primitives; over-budget/unevaluable glyphs retain an explicit preview
placeholder and their canonical reference. No per-occurrence animation/evaluation.

Each document permits 200,000 English/text characters and 4,000 glyph occurrences;
each object permits 256 explicit variants of 200 characters each. Existing atlas
and workspace byte budgets still apply. Budget failures leave committed state
unchanged and report unsaved contents; reduce/copy them out before leaving.
Drag/drop and rich formatting are outside this slice.

Local model suite, self-contained preview build (including TypeScript/property
contracts) and backend type checks passed. Portable regression tests cover
matching, conflicts, punctuation/whitespace,
independent English deletion, validation, round-trip and imported reference
remapping. Browser editing/caret/clipboard, newline presentation and smoothness
await user testing; a build does not establish acceptance.
