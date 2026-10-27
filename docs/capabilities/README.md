# Capability guide authoring contract

The user-facing entry point is [CAPABILITIES.md](../CAPABILITIES.md). The reviewed
source is [catalog.json](catalog.json); commands and native gestures come directly
from the application's existing registries. Do not create a second runtime action
catalog or infer availability from a label alone.

Before implementing a request, search the guide and relevant subsystem source.
Identify an existing feature to extend, a defect to fix, or a genuinely missing
capability. Tell the user when the requested behavior already exists and provide
its entry path; do not reimplement it because chat context was lost.

For every feature/change, update the source catalog in the same commit:

- Stable capability ID and an exact user-facing title.
- Where to find it, prerequisites, and which active selection/context it uses.
- Actual behavior, supported options/gestures and persistence/undo semantics.
- Minimal numbered actions with an observable expected result for EACH step.
  Exercise the new behavior specifically; a broad parent walkthrough is insufficient.
- Limits, known failures, dependencies and unavailable/planned behavior.
- Separate implementation, deployment and verification status. Record browser
  acceptance only from observed/user-reported evidence, with date, source commit
  or preview, tested steps and result. Never infer it from model/build success.
- Registered action/gesture IDs, real source paths, subsystem reference, and related
  capabilities. For replacements record the retired route and its replacement;
  preserve the capability's stable identity where the behavior continues.

Native controls and commandless behavior (sliders, docking, property targeting,
filtering, storage) need walkthroughs too. Add independent entries when a feature
has its own discoverability or test requirements. Keep the guide current rather
than appending contradictory chronological versions.

Run `node --run docs:capabilities`, review the generated user guide, then run
`node --run check:capabilities`. Normal test/type/build commands check coverage and
freshness. New registered actions/gestures without coverage fail the check. Names,
bindings and command descriptions regenerate from the actual registries.
Automation cannot invent accurate human instructions for arbitrary code: the
implementing worker must author them. The mandatory entry rules and coverage gate
make that part of the implementation, not an optional later handoff.

At delivery, link directly to the changed capability sections, explain how to
open them, list what was added/changed/replaced, and state tests still awaiting the
user. Do not make the user reconstruct a feature from PR files or chat history.

The guide currently lives in the repository, accessible through its README and
GitHub. An in-app searchable guide surface is not implemented by this change.
