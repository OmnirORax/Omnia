Composer interaction update (2026-11-06, supersedes earlier Composer-only selection/entry rules): baseline MS is active without Q. Q toggles selection settings → baseline aiming. A plain target pick uses the configured selection mode and opens the retained compatible DOF, defaulting to Position against Composer space. Confirming a single value by click or Enter commits it and closes its preview, returning to baseline selection; outside canvas clicks choose a compatible reference without changing the edited target. Esc cancels the uncommitted DOF preview, clears target selection and returns to baseline (previous commits stay). Right-click selects immediately and opens DOF choices. Modifier membership gestures stay selection-only; explicit Draw/Erase and borrowed requests retain gesture ownership. Other app surfaces retain opt-in MS. This supersedes the earlier Composer prohibition on automatic DOF entry. No browser acceptance is inferred.

# Omnic selection and editing lifecycle

The assigned MS opening shortcut (Q by default) cycles off → aiming → MS configuration → off, then repeats. Closing through Q retains accepted membership/history and releases targeting; it never clears the selection. Esc retains its separate behavior: from configuration return to aiming, then cancel/clear normal MS selection; canceling a borrowed reference restores its prior selection. Existing explicit clear/removal commands remain available. Automatic Master Controller selection inspection is unchanged.

Normal MS sessions opened on a registered content surface are bounded to that source root/context. The selector cursor and hover/wheel targeting apply there; a primary/secondary press or focus change on other controls ends normal targeting without consuming the control input or clearing accepted membership. Selector-owned configuration remains usable. ActiveContext preserves the source only for pointer picks inside that boundary. Standalone UI MS remains global. Explicit borrowed reference requests retain their rejection/cancel contract and navigation context.

Modifier marquee feedback is live while held: Ctrl/Shift-drag previews the current intersected owners as the rectangle grows or shrinks, before release. Preview does not change accepted membership, anchors, geometry or selection history. Release commits once; Esc, blur or pointer cancellation removes the preview. Reuse the registered surface snapshot and area-hit adapter, prepare geometry once per gesture, and coalesce feedback to animation frames. Snapshot adapters may return a cached elements resolver for native-ink preview; otherwise projected unit boxes provide feedback. Do not call geometry discovery or layout measurement from each area query.

Explicitly opened MS remains aiming after each pick, including Ctrl/Shift picks; its selector cursor stays visible until Esc or editing, and parking anchors it. Completing a native modifier gesture begun while MS is off leaves MS off. Accepting a requested reference ends that temporary session. MS opening shortcuts route with selector priority even after exit, ahead of retained DOF/resident bindings, while explicit rebinding/clears, native text entry and blocked input remain authoritative.

Q always starts ordinary MS, even with a numeric editor open. Only an explicit reference request borrows MS for a one-target reference; the ⟴ control and DOF reference entry retain that workflow. Numeric information registration must never override the selector opening command. After Q → hold Shift+Q or Ctrl+Q → successive target clicks, Q must still configure MS rather than reopen a property setter.

This is the current interaction contract. Selection, property editing, temporary
reference picking and navigation context are different owners. A correction must
preserve the whole sequence rather than change one click in isolation.

## Transitions

| State / input | Result | Preserved |
| --- | --- | --- |
| Ordinary target/edge click | Select its authored owner; open no editor | Recipe and identities |
| Ctrl-click, Shift-click, modifier marquee | Toggle one owner, add spatial range or add marquee members | Other accepted members; no dial on modifier release |
| End selection press | Release the gesture; retain membership and an explicitly opened MS session | Selector cursor/aiming until exit or editing; native modifier picks begun while off remain off |
| Right-click selected owner | On secondary release/context event, open compatible DOFs for the entire accepted set | Other selected owners; no value change |
| Right-click another owner | Inspect that owner through the existing selection adapter | Unrelated geometry/history |
| Right-click DOF | Open its existing configuration | Target scope and values until an explicit edit |
| Explicit DOF button or assigned shortcut | Open the requested editor | Its exact target set; supported property capabilities |
| Repeat the active DOF shortcut | Configure that same DOF | Target/reference/value ownership |
| Numeric reference request | Temporarily lend pointer input to MS | Editor navigation context, accepted membership/configuration |
| Accept/cancel reference | Restore the accepted selection and return to the editor | Editor's context chain; no implicit geometry edit |
| Esc with active MS / native selection press | Back from MS settings or cancel active input | Previously accepted members during an unfinished native press |
| Esc in a field or popup after selection | Restore an uncommitted preview or step out of the nearest editor | Accepted target set; do not clear it or minimize another window |
| Esc after the editor has closed | Clear passive selection before ordinary frame navigation | Composer remains open for the selection-clear step |
| Select all / selection undo/redo | Update membership through the existing owner | No automatic dial or recipe undo |
| New modifier selection while an editor is open | Cancel transient editor input and modify the existing set | Committed values; no automatic reopening |
| Cancel pointer / suspend page input | Release unfinished gesture state | Accepted selection and existing editor state |

Explicit editor controls remain usable. “Right-click only” means selection and
modifier release never automatically open a target/property dial or reference
picker; it does not remove assigned DOF shortcuts or explicit editor buttons.

## Ownership rules

- `pointerOwnership.eventPathMatches` uses the original physical event path.
  Earlier capture handlers can synchronously replace SVG descendants. Looking
  only at the pressed node's current ancestry loses its declared surface or lets
  a newly mounted control inherit the press.
- `selectionSurfaces.beginPointer` retains the registered root and context ID,
  rather than the replaceable SVG primitive. Descendant replacement does not
  cancel selection; root replacement, disposal or atlas-context replacement does.
- `VisualSelector` owns active MS input. Retained selection alone is not an active
  picker: editor layers/fields and held UI/content gestures receive cancellation
  before passive selection clear. Press-state subscriptions update on ownership
  transitions, not pointer motion. Composer cancels an actual stroke before any
  rim navigation; mouse release cannot commit a canceled preview.
- `ActiveContextSystem` does not activate a pointed frame while MS owns the
  pointer. A reference request lends picking, not the editor's context chain.
- `FloatingWindow.contextController` means remote controls retain the source
  context. Opening/inspection-key refreshes must not activate that window over an
  existing source editor. Geometry and window presentation remain separate.
- Composer cancellation handles real gestures, not popup navigation. Shared
  `ContextualMasterController`/`ContextStage` navigate nested editor stages.
- Numeric reference entry is gated by the declared property kind. Fill, Color
  and other nonnumeric properties use their actual controls and do not start a
  numeric MS request or claim the numeric active-degree information owner.
- Canonical recipe writes, prepared previews, MS membership history and UI history
  retain their existing owners. Opening/selecting/configuring never commits a
  geometry change; an edit cannot silently widen its accepted target set.

These rules extend the existing surface adapters and shortcut/context owners.
There is no additional selection store, per-tool modifier listener or popup suite.
Geometry preparation remains outside pointer motion; event-path checks traverse
only the current physical path, not the application DOM.

## Regression route

With a local dev server running:

```sh
node tests/omnic-interactions.browser.mjs
```

This is an **opt-in** browser regression, added for the user's explicit
2026-11-03 request to investigate and test the full interaction sequence. It is
not added to automatic delivery/browser suites and does not authorize unrelated
future browser tests. It seeds disposable browser contexts, blocks nonlocal
requests and uses physical mouse/key input for the interactions. Runtime reads
inspect existing registered command/target state; the test does not patch app
handlers or call private React state setters. Selection undo/redo is exercised
through the existing registered actions.

The matrix runs Atomnic on/off and covers ordinary selection, held Ctrl toggles,
Shift ranges in both directions, generated owners, right-click release, DOF
configuration/back, selected-only edits, select-all, marquee/cancel, selection
history, Ctrl+Q/Shift+Q, Q configuration/back, Rotation shortcut/repeat, Master
Controller context preservation, native text input, pen preview cancellation, reference accept/cancel/outside rejection,
repeated menus/dismissal, and selection clear before frame collapse. Horizontal
SVG strokes are clicked at their actual rendered midpoint; zero fill-box height
does not imply invisible ink.

Reports/screenshots go to ignored `work/omnic-interactions/` by default. Set
`OMNIA_URL`, `CHROMIUM_PATH` or `OMNIA_INTERACTION_OUTPUT` to override local tooling.
Browser test evidence and remaining user acceptance are recorded in the capability
catalog. Passing a synthetic Chromium fixture does not establish smoothness on
user hardware, every custom binding/theme, OS/browser-reserved chords or all
future adapters.

### Recorded verification, 2026-11-03

The corrected PR #44 working tree passed **48 named Chromium interaction
sequences**, with zero uncaught page errors, after reproducing the old failures.
Both Atomnic modes passed; additional runs exercised Ctrl/Alt/Shift together,
a same-key global binding conflict (also through Master Controller), and saved
binding reload. The pen test verifies an actual visible preview before canceling
it and proves mouse release cannot commit it. Negative steps include modified
blank clicks, outside reference picks, and right-clicking another owner.

The complete model/architecture suite, preview build (including TypeScript /
property contracts), and backend checks also passed. This evidence applies to the
local disposable fixture and code changes in this delivery. User hardware /
workspace and other browser acceptance remain separate.

The follow-up reproduced Q opening a numeric setter during the reported selection sequence. Removing numeric-context interception keeps Q owned by MS. Four additional checks cover Q → held Shift+Q → successive clicks → Q configuration and Ctrl+Q continuation after Rotation, in both Atomnic modes. All 45 checks passed with no uncaught page errors; explicit reference accept/cancel remains covered.

The cursor/session follow-up reproduced disappearance after the first native pick. Gesture completion now preserves explicitly opened MS; native modifier picks begun while off remain off, and requested reference acceptance closes explicitly. Two new on/off-mode checks assert the visible selector cursor after successive picks, its disappearance on Esc, and reappearance on Q. A third starts MS with Q also assigned to Rotation and verifies selector entry after Esc. All 48 sequences passed with no uncaught page errors. Runtime entry priority uses declared activationScope; saved-binding conflict/default rules and native typing protections remain unchanged.

Focused source-scope regression (2026-11-04):
`OMNIA_INTERACTION_FOCUS=composer-scope node tests/omnic-interactions.browser.mjs`
runs four physical-input checks in disposable local Chromium contexts: MC click
handoff retains selected geometry and the Composer toolbar library opens, each
with Atomnic on and off. All four passed without uncaught page errors. This is
focused evidence, not a new run of the full earlier 48-sequence matrix or user
hardware acceptance. Model scope checks cover root/context changes, source-chrome
entry, physical paths, disposal and standalone global fallback.

Q-cycle follow-up (2026-11-04): `OMNIA_INTERACTION_FOCUS=q-cycle node tests/omnic-interactions.browser.mjs` passed four physical-input checks in Atomnic on/off: exact Q aim/config/closed/aim with membership retained, and separate Escape config/back/cancel behavior. No uncaught page errors. Automatic MC inspection was left unchanged at the user’s clarification. The older full matrix was not rerun; setup steps were updated where the new third Q now intentionally closes.


### Atomic selection detection snapshots — 2026-11-06

The approved focused click trace reproduced `nearestLensBoundary` throwing when
synchronous baseline entry replaced the catalog but kept the previous map keyed
by VisualPart wrapper identities. That prevented target entry before downstream
confirmation. Catalog, measurements, lens geometry and continuity now advance as
one prepared bundle, both on render and synchronous pointer entry. Picks use that
bundle rather than a separately updated geometry ref. No per-widget input bypass
or coordinate-confirmation exception is added.

The corrected local Chromium trace used a disposable ring fixture. A real Position
click committed X=40 and persisted after pointer leave; the toolbar Library opened
on its first real click. No page errors occurred. This is evidence for those two
paths only, not full browser-suite or native Color acceptance. The model regression
reproduces the old cache mismatch and checks updated continuity in the same bundle.
No stored data, identities or binding formats change.

Borrowed content input (2026-11-06): OperationReferenceScope passes its live
Composer surface to MS. Pending reference, region and attachment requests own
only that surface's content, using the shared nearest-input-owner rule. Other
controls keep their press/release/click, context menu and wheel input without
canceling the request or replacing the editor context. A missing live root stays
inactive; only an explicitly unscoped standalone request may select global UI.
This is transient request state; saved documents and settings are unchanged.

Focused diagnostic evidence for that correction: the built preview previously
swallowed library pointerdown/up/click while reference picking was pending. The
same first click now opens the library without selector interception. A separate
completed-reference path confirms a real coordinate click commits X=65.5 and
survives pointer leave, with no page errors. Earlier fresh/completed-path checks
missed the pending state; these observations are not full browser acceptance.

Confirmation completion correction (2026-11-06): the user clarified that click
followed by Esc retained a value while Esc alone canceled it. The write was
succeeding, but a no-op degree onConfirm left the hover preview active, making
confirmation appear ineffective. Single-value confirmation now commits and closes
the degree preview immediately. Nested reference-choice completion forwards to
the degree owner. Accepted membership/compatible DOF remain; Esc alone cancels.
Earlier focused checks observed commit survival but missed this finish condition.

The approved bounded built-preview trace reproduced that distinction for both
click and Enter: committed X=40, grid still open, next hover X=-40, Esc restored
X=40. After correction, each confirmation closes the grid and later motion stays
at X=40. A nested reference-choice click likewise closes the full value preview
and retains X=18. Esc alone restores an uncommitted X=40 preview to X=0. All four
after-paths reported no page errors; broader user acceptance remains pending.
