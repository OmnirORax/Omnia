# Visual selector and shared controller

Appearance has one property pool (`PROPERTIES`) and one master editing system.
Features register visual parts and renderer adapters rather than introduce a
separate property definition, editor or value store. Target, boundary, visual role
and property remain separate. See `AGENTS.md` for integration rules.

## Current first stage

Middle-click (MB3) opens stationary configuration with the ring centered on the
pointer (clamped near viewport edges). The same SVG becomes a compact cursor while
aiming. Move outside the controller, or press its check mark, to aim. MB3 returns
to stationary configuration at the pointer. The cursor layer is pointer-transparent
and updates its position without rerendering the application.

The symbol has independent choices:

- **Ring:** toggle boundary picking. It remains latched after a pick and only the
  ring turns it off. Scroll while aiming to climb through containing components
  and frames to the entire app, or downward to narrow the candidate boundary.
- **Inner / outer bar:** arm include (green) / exclude (red). Press an already
  active bar again to return to neutral. Merely arming an operation does not apply
  it to the existing selection.
- **Empty center / surrounding annulus:** choose inside / outside the established
  boundary. With an operation armed, clicking either region applies it to all
  registered UI parts in that region. These actions never move the boundary.
  Press the active region again to clear the inside/outside choice; this does not
  apply another operation or remove the already accepted selection.
  Outside means other registered UI parts throughout the app, not another frame.
- **Paired dots:** toggle pattern sampling. Turn the ring off to sample parts or
  patterns in the chosen region. With dots off, clicks affect individual parts.
  With dots on, a clicked role matches across the selected inside/outside region.

A neutral boundary pick establishes an anchor without adding included/excluded
paint. Picking a new boundary starts a fresh selection; an armed operation applies
inside that boundary by default, or outside when that region is configured. An
existing boundary remains the same when its center/surrounding controls are used.
Parts outside are unselected by default until an explicit outside operation.

Pattern matching starts with registered text, backgrounds, contours, icons and
selection indicators. It does not infer semantic structure from pixels or select
individual letters/words. Text previews follow actual text ranges. Later operations
override earlier matches: a pattern exclusion can have individually included
exceptions. Explicit inclusions remain green and exclusions remain red in both
preview and accepted feedback. Unselected parts are not painted as exclusions.

Undo/redo records selection operations and boundary changes in a transient local
history. While the tool is active, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
redoes; the stationary controller exposes both actions. A new operation after undo
replaces the redo branch. Clear is an undoable reset of selection. Escape disables the tool and
clears selection in one action; window blur/tab hiding stops picking. Choices stay
configured until changed. No phone controls, axis conditions or custom drag regions
are implemented in this step.

The first adapter covers rendered UI parts through the existing appearance
bindings. Canvas/3D visual picking will need a renderer adapter to the same
selection model; it is not inferred from the canvas pixels. Selector chrome is
excluded from discovery. Closed/hidden parts are not current matches. Boundary
and pattern operations reevaluate on relevant DOM changes, so new matching UI
parts inside the boundary participate. Stable resident/function anchors follow
moved UI where available.

Selection is transient. It does not create appearance instances, apply property
values, persist settings, change camera/graph selection, or create interface/graph undo entries.
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
