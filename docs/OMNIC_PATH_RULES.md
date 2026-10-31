# Composer path-rule experiment

This is an iterative construction experiment in Omnic Composer only. It is not a
new Omnic semantic grammar, a replacement for MS, or a rollout to other DOFs.

## Entry and controls

Right-click empty Composer space, choose **↱ Path rule**. The clicked origin snaps
to a whole construction unit, and the circular direction editor opens immediately
without an MS reference request. A fresh rule has no implicit instructions.

Click ↑, →, ↓, ← to append instructions in that order. The numbered chips show the
program; clicking a chip selects it and opens the existing math dial for its
whole-unit move count. The wheel centre opens that count too. At most eight
instructions are supported. ＋ arms a fresh sequence; the next direction replaces
the old sequence and resets its turn to zero. ⌫ removes the selected instruction
when more than one remains. ↺ loads the example square rule.

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
including inherited offsets, must also be whole units. Cardinal headings and
quarter turns are the initial exact movement domain, independent of Atomnic's
hexagonal touching-dot arrangement. Arbitrary angles are not yet offered.

Creation captures the current Composer view bounds, including its circular radar
boundary, as the substrate. Those bounds persist with the recipe, independently
of later UI resize/zoom. The whole next unit cell must fit; a boundary collision
pauses before that move and never shortens it. Non-Atomnic views use the captured
substrate for stable framing. Ordinary scale/rotation/motion transforms are rejected
on substrate-bound generators; edit the movement rule instead. Integer Position
changes move the origin within the captured substrate.

A connected trace deposits on unit substrate cells, represented by nonoverlapping
square SVG cells. Discrete mode uses smaller separate marks at those same cells.
This deliberately resolves overlaps to the substrate: revisiting or crossing an
already visited cell adds coverage to that cell once per traversal, capped at 100%.
It is not free-angle/subpixel brush painting. There is no time/dwell deposition.
A white glowing particle marks drawing position.

The shared pure engine compiles each program/domain into a bounded trajectory.
A repeated complete traversal state identifies a period; coverage and particle
position for arbitrarily late times are evaluated analytically from that period.
There is no ever-growing segment log. Limits: 192 visited cells per trajectory,
4096 compiled transitions, 32 cached plans, plus existing global evaluator and
256-role/12fps animation budgets. A capacity stop is reported, not interpreted as
closure. Fixed generation also observes its chosen unit-move limit.

Play/pause retains elapsed time and the last displayed frame. A completed drawing
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
