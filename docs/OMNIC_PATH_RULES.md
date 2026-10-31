# Composer path-rule experiment

This is an iterative construction experiment in Omnic Composer only. It is not a
new Omnic semantic grammar, a replacement for MS, or a rollout to other DOFs.

## Entry and controls

Right-click empty Composer space, choose **↱ Path rule**. The clicked origin snaps
to a whole construction unit, and the circular direction editor opens immediately
without an MS reference request. A fresh rule has no implicit instructions.

Drag the frame/title or empty panel background to reposition the whole rule popup using shared popup dragging.
Switching a populated rule into drawing starts playback; its registered ⏯ control
pauses/resumes it. Idle math dials yield Enter to parent confirmation.

Use empty space in the shared rotation axis wheel to append directions. Next
instruction is optional. The 2³
expression configures direction fractions through the shared math dial (1–64,
initially eight); cardinal thresholds remain available. Right-click the wheel
opens fraction configuration too. The numbered chips show the
program; clicking a chip selects it and opens the existing math dial for its
whole-unit move count. The wheel centre opens that count too. At most 32 instructions are supported. ＋ arms a fresh sequence; the next direction replaces
the old sequence, resets turn to zero and disables Loop and Closure. The old count
editor closes when ＋ is armed; the new first instruction opens a fresh count dial. ⌫ removes the selected instruction, including the last one. Right-clicking a
numbered instruction chip removes that chip directly. ↺ loads the example square rule.

Compact controls have descriptive tooltips and accessible names:

- ↻ chooses a constant turn after every complete instruction (0/90/180/270°).
  The wheel temporarily chooses that turn instead of appending a direction.
- ⟳ repeats the instruction sequence. Without it the sequence runs once.
- ⊙ stops on returning to the origin after a complete sequence, after a positive
  number of unit moves. Crossing the origin within a sequence does not stop it.
- ▶ switches fixed generation/drawing. Drawing exposes the existing Composer
  Play/pause command; playback is not a second private animation loop.
- ⠒ / ━ switches separate marks/connected substrate cells; movement is identical.
- ≤100 configures the fixed-generation maximum number of **unit moves** (1–10000,
  default 100). A long instruction cannot evade that limit. Drawing does not use
  this fixed-generation cap.
- 100% configures additive coverage per traversal (1–100%). Ten 10% visits or one
  hundred 1% visits reach exactly full coverage, independent of animation frames.
- 8/s configures drawing speed in unit moves per second (1–60).

Examples: ↑2 + turn 90° + Loop + Closure makes a square with side length 2.
↑2 →2 ↓2 ←2 + no turn makes the same square explicitly. Changing direction/count
or any rule option updates the existing construction through normal target setters
and history. There is no Apply/checkmark button; Enter leaves the editor through
existing context confirmation. Accepted individual rule edits remain undoable.

## Substrate, resolution and execution

The indivisible movement unit is one construction unit. Positive whole-unit counts
are checked both at program import and in the pure engine. Starting positions,
including inherited offsets, must also be whole units. Angular fractions supply headings independently of Atomnic's hexagonal layout.
Travel distance remains one unit per move; vector coordinate components may be
fractional. Coordinates are normalized to 1e-9 and closure uses a 1e-7 tolerance.

Creation captures the current Composer view bounds, including its circular radar
boundary, as the substrate. Those bounds persist with the recipe, independently
of later UI resize/zoom. The whole next unit cell must fit; a boundary collision
pauses before that move and never shortens it. Non-Atomnic views use the captured
substrate for stable framing. Ordinary scale/rotation/motion transforms are rejected
on substrate-bound generators; edit the movement rule instead. Integer Position
changes move the origin within the captured substrate.

Continuous traces render whole-unit traversal edges as joined vector strokes with
round caps. Collinear adjacent edges at equal coverage merge, eliminating cell
seams. Repeated traversal accumulates coverage on canonical unit edges; discrete
mode retains separate marks and cell coverage. Movement remains indivisible.
At intersections of differently oriented translucent strokes SVG compositing still
applies; exact additive painted-area coverage at crossings remains future work.
A white glowing particle marks drawing position.

The shared pure engine compiles each program/domain into a bounded trajectory.
A repeated complete traversal state identifies a period; coverage and particle
position for arbitrarily late times are evaluated analytically from that period.
There is no ever-growing segment log. Limits: 192 visited cells per trajectory,
4096 compiled transitions, 32 cached plans, plus existing global evaluator and
256-role/12fps animation budgets. A capacity stop is reported, not interpreted as
closure. Fixed generation also observes its chosen unit-move limit.

Playback time starts at the first displayed frame. Each displayed update advances
by at most one configured frame interval, so startup/layout stalls do not skip
short drawings to completion. Play/pause retains elapsed time and the last displayed frame. A completed drawing
retains its final frame; Play restarts it. Editing the recipe starts a fresh run.
Playback state is transient, not saved saturation or independent authored geometry.
Visibility/reduced-motion/slow-frame safeguards remain. Multiple animations share
the same clock; per-frame aggregate role limits are checked before rendering.

## Extension and verification

`pathRule.ts` owns ordered traversal, unit validation, stopping, periodic execution
and additive coverage. Fixed/drawing and separate/connected renderings consume the
same results. Registry metadata chooses the rule editor for both preset and target
entry and declares substrate ownership; the square is an example program, not a
special shape evaluator. Future movement domains need an actual direction/substrate
adapter, not copied square generators. Branching, arbitrary turns, bounce/wrap,
editable substrate domains, durable deposited paint and multi-reference geometry
remain future work.

Model tests cover explicit/compressed square equivalence, imported fractional
rejection, closure order, whole moves at bounds, fixed move limits, exact additive
coverage, frame-rate independence, indefinite bounded cycles, persistence,
rendering, target setters, placement capture and blocked transform bypasses.
Browser interaction, appearance, playback pause/resume and usability await user
confirmation; no browser suite was run.

The shared dial session retains hover previews internally until commit/cancel;
path counts use it directly without a local preview wrapper. The shared cursor is
rendered above contextual popovers. Verify both interactions in the current preview.

Press a direction and drag before releasing to set its instruction count. The
first meaningful motion locks a free-space scalar axis; every 12 CSS pixels
changes one count increment. The × control configures its multiplier with the
math dial (2² gives four unit moves per increment). Direction remains fixed
throughout the hold. Release commits one instruction and its count. Simple clicks
retain a one-unit instruction; pointer cancellation/window blur discards the hold.

The shared wheel uses bright fractional spokes, orange selected-direction feedback
and a bright hover preview. The active instruction/count has a strong selected
state; authored directions remain thresholds if fraction settings change.

Direction readouts use one-based addresses in the offered states (for example,
7/12), rather than degrees. Count dragging has one increment per configured
fraction; with twelve divisions and ×4, position 7/12 represents 28 unit moves.
Ticks and live/saved count fractions appear along the axes. Shared angular glow
uses the inherited base colour without a tinted fill. Next instruction closes the
active count editor and clears chip selection without deletion. Backspace removes
the active chip while ordinary text fields keep text editing.

Correction: step subdivisions are represented by physical nodes on axes, numbered
by instruction order, not step-fraction text labels. Hover a node to highlight it;
hold-drag to adjust its count in place. Drop it onto another node or numbered chip
to reorder, preserving its direction and count. Drop resolution happens once on
release inside this editor. A new heading still appends an instruction. Direction
readouts/chips/turn controls use fraction notation; added threshold axes do not
inflate the configured denominator. Decorative-rim opacity no longer dims the
interactive wheel's glow. Interactive confirmation remains pending.

Direction fractions identify the integer slice containing the heading; they never
show decimal slice ordinals. Idle nodes/spokes do not glow; hover/selection supply
the limited glow. Drag an existing node around the circle to change its direction; drag it radially
to change count. These dimensions can change together, without a mode button. Select ⇄, then another node or
chip, to exchange those two units without shifting intervening instructions.
Normal drag-to-reorder remains a move, distinct from Swap.

Existing node drags use shared polar selection, with a small jitter threshold and
press-offset preservation. Release accepts heading/count together. Cancellation
discards the preview. New instruction creation and exact pair Swap are unchanged.

Empty wheel space appends a new instruction directly. Existing-node clicks
select/edit rather than append; Next instruction optionally clears the editor. Shared geometry-based node
hit testing prevents missing SVG metadata from falling through to creation.
