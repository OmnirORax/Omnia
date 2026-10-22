# Visual selector and shared controller

Appearance has one property pool and one master editing system. Selection reuses
registered visual parts, capabilities and renderer adapters. Geometry, matching,
include/exclude and property editing are separate; selection never creates
appearance values. See `AGENTS.md` and `APPEARANCE_CONTROLLER.md`.

## One circle, independent geometry

MB3 toggles the stationary controller at the pointer and the compact aiming
cursor. The circle is centered on the pointer and clamped near viewport edges.
The aiming symbol and all its SVG descendants are pointer-transparent. Its white
precision dot is the exact hotspot; movement updates only a cached transform.
Escape disables the tool and clears selection. Blur/tab hiding cancels an
unfinished gesture; native color-picker blur keeps the property editor mounted.

The ○ has three independent settings:

- Ring: the contour/path intersections.
- Center: inside a closed shape.
- Surrounding annulus: outside a closed shape.

Inside and Outside can both be on, either on or both off; pressing again clears
only that setting. Open paths need no interior: their working set is the patterns
intersecting the path. Inside/Outside settings are retained for closed shapes and
do not turn an open path into a filled rectangle. Turning off the ring removes
intersection matching. Settings apply to the current geometry and carry into the
next geometry. Geometry settings and edge masks join transient selection history.
The ring never arms another pointer tool or overrides E.

RMB includes and LMB excludes by default. Their commands are in the shared
`FEATURE_ACTIONS` catalog, so they are listed, rebindable and capture-aware. The
last operation supplies hover color; pressing the opposite button recomputes
that operation at the press position, without relying on a stale hover preview.
The old inner/outer include/exclude bars are removed. The exact old default
binding bundle (RMB inspection, include/exclude unassigned) migrates once to the
new defaults. Customized bindings and deliberately cleared bindings in later
saves remain intact. Editing is available from the controller's edit button, the
platform context-menu keyboard gesture, Master controller, or a rebound edit
command; ordinary RMB now includes instead of opening an editor.

## Geometry and pattern modes

E and the symbol below the circle cycle modes. The ⠒ disclosure also offers direct
mode buttons, pattern filters/counts and edge toggles. Modes are:

- **Pattern ⠒ (default):** hover an actual part to preview its registered category
  throughout the current working set. Without geometry, the scope is the app.
  Hovering text previews all registered UI text; clicking commits the operation.
  Icon artwork, input contents, backgrounds, contours and indicators retain their
  distinct categories. Pointer-event-transparent nested text is recognized from
  its text-range geometry even when its parent receives the pointer event.
- **Individual ·:** affect only the pointed registered part, within the same scope.
- **Pointed geometry ○:** use a pointed component/frame contour as geometry. Wheel
  changes containing-owner depth. The adapter uses the element rectangle and
  selectable sides; Inside/Outside apply to its contents/exterior. Its stable
  resident/function anchor follows docking/reparenting and size changes.
- **Axis ↕ / direction ↑ / segment |:** drag an infinite line, forward ray or
  finite segment. Exact endpoint touches count. A click supplies a vertical axis,
  upward ray or short vertical segment. Axis/ray are unbounded unless finite
  bounds are enabled. Optional sampled-color termination stops independently at
  the nearest differently painted peer; empty gaps do not terminate it.
- **Rectangle ▭ / ellipse ◯:** drag the shape. They use the same contour and
  inside/outside settings, rather than a separate marquee selection mechanism.
- **Polygon ⬡:** click vertices, then press the registered Finish geometry command
  (Enter by default), the controller's check mark, or the first vertex to finish.
  At least three vertices are needed. The final press chooses include/exclude;
  Enter uses the last chosen operation. Self-intersections use even-odd filling.
- **Freehand 〰:** drag a path; release commits. It is open by default. The Close
  path setting closes the stroke and enables inside/outside. Samples are bounded
  and progressively decimated during long strokes; the same retained path drives
  matching and feedback.

Defining geometry commits its operation and leaves that geometry as the working
set. The pointer returns to Pattern mode so it can refine the set immediately.
New geometry intersects the existing working set; Release working geometry keeps
accepted rules and returns subsequent picks to app-wide matching. This permits
choosing a window first, then drawing an axis within it. Custom drawing coordinates
are relative to the viewport owner; pointed geometry uses its actual UI owner.

For example: choose Axis, LMB-drag through several controls to exclude everything
it intersects. The axis stays established. RMB a text label to include matching
text along that axis, or choose Individual to include only that label. Pointer
hits and category-list actions cannot escape that working set. Hover only
previews changes; it never replaces the accepted selection or changes properties.

Closed polygon/rectangle geometry exposes numbered side toggles in ⠒. The same
numbers appear on its guide. Disabled sides stop contributing intersections;
the complete closed outline still defines inside/outside. Freehand segment masks
use the same mechanism. Ellipse matching uses a 64-segment contour and does not
expose per-segment side buttons. Overlay paths use a single combined SVG path per
active/disabled layer, avoiding one animation per sampled freehand segment.

The ⠒ list shows categories present in the working set. Click a category name to
filter subsequent picks/drawings; click again to clear the filter. Its +/− actions
preview and apply that category only within the geometry. Later matching rules
override earlier ones. An excluded set can therefore have individually included
exceptions, and an included set can have excluded exceptions. Earlier independent
geometry selections remain accepted when another geometry is added.

Selection undo/redo records geometry placement, rule changes, side masks, region
changes, releases, logical-object picks and clear in one transient timeline. It
never writes graph/UI/appearance history or browser storage. Ctrl/Cmd+Z,
Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y are the defaults while configuring/aiming. New
operations after undo replace its redo branch. Unfinished drawing is not accepted
on blur/cancel. Hover previews show only matches whose include/exclude state would
change; explicit exclusions remain red and inclusions green.

The mouse-shaped button selects the logical Mouse group through the generic
`selectObject` API. Selecting an already selected logical target toggles it off;
pressed state and the selected-properties inspector derive from that same state.
Discovered consumers provide capabilities (currently Mouse trail). The native
cursor and trail remain pointer-transparent. This replaces geometric selection
and uses the same undo/redo/clear history. Inspection alone never edits values.

## Supported parts and editing

Detection uses the existing appearance bindings and registered causes, not regex
on labels or image/pixel recognition. Text geometry follows separate actual text
ranges, including wrapped lines; intervening gaps are not text ink. Contours use
border strips, rather than their entire surface. Existing registered background
surfaces are selectable, including from empty interiors. Independent negative
space, arbitrary image shapes, fine letter/word selection and general canvas/3D
picking require further renderer adapters. Hidden/closed parts and selector chrome
are not current matches. Live rules reevaluate on relevant DOM/geometry changes.

Accepted parts reveal applicable properties in Master controller through the
shared selected-part editor. Hover candidates do not change that inspector. The
stationary edit button or platform keyboard context menu opens Selected appearance
at the pointer. This uses accepted parts even when invoked over a gap. Picking
stops while editing; Continue selecting resumes aiming. Logical targets reveal
Master controller directly. Unsupported capabilities remain unavailable.

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
uses synchronized native paint-variable animations on actual glyph hosts and
local CSS opacity/seam animations on overlay traces, with no per-frame JavaScript
scanning, style rewriting or React renders. Glyph variables are non-inherited;
never animate inherited selector variables on the document root, which causes
application-wide style invalidation even with an empty selection. An idle selector
runs no glyph-paint animation. Accepted-selection context is memoized separately
from hover/cursor preview state so aiming does not rerender the Master controller
and its property editors. The hierarchy and
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
