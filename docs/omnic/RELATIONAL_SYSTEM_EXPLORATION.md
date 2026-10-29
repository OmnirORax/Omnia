# Relational system exploration — preserved source

User-provided cleaned discussion, 2026-10-29. This is exploratory source material.
Use the [living master plan](../OMNIC_RELATIONAL_SYSTEM_PLAN.md) for current scope,
explicit corrections and experimental status.

---

next in omnic composer, we need to set up the thresholds & snap settings for any dof, such that they not arbitrary dragging, but meaningful snaps, based on relativities/thresholds u care about, for instance, halving, doubling, thirding, fixed, and those not random but based on some meaningful relativity to something else if that makes sense, like never arbitrary, e.g halving as baseline makes sense cuz its the universal root/fundamental, just like increments of 1, then 3 4 5 is something u can adjust ur self, so there are defaults for each , and u can tweak urself , and its like .. mathematical, like, either snap (fixed increases) or incremental or exponential etc like 2^6 and should also have maxes so u cant drag further, so like if fill reaches to half the O, and 4 halvings get u to 6% or something, the meaninful threshold should be marked, e.g if imperceptible at the 8th halving > that's the max or like i have a ⠒ want it go inside ◎, the available positions shouldnt be random, based on the constraints, the nearest constraint u are to is the placement location, also maethamtical, e.g opposites along certain axes as default, center etc, like what's the fastest way, so manual placement is actually mathematically and symmetrically quick or say u want to place 8 ● around a ring, whats the fastest way for it to know u wanna do that, all these questions what u think will answer them? how u sugest we go about this regardless of object/dof type?
…
I think the right solution is to build a universal mathematical constraint system, of which snapping is only the visible behavior.
You're describing something more ambitious than a snap-to-grid editor: a composer that discovers meaningful configurations from the freedoms and constraints of whatever you're manipulating.
The goal is to minimize the distance between intended configuration and realized configuration, without requiring you to manually calculate coordinates, ratios, or increments.
## 1. The universal foundation
Any DOF can be described by the same core structure:
DOF
What can vary?
Domain
Possible values
Constraints
Permitted values
Relations
Reference values
Meaningful candidate values
Generated mathematically from those relations and constraints
Snap selection
Which candidate?
Termination
When to stop?
This works across position, size, rotation, count, distribution, opacity, spacing, fill, repetition, and virtually any numerical DOF.
Crucially, the engine doesn't need to know what an object means to calculate its mathematical structure.
## 2. The mathematical operations
We can reduce a huge number of seemingly unrelated editor controls to a handful of mathematical families.
|Family|Operation|Example|
|---|---|---|
|Additive|Fixed increments|1, 2, 3, 4...|
|Multiplicative|Repeated scaling|1, 2, 4, 8, 16...|
|Fractional|Partition reference|1/2, 1/4, 1/8...|
|Distributive|Equalize within domain|8 points, equal angular spacing|
|Relational|Match another quantity|Same radius, half parent|
|Geometric|Extract structural landmarks|Center, endpoints, axes, intersections|
|Constraint-based|Solve permitted configurations|Tangency, containment, no overlap|
These are generators, not lists of arbitrary hardcoded snap locations.
For instance, once you have partition, you can partition any relevant reference into 2, 3, 4, 5, or N parts.
Halving can be the preferred default because binary partitioning is simple, symmetric, and recursively applicable. But it shouldn't be mistaken for a universally optimal snap: different DOFs have different natural structures.
## 3. Snap candidates must be relative to something
This is probably your most important observation.
A value isn't meaningful merely because it's mathematically neat.
50% of what? 2× relative to what? Center of which boundary?
Every snap candidate should have a derivation.
Example: filling a circle














Reference: enclosing circle's area
# 25%
Filled area after 2 halvings
Notice: halving area is not the same as halving radius. The composer must preserve which quantity the relationship refers to.
We want automatic reference discovery, not automatic assumption.
The engine could propose references in a hierarchy:
1. Self: Own size, center, previous value, bounding box.
2. Parent: Containing object's dimensions and constraints.
3. Neighbors: Adjacent edges, centers, sizes, distances.
4. Selection: Relationships among the currently selected objects.
5. Global: Canvas origin, coordinate system, global units.

The references themselves are discoverable from structure.
## 4. Position: derive snaps from geometry
Consider putting `⠒` inside `◎`.
Instead of a grid of arbitrary coordinates, inspect the enclosing geometry.
Derived positions within a circular boundary
AxesDiagonalsCombined





Centers, axis intersections, and evenly partitioned directions are generated from the boundary, not placed on a fixed pixel grid.
But there's a deeper complication: the permitted position depends on the geometry of the thing being placed.
A point can lie on a boundary. A finite-size glyph centered there might extend outside it.
So the actual valid positioning region must be derived from the object and container together.
This is a known computational geometry operation related to configuration space and Minkowski difference.
That's an excellent general-purpose foundation for your constraint engine.
## 5. Eight ● around a ring: how does it know?
8 points, distributed around an enclosing ring

8 elements → one circular boundary → equal angular separation of 45°.
This example exposes something important.
You cannot uniquely infer the intended arrangement from count and boundary alone.
Eight dots in a circle could mean a perimeter ring, a grid, two rows of four, radial spokes, or a cluster.
But you can make the intention extremely cheap to express.
My suggested interaction:
- Place one ● near the ring.
- Increase count to 8.
- The system identifies the nearby circle as a candidate distribution path.
- The composer previews an equally spaced ring arrangement.
- One action accepts it; another cycles to other valid arrangement families.

This requires three mechanisms:
A. Structural recognition: Identify circles, axes, boundaries, paths, repeated elements, and symmetry.
B. Candidate generation: Derive valid arrangements mathematically.
C. Intent selection: Prioritize candidates using the user's current action, selection, nearby constraints, and previous manipulation.
The system should recognize that eight identical objects near a ring makes circular distribution plausible, without pretending it is certain.
Better still, if you initially place two dots at opposite ends, that explicitly establishes an axis. The engine can then use that axis to orient the remaining six dots.
That's where manipulation becomes a language of intention.
## 6. Thresholds and termination
You also identified a distinction that's worth formalizing.
A mathematical sequence can continue indefinitely, while its useful manifestations cannot.
A good constraint system needs multiple kinds of limits.
|Limit|Stop condition|
|---|---|
|Mathematical|Value leaves the valid domain|
|Geometric|Collision, clipping, or containment failure|
|Perceptual|Difference is no longer reliably visible|
|Representational|Change cannot be distinguished at current rendering precision|
|User-defined|Explicitly established minimum or maximum|
|Contextual|Further change loses relevance to the current operation|
For your repeated halving example, a perceptual stopping point would depend on zoom, screen resolution, contrast, surrounding elements, and what property you're halving.
For example, a diameter that shrinks below a pixel cannot be rendered faithfully at that zoom. But perhaps the glyph still exists in the underlying model, and can become visible when zoomed in.
Therefore, distinguish hard limits from soft limits.
Hard limits prohibit invalid states. Soft limits stop ordinary dragging at meaningful thresholds but allow deliberate overrides.
The system shouldn't destroy genuine DOFs merely because the current viewport can't display them.
## 7. The missing piece: snap priority and activation
Even a perfect collection of mathematical anchors becomes useless if every drag produces twenty competing snaps.
I would separate:
- Eligibility: Is this snap mathematically and geometrically applicable?
- Relevance: Does it reference the object or constraint currently being manipulated?
- Proximity: How close is the current gesture to the candidate?
- Simplicity: How much additional complexity does the candidate introduce?
- Commitment: Has the user already established a relationship that should persist?

The most important principle:
Preserve established constraints before introducing new ones.
If you've already declared eight dots equally spaced around a circle, resizing the circle should preserve that arrangement automatically.
You should not have to rediscover eight snap locations on every resize.
This turns snapping into persistent, editable relationships, rather than one-time coordinate corrections.
## 8. How I'd organize development
I wouldn't start by individually designing snaps for every DOF. That would create exactly the combinatorial explosion you're trying to escape.
I'd build this in four layers:
01
Universal DOF representation
Each freedom has a domain, value, measurement, references, and limits.
02
Mathematical generators
Partition, increment, scale, align, match, distribute, and solve constraints.
03
Structural relationship discovery
Recognize boundaries, centers, axes, containment, adjacency, symmetry, and repetition.
04
Interaction and preference engine
Rank candidate snaps, offer previews, preserve chosen relationships, and learn preferred defaults.
### One architectural decision I'd make immediately
Don't store a snapped value alone. Store its derivation.
Instead of storing only `radius = 40`, store the relationship `radius = parent radius / 2`.
Instead of eight absolute coordinates, store `count = 8`, `distribution = equal angular`, `path = parent circle`, `phase = top`.
That gives Omnic something much more powerful than convenient editing: compositions that retain their mathematical meaning when the surrounding structure changes.
**now: how do i actually navigate all these possiblities, obvsly wont want a window listing 100 diff things, the right thing should appear on need, how we do that**
The solution is contextual progressive disclosure driven by intent detection.
But I think there's a more fundamental principle:
The interface shouldn't expose operations. It should expose the next meaningful freedom.
You shouldn't have to think, "I need the angular-distribution tool." You should think, "I want eight of these around that circle," and the interface should make that configuration accessible with minimal action.
## 1. Three levels of interaction
Level 1: Immediate
Direct manipulation automatically activates the most relevant snap. No menus.
Level 2: Alternatives
When multiple plausible configurations compete, show 2–4 nearby choices, not the entire library.
Level 3: Explicit control
Access all relevant generators, references, parameters, and thresholds through a focused property inspector.
The default experience lives almost entirely in Level 1.
## 2. The interface should derive relevance from the action
The crucial distinction is between what's theoretically possible and what's currently plausible.
|What you do|What becomes relevant|
|---|---|
|Drag an object|Position, alignment, containment|
|Drag its edge|Size, ratios, matching dimensions|
|Rotate it|Angles, axes, symmetry|
|Increase its count|Repetition, distribution, arrangement|
|Move it near a circle|Center, boundary, radial position|
|Select multiple objects|Spacing, alignment, symmetry, distribution|
|Adjust fill|Fractions, proportions, saturation limits|
An action already reveals the DOF. That immediately eliminates most unrelated possibilities.
Then the current geometry and neighboring objects eliminate more.
Intent detection = Action × Selected DOF × Geometric context × Existing relationships.
Not mind-reading. Progressive elimination of irrelevant possibilities.
## 3. The most powerful interface: meaningful manipulation handles
Instead of navigating settings, let the geometry reveal what can be done.
Consider this miniature interaction model.
Concept: Context-aware Composer
CountPositionSize
8 selected elements near a circle
Preview





Relevant controls appear here
Count
8
Equal angular distribution
Linear distribution
Grid distribution
Notice what's happening: the mathematical engine remains universal, but the interface is generated from the active DOF and its relevant relationships.
## 4. Use spatial gestures as questions
Rather than requiring a tool selection before every operation, the user's manipulation should query the environment.
- Dragging toward a boundary: "What meaningful positions exist relative to this boundary?"
- Dragging between two objects: "What alignments or equal spacings exist between these?"
- Increasing count: "How can this collection be distributed within its available geometry?"
- Crossing a ratio threshold: "What's the next meaningful scale?"
- Dragging past a soft limit: "Do I want to override this constraint?"

The geometry becomes the menu.
A snap preview should appear before commitment. The user can accept by releasing, continue moving to another candidate, or explicitly cycle alternatives.
However, avoid making a single drag gesture unpredictably change operation families. If you're resizing, the primary interaction must remain resizing unless you deliberately invoke another mode.
## 5. A relevance cascade
The engine should filter candidates in this order:
1. Active DOF
Eliminates unrelated operations
2. Valid constraints
Eliminates impossible outcomes
3. Nearby relationships
Finds meaningful references
4. Established intent
Preserves existing structure
5. Ranked candidates
Offers the strongest few
I'd also add hysteresis: once a snap is activated, it shouldn't rapidly jump to another snap just because the pointer moves a fraction of a pixel. The new candidate must become meaningfully preferable before switching.
This prevents the system from feeling nervous or unpredictable.
## 6. An important improvement: distinguish three kinds of discovery
Not everything should activate in the same manner.
|Discovery type|Activation|
|---|---|
|Immediate|Available because of active manipulation, e.g. center while positioning|
|Contextual|Appears because a relevant relationship exists, e.g. circle distribution|
|Explicit|Requires deliberate request, e.g. logarithmic scale or unusual partition base|
Trying to automatically expose exotic mathematical operations would introduce more complexity than it removes.
You need a full possibility space available in the underlying system, not permanently represented in the interface.
## 7. My recommendation for Omnic
The best architecture is:
Universal mathematical engine → contextual candidate filter → preview → immediate manipulation → optional persistent constraint.
But I'd add one particularly useful mechanism: a consistent 'more possibilities' gesture.
That gesture should always mean: show the next-best valid candidates for the DOF I'm currently manipulating.
This provides access to the entire mathematical system without making it visible all at once.
And the next level is compositional interaction: each operation you perform narrows the remaining possibility space. For example, establishing an axis before increasing count should make symmetrical distributions aligned with that axis much more relevant.
That means the Composer becomes increasingly accurate at offering relevant configurations as your composition develops, without requiring opaque AI predictions.
One design question remains genuinely important: when you drag through multiple meaningful ratios (½, ¼, ⅛), do you want the pointer to move continuously and magnetically snap at each threshold, or do you want each drag step to advance discretely from one meaningful value to the next?
Next: define the interaction grammar, then implement it in Codex.
We've established the mathematical engine and how relevant possibilities emerge. What's missing is the exact way you navigate, select, modify, and commit them.
I suggest five universal interaction rules:
|Action|Meaning|
|---|---|
|Drag|Explore values continuously with magnetic snapping|
|Scroll / step|Advance through meaningful discrete values|
|Cycle|Switch between competing snap candidates|
|Lock|Preserve the selected mathematical relationship|
|Expand|Reveal additional possibilities for the active DOF|
These should work consistently across position, size, count, rotation, fill, and future DOFs.
## The next three decisions
1. Activation: When should candidate snaps become visible? Immediately on selection, when manipulation starts, or only near relevant thresholds? My default: subtle handles on selection, candidate previews during manipulation.
2. Competition: What happens when two snaps are equally relevant? My default: maintain the current snap and expose alternatives through cycling, rather than making the result jump unpredictably.
3. Persistence: When does a snap become a constraint? My default: releasing commits the value; locking commits the relationship. No unintended dependencies.
Then we should implement a single vertical slice: one object inside another, supporting positioning, resizing, ratios, snap cycling, and persistent constraints. Validate the interaction feel before expanding to repetition and distributions.
what u think about the following: when u drag an object through another that's detected and offers an uninterruptive relationship binding cue , if u accept the default is 8 symmetries,/parts/fractions, u can increase those if u type some value e.g 2^6 instead of the base 2^3, and so the cloesst thing to ur mouse means it would release on that fraction -pre configured contrains like that, applied to all dofs, but thats a very specific example i have in mind, but it may capture the method globally perhaps in some way , what would be variant is perhaps type of relation/dofs included not sure, i mean any edits u make will be in respect to that relation, unless u turn off the relation, e.g increase count > spreads it along one of the relations dofs, turn off > self-based relation and so when u right click in the context > it opens the active dof's so u change their fractions but what about when u want specific rule? like u want the 7th half but hard for u tell which that would be even if available in the drag detection