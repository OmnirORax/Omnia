# Visual selector and shared controller

Appearance has one property pool (`PROPERTIES`) and one master editing system.
Features register visual parts and renderer adapters rather than introduce a
separate property definition, editor or value store. Target, boundary, visual role
and property remain separate. See `AGENTS.md` for integration rules.

## Selection and editing

Middle-click (MB3) toggles a compact, circular stationary controller with the ring centered on the
pointer (clamped near viewport edges). Press MB3 again, or its check mark, to
resume selection with the same configuration and accepted parts. Moving outside
the controller leaves it open for interaction. The same SVG becomes a compact
cursor while aiming. MB3 returns to stationary configuration at the pointer. The cursor layer is pointer-transparent
and updates its position without rerendering the application.
Only the stationary symbol renders hit areas. The aiming cursor and every SVG
descendant explicitly reject pointer events, so a settled cursor cannot intercept
the left-click intended for the underlying part.
The larger aiming symbol has a high-contrast precision dot at its SVG hotspot.
Its measured size determines the pointer offset, including fractional sizes; the
dot stays exactly at the mouse position. Measurement runs at mount/resize, while
pointer motion updates only the cached transform before painting.

These are default bindings, all declared in the shared action catalog. Shortcuts
& functions and Workspace settings → Shortcuts & gestures automatically include
the selector commands, their activation context and its native gestures. Rebind
or clear keyboard/mouse commands there; selector behavior and button hints read
the saved bindings. Recording a binding pauses picking and cannot invoke the
recorded command through the trailing click/contextmenu. See `SHORTCUTS.md` for
the required integration path and CI architecture check for future features.

The symbol has independent choices:

- **Ring:** choose or replace the boundary. The ring stays active after clicking
  or dragging a selection; press the ring again to turn boundary picking off.
  Hover previews the next boundary but only a click replaces the accepted one.
  Toggling the ring preserves the chosen inside/outside region. Scroll
  while picking to climb through containing components/frames to the entire app,
  or downward to narrow the candidate boundary.
- **Inner / outer bar:** arm include (green) / exclude (red). Press an already
  active bar again to return to neutral. Merely arming an operation does not apply
  it to the existing selection.
- **Empty center / surrounding annulus:** independently toggle inside / outside
  the established boundary. Both can be active together, or either/both off.
  With an operation armed, turning a region on applies it only to that region's
  registered UI parts. Turning one off leaves the other toggle unchanged and
  does not apply another operation or remove the already accepted selection.
  Outside means other registered UI parts throughout the app, not another frame.
  Choosing a region preserves the ring's on/off state.
  The toggles also fix preview/picking bounds to that boundary: Inside alone
  allows only its interior, Outside alone only its exterior, and both allow both
  regions, even while O stays armed.
  Boundary candidates and their applied parts obey the same limit; scrolling to
  an ancestor cannot escape it. Subsequent picks do not move this region anchor.
  Turn both off to clear the region anchor and resume unrestricted boundary picking.
- **Paired dots:** cycle pattern ⠒ → axis ↕ → direction ↑ → position | →
  individual · → pattern. E cycles the same modes while the selector is active.
  The precision dot in the aiming symbol remains the exact pointer hotspot;
  stationary dots control the mode. Changing modes preserves the ring's current
  on/off state, whether done through the dots or E.
  In pattern mode, clicking a part matches its registered role across the working
  region. Individual mode affects only the clicked part.
- **↕ / ↑ / |:** drag to place an infinite axis, a forward ray, or a finite
  position segment. Every registered pattern touched by the line participates by
  default, including an exact endpoint touch; this is not a rectangular marquee.
  A click without dragging places a vertical axis/upward ray or a precise 2px
  position segment. Axis/ray are unbounded until constrained by a boundary or the
  finite-bounds control (↦↤). Position is always finite. The guide and matcher
  share geometry; accepted lines remain faintly visible. A drag previews while
  held and records one selection operation on release. Cancellation/blur does
  not accept its preview.
- **◐:** stop when the starting part's computed paint changes. Start on a painted
  part; its role and source color are sampled. The first differently colored peer
  terminates that direction, excluding the terminator and later peers. An axis
  stops independently on both sides. Empty gaps do not terminate it. This uses
  registered part paint, not a pixel magic wand or visual image recognition.
  Feedback ink is excluded from sampling.
- **⠒ below the actions:** reveal the patterns in the working region, with counts
  and source target labels in tooltips. Click a pattern name to filter line
  matching, again to restore all patterns. Its +/− controls preview and apply
  include/exclude to that role throughout the region. These reuse the same rules,
  local undo, bindings and master property controller.

A neutral boundary pick establishes an anchor without adding included/excluded
paint. Picking a new boundary starts a fresh selection; an armed operation applies
inside that boundary by default, or outside when that region is configured. An
existing boundary remains the same when its center/surrounding controls are used.
With the ring armed, dragging instead of clicking makes a custom rectangular
boundary. Its owner is the nearest containing registered component/frame, falling
back to the app. Bounds and line coordinates are stored relative to that owner so
moving/resizing it follows the same area. Custom boundaries select whole visual
parts they touch; they do not crop an editable property's renderer into arbitrary
pixels. Parts outside are unselected by default until an explicit outside operation.
With the ring off, hover previews stay inside the fixed boundary unless Outside
is explicitly chosen. Moving beyond it produces no replacement-boundary preview.
With the ring on, boundary picking remains armed for repeated placements within
the explicit Inside/Outside region, or unrestricted when neither is chosen.
Hover paint shows only parts whose include/exclude state would change: already
included parts do not preview another inclusion, and explicitly excluded parts do
not preview another exclusion. These filters affect feedback only, preserving
live pattern rules and their future matches. A green/red boundary preview appears
only while explicitly choosing a boundary, not for ordinary item/pattern hovers.

Pattern matching starts with registered text, backgrounds, contours, icons and
selection indicators. It does not infer semantic structure from pixels or select
individual letters/words. Text previews and line intersection follow actual text
ranges, including separate wrapped lines; their intervening blank box is not text
ink. Contour intersections use border strips rather than the whole surface. Later operations
override earlier matches: a pattern exclusion can have individually included
exceptions. Explicit inclusions remain green and exclusions remain red in both
preview and accepted feedback. Unselected parts are not painted as exclusions.

Undo/redo records selection operations and boundary changes in a transient local
history. While the tool is active, Ctrl/Cmd+Z undoes, Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y
redoes; the stationary controller exposes both actions. A new operation after undo
replaces the redo branch. Clear is an undoable reset of selection. Escape disables the tool and
clears selection in one action; window blur/tab hiding stops picking. Choices stay
configured until changed. Phone controls remain outside this implementation.

The first adapter covers rendered UI parts through the existing appearance
bindings. Canvas/3D visual picking will need a renderer adapter to the same
selection model; it is not inferred from the canvas pixels. Existing registered
background surfaces remain selectable, including from their empty interiors.
Empty space as an independent pattern (layout gaps/negative areas), and the 3D
world's background as a locally editable UI part, still need renderer adapters;
this increment does not label every blank pixel as a registered background. Selector chrome is
excluded from discovery. Closed/hidden parts are not current matches. Boundary
and pattern operations reevaluate on relevant DOM changes, so new matching UI
parts inside the boundary participate. Stable resident/function anchors follow
moved UI where available.

Picking and inspection are transient. They do not create appearance instances,
apply values, persist settings, change camera/graph selection or create ordinary
undo entries. The shared selection context exposes boundary, operations, matches
and applicable property IDs.

With a boundary or accepted parts selected, right-click anywhere outside selector controls, or
press the controller's edit button, to open **Selected appearance** at the pointer.
Gaps, outlines and unselected areas are valid invocation positions: the editor
uses the accepted selection, not a new pointer hit. Context-menu events also open
the editor without requiring pointerdown, including keyboard/platform gestures.
Picking stops while the panel is open. Escape clears the selection and restores
ordinary application context menus.
If the boundary has no included editable parts, the panel explains that parts
must be included; it does not silently consume right-click or create any values.
The existing PropertyTree and PropertyEditor show supported properties, mixed
values and the count of applicable/locked/bypassed parts. Inapplicable parts are
skipped; category and local protections still apply. The panel's expansion state
is transient. Opening it or choosing a property does not initialize refinements.
Selection feedback pauses while editing so its ink cannot obscure actual values.
Close returns to normal UI interaction; Continue selecting restores the aiming
cursor. MB3 reconfigures; Escape still disables and clears selection. Native color
picker blur does not destroy the editor.

A property change creates/updates local part references in the existing
controller's instances/values/refined maps, in one transaction for the selection.
Previews use the existing appearance preview bridge; accepting an input joins the
recoverable appearance draft. Apply/discard, theme export and ordinary appearance
undo keep their existing behavior. Closing cancels any uncommitted input preview.
Use inherited appearance removes only the selected, unprotected part refinements;
broader/category customizations remain. Individuals stay hidden until opted in.

Part references use the nearest stable function/resident owner plus normalized
keyed or structural steps. Text references also identify the direct text node,
without including its editable wording in the identity. They follow stable owners
through docking and survive theme reload. Unkeyed markup uses structural position;
authors should supply stable data-ui-id keys for reorderable children. Invalid
imported addresses are rejected, never widened to an owner-wide edit.

Surface/input/icon instances use the existing CSS/effect adapters with their exact
scope. Ranged text uses a shared-controller CSS Custom Highlight adapter, painting
only the selected glyphs. It currently supports Color, Brightness, Opacity and
Glow; typography and effects are not advertised until an exact glyph adapter can
support them. Browsers without Custom Highlights cannot edit ranged text in this
pass. Missing property values inherit broader refinements without freezing them.
Controller policy and value resolution share indexed lookups within a transaction
or render, rather than rebuilding the registry for every selected part/property.
The resolver caches metadata only, never the current property values.

This increment edits currently accepted parts. Boundary/pattern rules remain live
while selecting, but are not saved as automatic rules for future matching parts.
Reusable persistent pattern couplings, finer word/letter selection and 3D adapters
remain follow-up work. No competing appearance editor or property store is added.

## Selection feedback

Included/excluded parts use green/red neon traces; the boundary stays cyan. A soft
rim, continuous rail and moving dashed seam show each surface or contour. The seam
travels around the edge without rotating/resizing the selected object. Background
tints remain translucent. Background and contour matches on one element share a
trace and geometry/style reads are cached across feedback layers.

Accepted and hover feedback both follow a one-second bright/dim/bright cycle.
Preview emphasis changes seam thickness, not pulse opacity. The low point keeps a
faint cue while the high point restores full ink and glow. Preview changes do not
restart the shared pulse clock.

Visual hierarchy → Windows / frames / controls → UI arrangement indicators →
Selector feedback exposes Included, Excluded and Boundary. The shared Color,
Brightness, Opacity and Glow properties style the feedback adapter's edges, text
and icons together; there is no separate selector value store or editor. These
targets declare their semantic color defaults in the registry. Lightning/effect
adapters for selector feedback remain follow-up work, so unsupported animation
properties are not offered on these targets.

Text feedback pulses the actual glyph ink through CSS custom highlights, instead
of filling rectangular text boxes. Input contents and placeholders use scoped
temporary ink rules; icons keep their source palette with a pulsing glow. Feedback
uses one shared native paint-variable animation and CSS seam motion, with no
per-frame JavaScript scanning, style rewriting or React renders. The hierarchy and
selector reuse `paintVariables.ts` for native variable registration. Large surfaces
use broad strokes rather than full-window blur filters. Reduced motion keeps a
steady neon cue and stationary seam; tab hiding pauses the native pulse. Cleanup
removes the temporary paint layer, markers and animation without changing values.

## Further integration contract

Further adapters must use the same accepted selection and master controller,
respecting boundary/pattern rules and local exceptions. Inspecting alone must not
alter values. A new property requires one implementation in the
registry plus adapters for supported renderers. Coupling existing parts to shared
values is distinct from implementing a renderer capability. Once the shared path
covers an old editor's behavior, remove its duplicate controls and routes while
preserving saved values, IDs, locks, bypass and default restoration.
