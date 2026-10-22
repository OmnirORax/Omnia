# Visual selector and shared controller

Appearance has one property pool (`PROPERTIES`) and one master editing system.
Features register visual parts and renderer adapters rather than introduce a
separate property definition, editor or value store. Target, boundary, visual role
and property remain separate. See `AGENTS.md` for integration rules.

## Current first stage

Middle-click (MB3) opens the symbol controller near the pointer. Its SVG recreates
the supplied ring, crossing bar and paired dots. The ring chooses boundary mode;
the inner bar includes; the outer bar excludes; the dots choose pattern mode.
Include/exclude combine with boundary, individual part, or pattern picking.

- Start with ring + inner bar and click a component/frame edge to include its
  registered visual parts. While aiming a boundary, scroll upward to climb through
  containing components/frames to the entire app; scroll downward to narrow it.
- The accepted boundary stays visible. After choosing it, the tool switches to
  individual picking. Click the outer bar to exclude individual parts, or combine
  it with the dots to exclude a sampled visual role throughout the boundary.
- Pattern matching starts with registered text, backgrounds, contours, icons and
  selection indicators. It does not infer semantic structure from pixels or select
  individual letters/words. Text previews follow actual text ranges.
- Later operations override earlier matching operations. Include an individual
  exception after excluding a pattern to add it back. Ring + exclude excludes a
  contained area. Ring + include chooses a fresh boundary.
- Hover previews the candidate operation without accepting it. Undo removes the
  last selection operation; clear removes selection. Finish closes the controller
  and leaves the selection highlighted. MB3 reopens it. Escape closes picking;
  Escape again clears the remaining selection. Window blur stops picking.

The first adapter covers rendered UI parts through the existing appearance
bindings. Canvas/3D visual picking will need a renderer adapter to the same
selection model; it is not inferred from the canvas pixels. Selector chrome is
excluded from discovery. Closed/hidden parts are not current matches. Boundary
and pattern operations reevaluate on relevant DOM changes, so new matching UI
parts inside the boundary participate. Stable resident/function anchors follow
moved UI where available.

Selection is transient. It does not create appearance instances, apply property
values, persist settings, change camera/graph selection, or create undo entries.
The shared selection context exposes boundary, operations, matches and applicable
property IDs for subsequent master-controller coupling. This stage does not add a
second appearance editor or remove existing editors before they are replaced.

## Follow-up integration contract

The next editing stage must route the accepted selection into the existing master
controller, resolving live boundary/pattern rules and local exceptions. Inspecting
alone must not alter values. A new property requires one implementation in the
registry plus adapters for supported renderers. Coupling existing parts to shared
values is distinct from implementing a renderer capability. Once the shared path
covers an old editor's behavior, remove its duplicate controls and routes while
preserving saved values, IDs, locks, bypass and default restoration.
