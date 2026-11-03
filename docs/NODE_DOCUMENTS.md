# Node documents and the English–Omnic lexicon

The user is transferring an English Obsidian atlas into Omnic. English is a
temporary scaffold: type or paste English, automatically insert the user's mapped Composer glyphs
before matching words, then edit/delete English word by word until Omnic remains.
This explicitly authorizes lexical mappings; it does not infer equivalence from
renderings or finalize Omnic grammar. Ordinary type/delete/select/cut/copy/paste
is the intended scope. No rich document suite or automatic translation engine.

## Use

1. Save a glyph in Composer, open the existing Omnic library and select it.
2. Enter comma-separated **English variants**, then **Save name / tags / words**.
3. Click a node name → **Document**. Type or paste English; recognized words receive
   their glyph automatically. Opening old content or saving new variants refreshes it.
4. Delete English independently of its preceding glyph; type, cut, copy and paste
   normally. Wait for **Saved locally** before leaving. **Lexicon** opens the library;
   matching is always on and requires saved variants, not a separate activation.

This extends the current library. Its collections, tags, filters, saved revisions,
pins, copies, shared references, atlas switching and workspace/cloud portability
keep their existing owners. “Recipe” remains an internal structural format term.

## Portable ownership

`Entity.text?: {version: 1, content: (string | {glyph: string, word?: string | null})[]}` and
`Entity.lexiconWords?: string[]` are optional, backward-compatible fields.
Glyph IDs reference canonical entities with saved `omnic` definitions. A document
is shared by reused placements, including other atlases. English and glyphs are
independent siblings: deleting English does not remove/reinsert its glyph.
`word` links an automatic occurrence to its exact English scaffold. Deleting that
English detaches the glyph (`word: null`), leaving no English payload in a fully
translated occurrence. Legacy references without this optional field remain valid;
a matching adjacent English word adopts the link without duplicating the glyph.
Typing beyond a matched prefix can revise the still-automatic suggestion. Saved
lexicon corrections refresh linked suggestions; detached glyphs remain independent.
Removing a referenced canonical object fails validation until its document uses
are removed. Atlas/workspace exports include both fields; independent atlas import
remaps text references along with the existing canonical/recipe references.

No HTML, SVG, image bytes or DOM nodes are stored in documents. Browser editing
DOM serializes to validated text and object IDs. External pasted HTML is ignored;
plain text is escaped. Internal clipboard uses validated mixed-document JSON,
preserving references and their occurrence links without duplicating them. Unknown IDs reject paste;
outside apps receive plain text with bracketed object names. JSON export is the
lossless cross-workspace transfer route.

## Matching and editing

Compile explicit mappings into a Unicode-aware token trie. Match whole words,
case-insensitively with NFC normalization; retain source spelling and whitespace.
Longest explicit phrase wins, without crossing a newline. Conflicting mappings
remain English. No stemming, inferred synonyms or semantic disambiguation.
Typing detects an exact word immediately, without requiring a trailing space.
Ordinary input checks at most a roughly 512-character neighbourhood around the
caret/changed text; it does not rescan the entire document or evaluate every glyph.
Opening content and saving lexicon changes schedule a full missing/linked-occurrence
refresh outside the input handler. Existing glyph images remain cached. English
and glyph references stay in one document; an additional glyph node is unnecessary.

The browser owns the contenteditable caret and native text undo. Focused automatic
insertions and paste/cut use browser editing transactions (`execCommand`), with a
DOM fallback for unsupported insertion. A temporary caret marker restores the
English insertion point and is excluded from storage/cleaned after history input.
Composition pauses annotation until committed. Native Undo/Redo does not trigger
immediate reannotation of the undone edit. Automatic insertion may be a separate
native undo step; inactive lexicon refreshes use workspace history. Workspace commits batch after 700 ms idle, and flush on blur, explicit close,
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
independent English deletion, linked/detached occurrence policies, bounded typing
windows, validation, round-trip and imported reference remapping. Browser editing/caret/clipboard, newline presentation and smoothness
await user testing; a build does not establish acceptance.
