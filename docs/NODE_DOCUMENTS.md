# Node documents and the English–Omnic lexicon

The user is transferring an English Obsidian atlas into Omnic. English is a
temporary scaffold: type or paste English, automatically insert the user's mapped Composer glyphs
before matching words, then edit/delete English word by word until Omnic remains.
This explicitly authorizes lexical mappings; it does not infer equivalence from
renderings or finalize Omnic grammar. Ordinary type/delete/select/cut/copy/paste
is the intended scope. Basic Markdown is rendered directly in the editable document; no rich document suite or automatic translation engine.

## Use

1. Save a glyph in Composer, open the existing Omnic library and select it.
2. Enter comma-separated **English variants**, then **Save name / tags / words**.
3. Right-click a node → **Document**. Type or paste English; recognized words receive
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

One document is open at a time in the shared FloatingWindow. Its frame inherits
normal movement, resizing, docking, pinning, minimization, UI rigidity and saved
layout/customization. It opens from the node options; camera movement does not
force its position. Dock-host replacement flushes and initializes the live editor
through the existing save lifecycle. Text input does not
update the 3D name texture per keystroke. Prepared matching and canonical glyph
images cache across text saves; static object images use shared Blob URLs and
lazy loading. `RENDER_BUDGET.omnicTextPrimitives` caps distinct prepared geometry
at 32,000 primitives; over-budget/unevaluable glyphs retain an explicit preview
placeholder and their canonical reference. No per-occurrence animation/evaluation.

Each document permits 200,000 English/text characters and 4,000 glyph occurrences;
each object permits 256 explicit variants of 200 characters each. Existing atlas
and workspace byte budgets still apply. Budget failures leave committed state
unchanged and report unsaved contents; reduce/copy them out before leaving.
Drag/drop, Markdown tables, links/images, task-list widgets and full CommonMark parsing remain outside this slice.

Local model suite, self-contained preview build (including TypeScript/property
contracts) and backend type checks passed. Portable regression tests cover
matching, conflicts, punctuation/whitespace,
independent English deletion, linked/detached occurrence policies, bounded typing
windows, validation, round-trip and imported reference remapping. Browser editing/caret/clipboard, newline presentation and smoothness
await user testing; a build does not establish acceptance.

## Markdown in the editable document

Paste Markdown normally: `**bold**`, `*italic*`, `~~strike~~` and inline backtick
code render as formatted text without visible delimiters. Headings, simple
ordered/unordered lists, quotes and fenced code blocks render on paste/reopen.
Closing inline markers during typing formats a small paragraph (at most 4,096
visible characters); heading/list prefixes can format after a typed space. The
editor stays directly editable, with no separate preview pane. Fenced-code typing
across browser-created paragraph boundaries and full CommonMark syntax are not
implemented; unsupported syntax remains literal. Formatting larger typed
paragraphs is deferred until paste/reopen.

Markdown source remains ordinary text in the existing version-1 mixed document.
Semantic editing wrappers serialize their original markers back to that text;
no HTML or new rich-text schema is saved. Glyph tokens can occur inside formatted
spans without losing their canonical IDs or English links. Literal raw HTML is
escaped, and external clipboard HTML is still ignored. Internal copy preserves
Markdown source and references; plain clipboard output retains Markdown syntax.
Live formatting uses the existing native insertion transaction path and a
temporary caret token, removed before saving. Composition and native history
input do not trigger reformatting. Renderer nesting/work is bounded, with
pathological syntax falling back to visible source. Models cover rendering,
escaping, marker/glyph round trips and malformed inputs. Browser caret/Undo/IME
acceptance remains user-pending.

## Essential editing and window behavior

The document uses the same frame/chrome and layout owner as other UI windows.
Move its handle, resize its corner, dock/pin/minimize it and configure rigidity
through the normal UI controls. Shared rigidity/pinning rules still apply; the
document does not bypass a locked window category. Size and frame customization
are stored with UI layout, not the document body. Closing/minimizing first flushes
the text and keeps the window open if saving fails.

Numbered and bullet lists are native editable `ol`/`ul`/`li` structures, rather
than painted prefix spans. Enter continues the list; Enter on an empty item exits.
Indent/Outdent controls (Ctrl+] / Ctrl+[ by default) change list depth. Tab keeps native focus navigation; Shift retains the app’s shared configuration policy. The document toolbar provides Bold,
Italic, Numbered list and Bullet list; Ctrl/Cmd+B and Ctrl/Cmd+I use the same native
formatting transactions. Existing native Undo/Redo, caret, selection, clipboard
and composition remain browser-owned. Markdown serialization derives counters
for new/moved list items, preserves untouched source prefixes and records native
formatting changes without resurrecting removed styles. Soft line breaks inside
a list serialize as indented continuation lines. No new rich-text save schema.

UI caption decoration excludes editable content as a general ownership rule, so
semantic bold text is never converted into a named UI icon. A user-approved
bounded built-preview Chromium check verifies bold content has no injected symbol,
list Enter/empty-item exit and resizing under an unlocked shared window category.
Broader interactive acceptance remains user-owned.

The same focused check also confirms Bold-off saves plain text, Bold-on saves
one marker pair and the committed list source contains `1. first`, `2. second`
and a following unlisted paragraph. No page errors were reported. The initial
locked-layout resize attempt correctly did nothing; the unlocked category uses
normal shared resize behavior. This is bounded evidence, not full editor or
docking/IME/Undo acceptance.

Right-click node actions include Document, Variants and Add variant (2026-11-08). They route through the existing document/variant owners; plain left-click still mounts the navigator. Delayed Document commands validate the target still exists. Context-menu registrations use the existing configurable EntityMenu; saved document, variant and workspace formats are unchanged. Browser acceptance remains pending.
