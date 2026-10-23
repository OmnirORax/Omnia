# Visual selector and shared controller

Appearance has one property pool and one master editing system. Selection reuses
registered visual parts, capabilities and renderer adapters. Geometry, inclusion baselines,
toggling and property editing are separate; selection never creates
appearance values. See `AGENTS.md` and `APPEARANCE_CONTROLLER.md`.

## One circle, independent geometry

MB3 toggles the stationary controller at the pointer and the compact aiming
cursor. The circle is centered on the pointer and clamped near viewport edges.
The aiming symbol and all its SVG descendants are pointer-transparent. Its saturated cyan
precision dot is the exact hotspot; movement updates only a cached transform.
Escape disables the tool and clears selection. Browser chrome clicks, window
blur and tab hiding are not app commands: preserve tool phase, configuration,
selection, editor and pointed preview. Only release unfinished input (never
accept it), pending animation callbacks and press ownership. Resume aiming on
actual in-page pointer motion. Property activity previews and draft editors must
likewise survive browser focus loss; blur commits apply only within the page.

The ○ has three independent settings:

- **🞅 Frame:** include the pointed frame itself or contour/path intersections.
- **◉ In-frame:** include everything inside a closed shape, excluding the frame itself.
- **⏺ Outside frame:** include everything outside a closed shape.

Inside and Outside can both be on, either on or both off; pressing again clears
only that setting. Open paths need no interior: their working set is the patterns
intersecting the path. Inside/Outside settings are retained for closed shapes and
do not turn an open path into a filled rectangle. Turning off the ring removes
intersection matching. Settings apply to the current geometry and carry into the
next geometry. Geometry settings and edge masks join transient selection history.
The ring never arms another pointer tool or overrides E.

There is one selection action: LMB toggles a pattern/individual, or places geometry.
A fully included target becomes unselected; an unselected target becomes included.
A mixed category becomes fully included. Clicking the same category/individual
again reverses it. The shared `selectionToggleRule` resolves membership at click
time. Hover detects and paints candidate targets while aiming; Ctrl is not required.
Drawing an axis/path still shows its geometry guide, without including targets.
Everything not green is unselected; there is no separate exclude command.

Pointed-contour placement starts with an implicit off baseline and includes only its checked ○
regions. Drawn geometry instead starts neutral (see Drawing versus inclusion). The checked regions also constrain picking. Checking In-frame includes
all contents; subsequent clicks toggle matching patterns off or on. Frame includes
the actual pointed object, independently of its interior/exterior. Outside frame
includes the exterior without the frame itself or its contents.

With all three regions off, clicking a pattern first establishes a neutral frame
and includes nothing. Detection then follows the pointer automatically: inside the
frame detects interior patterns; outside detects exterior patterns. This side
change never includes anything by itself. Each accepted pattern toggle captures
its detected side, so moving outside does not change earlier interior selections.
The category list follows the last pointer side before entering tool chrome.
Turning In-frame on after this neutral setup includes the whole interior.
Neutral open paths remain available for selectively including their intersections.

Changing a circle checkbox resets only its region to the new baseline, restoring
any overlaps with other checked regions. Exceptions in unrelated regions remain.
The circle baseline is stored in transient selection history, so undo/redo restores
both membership and the displayed checkbox state. Geometry edits still update
physical paths across associated rules without overwriting their inclusion masks.

The shared command keeps ID `selector.include` for compatibility and is labeled
Toggle pointed pattern / define geometry. The retired `selector.exclude` command
is removed. Exact older default bundles migrate to LMB toggle and RMB edit; custom
assignments and later explicit clears remain intact. RMB, the controller's edit
button, the platform keyboard context-menu gesture and Master controller provide
editing. Shortcut metadata and handlers remain shared and rebindable. Optional Ctrl is transparent to the selection command's saved pointer binding; exact modified
commands keep priority. MS consumes owned press/release/click events even when
no command matches, so underlying controls cannot activate.

## Geometry and pattern modes

E and the symbol below the circle cycle modes. The ⠒ disclosure also offers direct
mode buttons, pattern filters/counts and edge toggles. Modes are:

- **Pattern ⠒ (default):** click an actual part to toggle its registered category
  throughout the current working set. Without geometry, the scope is the app.
  Clicking text toggles all registered UI text in the working scope.
  Icon artwork, input contents, backgrounds, contours and indicators retain their
  distinct categories. Pointer-event-transparent nested text is recognized from
  its text-range geometry even when its parent receives the pointer event.
- **Individual ·:** toggle only the pointed registered part, within the same scope.
- **Pointed geometry ○:** use a pointed component/frame contour as geometry. Before placement, Wheel changes containing-owner depth. The adapter uses the element rectangle and
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
  At least three vertices are needed. Placement uses the current circle baseline. Self-intersections use even-odd filling.
- **Freehand 〰:** drag a path; release commits. It is open by default. The Close
  path setting closes the stroke and enables inside/outside. Samples are bounded
  and progressively decimated during long strokes; the same retained path drives
  matching and feedback.

Defining geometry establishes its circle baseline and leaves that geometry as the working
set. The pointer returns to Pattern mode so it can refine the set immediately.
New geometry intersects the existing working set; Release working geometry keeps
accepted rules and returns subsequent picks to app-wide matching. This permits
choosing a window first, then drawing an axis within it. Custom drawing coordinates
are relative to the viewport owner; pointed geometry uses its actual UI owner.
Shift+Wheel rotates the armed axis/ray/segment or drawing mode before placement;
in Pattern/Individual it rotates already placed working geometry. A newly armed
tool takes priority over an enclosing boundary. Both horizontal and vertical wheel
deltas and pixel/line/page units are supported. The pending angle survives pointer
motion and placement; choosing another mode resets the pending angle. Rotation is
in screen space, including in non-square owners; placed changes join selection
undo/redo. Ctrl+Shift+Wheel rotates 10× faster. Lines rotate around their stored
start point (the cursor hotspot before placement), keeping the origin fixed; closed
shapes rotate around their center.

For example: turn the contour baseline off, choose Axis and drag through several
controls. Its intersections remain the working set while all start off. Click a
text label to include matching text along the axis, or choose Individual to toggle
just that label. Turn the contour on to include all intersections, then toggle
specific patterns off. Pointer hits and category-list actions stay in that domain.
Hover never replaces accepted selection or changes properties.

Closed polygon/rectangle geometry exposes numbered side toggles in ⠒. The same
numbers appear on its guide. Disabled sides stop contributing intersections;
the complete closed outline still defines inside/outside. Freehand segment masks
use the same mechanism. Ellipse matching uses a 64-segment contour and does not
expose per-segment side buttons. Overlay paths use a single combined SVG path per
active/disabled layer, avoiding one animation per sampled freehand segment.

The ⠒ list shows categories present in the geometric working set, including those
currently off. A category name filters subsequent picks/drawings; click again to
clear the filter. Its single circle toggles that category within the geometry.
Later rules override earlier matches internally, allowing both off baselines with
included exceptions and on baselines with unselected exceptions. Earlier
independent geometry selections remain accepted when another geometry is added.

Selection undo/redo records geometry placement, rule changes, side masks, region
changes, releases, logical-object picks and clear in one transient timeline. It
never writes graph/UI/appearance history or browser storage. Ctrl/Cmd+Z,
Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y are the defaults while configuring/aiming. New
operations after undo replace its redo branch. Unfinished drawing is not accepted
on blur/cancel. Hover previews additions in green and already-selected removal candidates in red.
The hovered candidates temporarily replace their accepted green; actual excluded
items retain no paint after committing. HTML, glyph, SVG and scene feedback share
the same pending tone and existing pulse clock.

The ◎ button opens **Self inventory**, the shared entry for logical/meta targets
that cannot be picked through their own pointer-transparent graphics. It projects
coupled groups marked `self: true` and their descendants: currently Mouse → Mouse
trail and Selector feedback → Included / Boundary. New coupled descendants appear
automatically. Hidden compatibility targets stay out of the list. There is no
second inventory of target capabilities, properties or values.

Inventory rows use the generic `selectObject` API. Selecting the same logical
identity again toggles it off; pressed state and Master controller inspection derive
from the same selection state. Clear/Esc and selection undo/redo apply normally.
Logical selection replaces geometric selection, while inspecting/reopening never
writes values. Selector feedback exposes a live sample in Master controller using
the actual trace renderer and existing paint values, so its 2.6-second pulse remains
visible during editing. Selector feedback → Pulse exposes the shared Animation
speed, Effect intensity (fade depth) and Pulse on/off properties in the existing
controller. Their normal draft/Apply/theme export serialization applies. The native cursor/trail and feedback stay pointer-transparent.

The shared Self inventory command is cataloged and rebindable. The existing Mouse
selection command/ID remains available for saved bindings; its separate mouse-only
button is replaced by inventory access.

## Supported parts and editing

Detection uses the existing appearance bindings and registered causes, not regex
on labels or image/pixel recognition. Text geometry follows separate actual text
ranges, including wrapped lines; intervening gaps are not text ink. Contours use
border strips, rather than their entire surface. Existing registered background
surfaces are selectable, including from empty interiors. Independent negative
space, arbitrary image shapes, fine letter/word selection and general 3D object
picking require further renderer adapters. The workspace background has a dedicated
scene adapter, separate from UI CSS. Hidden/closed parts and selector chrome
are not current matches. Live rules reevaluate on relevant DOM/geometry changes.

Blank UI areas resolve to the nearest registered background surface. Individual ·
toggles that one background; Pattern ⠒ toggles backgrounds throughout the current
working set. This is the whole owned surface behind its contents, not a new object
for each visible gap. In-frame does not implicitly include a pointed frame's own
background; Frame controls that object independently. Gaps with no registered
background remain unsupported. The 3D-world background is a registered scene
surface: its canvas supplies bounds and the existing raycaster rejects foreground
nodes/binders when pointing at it. Pattern/Individual and geometric membership use
the same shared rules as UI surfaces. Its address is the existing
`workspace.background` consumer, so edits affect that whole background rather than
manufacturing a DOM-local value or a spatially cropped patch.

Accepted parts reveal applicable properties in Master controller through the
shared selected-part editor. Hover candidates do not change that inspector. The
stationary edit button or platform keyboard context menu opens Selected appearance
at the pointer. This uses accepted parts even over a gap. Selection / Preview
independently controls marks without deselecting. Use explicit MS lock for normal
cursor control; editor entry does not hold hover context or activate a target.
Logical targets reveal Master controller directly. Unsupported capabilities remain
unavailable.

A property change creates/updates local part references in the existing
controller's instances/values/refined maps, in one transaction for the selection.
Previews use the existing appearance preview bridge; accepting an input joins the
recoverable appearance draft. Apply/discard, theme export and ordinary appearance
undo keep their existing behavior. Closing cancels any uncommitted input preview.
Use inherited appearance removes only the selected, unprotected part refinements;
broader/category customizations remain. Individuals stay hidden until opted in.

Renderer bindings may declare a separate `selection` hit surface with target-level
addressing. The selector then resolves the existing consumer ID in the shared
selected-part editor; it creates no DOM instance. Ordinary draft, preview, reset,
locks, bypass and selected/unselected history remain shared. Background source
sampling comes from the renderer, never from temporarily highlighted pixels.

Part references use the nearest stable function/resident owner plus normalized
keyed or structural steps. Text references also identify the direct text node,
without including its editable wording in the identity. They follow stable owners
through docking and survive theme reload. Unkeyed markup uses structural position;
authors should supply stable data-ui-id keys for reorderable children. Invalid
imported addresses are rejected, never widened to an owner-wide edit.

Surface/input/icon instances use the existing CSS/effect adapters with their exact
scope. Completely selected text hosts use scoped CSS for font, size, weight and
spacing. A text host is promoted only when all its nonempty descendant text is
selected; partial runs never widen to their owner. Partial runs use CSS Custom
Highlights for Color, Brightness, Opacity and Glow, plus the shared effect adapter
with exact text-node ownership. Partial-run typography remains unavailable until
a renderer can support it precisely. Browsers without Custom Highlights cannot
edit ranged text in this pass. Missing values inherit broader refinements without
freezing them. Paint-only text changes do not reset fonts or unrelated paint.

Controller policy and value resolution share indexed lookups within a transaction
or render. Animation resolution caches ownership and local styles, invalidating on
real DOM/appearance changes rather than selector movement. Paint-only refinements
do not start effect scans when their resolved animation is off. Exact local text
effects own their nodes once; broader effects omit those nodes. Temporary selector
chrome/style mutations cannot trigger persistent glyph-paint/effect rescans.

This increment edits currently accepted parts. Boundary/pattern rules remain live
while selecting, but are not saved as automatic rules for future matching parts.
Reusable persistent pattern couplings, finer word/letter selection and 3D adapters
remain follow-up work. No competing appearance editor or property store is added.

## Selection feedback

Included parts use green neon traces; the boundary stays cyan. Unselected parts
are unpainted, including accepted exclusions. Accepted surfaces/contours have a soft rim, continuous rail and moving
one-device-pixel dashed seam. Hover candidate previews remain available while aiming. The seam
travels around the edge without rotating/resizing the selected object. Background
tints remain translucent. HTML backgrounds use a synchronized native inset tint
on the actual rounded surface, below its contents and over its background imagery.
It preserves the original shadows/gradients and leaves text/icon ink separate,
with no full-surface blur; the pulse updates only cached paint values each frame. The former faint SVG
surface fill is retained only for non-HTML fallback surfaces. Background and
contour matches on one element share a trace; geometry/style reads are cached.

Scene selection feedback reuses the same renderer registration as hierarchy
feedback. The background adapter paints only `scene.background`, preserves scene
objects, and restores current authored paint on deselection, editor entry, cleanup
or hiding. Its 2.6-second green pulse is capped at 30 fps with no DOM/geometry
rescans; reduced motion is steady. New scene adapters receive the current transient
paint on mounting. Hierarchy cleanup does not erase accepted selector feedback.

Accepted and hover feedback both follow a 2.6-second bright/dim/bright cycle.
Accepted seams stay one device pixel wide; previews never thicken them. The low point keeps a
faint cue while the high point restores full ink and glow. Preview changes do not
restart the shared pulse clock.

Visual hierarchy → Windows / frames / controls → UI arrangement indicators →
Selector feedback exposes Included, Excluded and Boundary. The Excluded ID is
retained for saved-theme compatibility; the single-toggle tool does not paint red. The shared Color,
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


## Explicit MS lock

`selector.lock` (default Ctrl+MB3, rebindable in Shortcuts) parks the compact MS
symbol at its current position and restores the normal cursor. The parked symbol
is pointer-transparent; clicks, context menus, wheel and property editing work
normally. Pressing the same command again resumes MS at the current pointer.
Selections, circle settings and Selection / Preview mode are retained. Escape
still clears/disables. There is no automatic freeze on entering property editors,
no automatic editor-entry hold and no simulated activation. Explicit locking retains
the pointed preview while the normal cursor edits properties. Property-input previews
and declared renderer-only activity previews are separate existing mechanisms.

## Feedback appearance and pulse controls

Selector sparkles are removed; the white particle generator, placement work and
its decorative DOM layers no longer run. Glyphs still light their actual ink;
backgrounds retain their native tint and contours retain their thin rail/glow.
Moving one-device-pixel seams cover accepted contours,
geometry boundaries and axis guides in the same unfiltered SVG. Text-only patterns
keep glyph feedback rather than receiving rectangular boxes.

Selector feedback → Pulse is a discovered configurable function, with shared
`speed` / `intensity` and one reusable `pulse` toggle definition. It owns the pulse
for this selector, while Included / Boundary keep their independent paint values.
Animation speed .25 gives a 2.6-second cycle; zero speed freezes it. Effect intensity
sets fade depth (zero is steady); Pulse off also keeps a steady cue. Samples,
native glyph/surface pulses and the scene adapter consume these same values.
Seam travel stays independent from opacity pulsing. Existing animations update
keyframes/timing in place when parameters change. The actual clock mapping lives
in `selectorFeedback.ts`; its co-located input declaration supplies automatic
coupling, Self inventory inclusion, shared editors and Controller.values
serialization. Apply/discard, theme export, locks and bypass remain authoritative.
No feature-specific editor or parallel values are introduced.

The aiming precision dot is solid saturated cyan without a halo or ring; its center remains
the exact hotspot. The stationary controller displays the same center cue.


## Selection / Preview view

The same toggle appears in Master controller, Selected appearance and the stationary
selector. The stationary circle has a labeled Selection / Preview and BG row below
it, kept within the clamped viewport; neither toggle is hidden beyond its left edge. Selection shows feedback; Preview removes all selector paint/overlays
without clearing accepted targets, the neutral boundary, history or held context.
Opening or entering an editor never switches the view. The explicit toggle shows
its current mode and selected count in the inspectors. Preview hides feedback only;
accepted membership, exclusions, history and held context remain intact. Resume and clear restore Selection; dismissing an editor preserves the explicit
view choice. No per-adapter automatic visibility metadata
or hidden editing-mode transition is used.

`selector.feedbackView` is a shared, unbound-by-default command and appears in
shortcut discovery. View changes are transient tool state and do not enter
selection undo, appearance drafts or saved settings. Hidden feedback unmounts the
actual overlay, restoring glyph/surface/scene paint through its existing cleanup;
showing it again uses the same retained targets and current appearance.


## Picking and paint invalidation

Hit candidates cache DOM relationships per catalog/pointed element; current rects
and scene hit tests remain live. A repeated category in unchanged selection and
catalog reuses its toggle candidate, avoiding full matching for every pointer pixel.
DOM/layout discovery replaces the catalog and resuming picking refreshes it after
editing. Feedback bounds and palette references stay stable across unrelated paint
edits, so controls cannot restart all native pulses on every color sample.
Exact text appearance likewise retains its bound Ranges while changing paint.
Use the shared context reader and preserve unchanged instance/policy identity in
setters; see APPEARANCE_CONTROLLER.md for the renderer/editor performance contract.


## BG detection and pattern retargeting

BG is off by default. New pointer/pattern/geometry picks omit owned UI
and scene backgrounds until BG is enabled in the stationary selector. Its command
`selector.backgrounds` joins shortcut discovery, unbound by default. This is a
detection option, not a property setter or a deselection command: changing it does
not erase already accepted backgrounds. Each new rule captures its BG policy; the
geometric working area itself does not, so turning BG on can find backgrounds
within an existing boundary. Independent negative-space gaps still need adapters.

Picking, matching, guides and feedback share one lazy measurement snapshot per
catalog/layout revision. Revisited categories reuse cached toggle candidates.
Scroll, resize, relevant DOM changes and resuming after edits replace the snapshot;
scene point hits remain live. Do not silently keep snapshot bounds across a layout
revision. The native pulse manager adds/removes only changed visible hosts, keeping
unchanged accepted animations and their common clock. Offscreen membership remains
selected but does not create Highlights/paint animations until brought into view.
Pulse timing/depth are configurable through Selector feedback → Pulse. Hairline
seams travel in their own SVG for accepted and pending contours/geometry, so dash
motion does not repaint the halo/rail layer.

### Drawing versus inclusion

Axis, direction, segment, rectangle, ellipse, polygon and freehand tools share
the Geometry group; Item, pointed contour and Pattern remain target modes.
Finishing a drawn geometry establishes a neutral working boundary, not a target
selection. Existing membership is preserved. The three circle regions reset to
neutral; explicitly checking a region or clicking a matching pattern includes it.
Native pointer release/click tails remain consumed, so drawing cannot activate
an underlying control. Pointed-contour clicks retain their explicit region behavior.

Pulse envelopes share a continuous cosine curve. A requestAnimationFrame adapter
writes fractional paint weights to cached visible glyph/background hosts and SVG
opacity; no layout reads or React state updates occur per animation frame. Scene
feedback uses the same curve. Registered selection adapters must not exclude DOM
parts from the pulse; only the scene renderer follows the separate scene path.
Speed, depth, off, hidden-tab suspension and reduced-motion settings remain.

Hover preview is independent of the Selection / Preview view toggle: aiming shows
candidate patterns by default. The view toggle hides/restores feedback without
changing membership. Explicit MS lock retains the current candidate and symbol;
normal cursor movement does not retarget them. Unlock resumes hover detection.
No Ctrl requirement or automatic editor-entry freeze is used.

Opening/closing the meta MS controller through `selector.open` preserves the
current candidate and displayed preview. Returning to aiming does not pick the
controller's former location; actual pointer motion resumes retargeting. Explicit
clear, selection commits and geometry/configuration changes keep their own rules.

### Shared background tint

`selectorSurface.ts` defines one surface strength for HTML, SVG and the scene:
paint opacity × normalized pulse level × configurable background fill strength.
The Background fill strength consumer defaults to 0.164, preserving the old
0.2 × 0.82 peak, but can reach 1 for full coverage. Preview opacity keeps its
normal 0.6 factor. Contour strength is independent and defaults to 1. Scene colors mix in display sRGB and then
return to Three's linear working space, matching CSS compositing instead of
producing an unusually bright green background.

Native backgrounds keep the inset tint below their contents. A cached source
plan accounts for same-color tint visible through transparent selected descendants;
each adds only the remaining source-over amount. Transparent portalled windows
fully contained over a selected scene surface account for that backdrop too.
Ancestor paint and geometry are read when feedback sources change, never in the
pulse loop. Background images are treated as their own painted material rather
than inferred from arbitrary image pixels. This normalizes highlight strength;
translucency still preserves differences in original background colors/imagery.
No appearance values, selection membership or pulse settings are rewritten.

### Independent selector feedback strengths

Self inventory → Selector feedback exposes Background fill strength and Contour
strength. Each is an automatically discovered appearance-owned function using
the existing shared Opacity property with independent values; no duplicated setter
or value store. Background fill strength affects only actual HTML/SVG/scene fill
paint and accounts for translucent ancestor tint at that same strength. Contour
strength affects halo, rail, seams and geometry guides, including the live sample.
Neither changes glyph feedback or the user's tuned pulse settings. Tone Color,
Brightness and Opacity remain shared tone controls; use the new fill consumer to
brighten backgrounds without boosting contour highlights. The fill slider reaches
full coverage at 1 for accepted selection with tone opacity 1 and pulse at peak.
Rendering uses existing cached hosts and clocks; no additional frame loop, source
discovery or geometry reads are introduced.

Removal preview reuses the stable `ui.guides.selector.excluded` feedback target,
now visible under Selector feedback as Removal preview. Its saved values remain
compatible. Only currently included matching candidates receive that pending red
paint; committing deselection removes the mark rather than leaving red behind.

### Registered pattern specificity

Default pointed-pattern rules capture `target` (the sampled registered subtype)
in addition to `role` (text/background/contour/icon/indicator). Matching follows
the shared registry's categorical path, with instance parts classified by their
base target. A title therefore matches other titles, not every kind of text. This
is one rule for all visual hierarchies; current color/font/brightness is not the
type identity. Explicit role-wide choices and drawn geometric intersection modes
retain their broader intended semantics. Include `target` in constraint/cache
identity so moving between sibling subtypes cannot reuse a broader candidate.
Master Controller can explicitly select a parent branch through the same selection
rule/timeline, preserving the active work-area geometry and BG policy. Mixed
parents include all their subtypes on click; fully included parents deselect.
Registered paths are indexed once; branch counts reuse existing cached work-area
peers and update with membership/geometry rather than hover frames.

Accepted MS selection reveals Visuals → Visual hierarchy, including previously
collapsed saved hierarchies. This is a transient per-selection reveal, without
layout writes or history entries. The hierarchy may be manually collapsed for
that selection; another selection reveals it again. Clearing selection restores
its ordinary saved expansion state. Hover-only preview does not reveal it.
