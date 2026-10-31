# Diagnostics: shared behavior and current scope

User clarification, 2026-10-31: warning handling must follow the same category-based,
inheritable architecture as other universal behavior. Read
[the operating rules in AGENTS.md](../AGENTS.md#user-operating-rules-required) before extending this area.

## Implemented

Composer diagnostics carry a code, message and optional operation/target identity
(`src/omnic/evaluate.ts`). `DiagnosticFeedback` presents Locate, Disable and Remove
for any diagnostic identifying an exact local operation. The radar, inspection
panel and expanded diagnostic list reuse it. `diagnosticOperation.ts` resolves
exact local IDs; it does not match suffixes or redirect to a broader owner.

Locate opens the existing operation editor. Disable and Remove use the Composer
draft owner and chronological history; Undo restores the operation. Removal does
not remove its path or other authored components. Stale/missing IDs cannot mutate
another operation. Diagnostics originating inside reused definitions do not gain
local repair controls just because a local ID has a similar suffix.

`unsupported-substrate-transform` identifies a transform that cannot apply to a
substrate-bound path. The evaluator skips that transform and reports a diagnostic
instead of aborting the composition. The pen consumes the rejection result so the
ignored operation cannot keep drawing disabled. Saved settings are preserved.
The obsolete mfx/Oscillation creation launchers are removed; legacy data remains
readable. See [path recovery](OMNIC_PATH_RULES.md#substrate-resolution-and-execution).

## Required direction, not implemented global coverage

There is no application-wide diagnostic category/remedy contract yet. Existing
codes are strings; the current operation ID supplies Composer's repair capability.
Warnings without a local operation ID do not automatically get these actions.

Before extending warning handling:

1. Classify the diagnostic using its behavioral category and identify its state
   owner, affected target/scope and supported remedies.
2. Inspect the nearest working analogue and reuse shared rendering/action routing,
   owner setters, customization, persistence and history where applicable.
3. Put category/remedy declarations and capability resolution at a shared boundary,
   so future applicable systems inherit behavior without private warning handlers
   or duplicate inventories. Consumers supply their actual identity/capabilities.
4. Expose only applicable remedies. Not every warning can or should offer Remove;
   permission, owner validation and exact scope remain authoritative.
5. Keep dismissal distinct from resolution. Hiding a message does not fix the
   underlying condition; do not silently delete user data or claim it is repaired.
6. Cover locating, repair, cancellation, stale state, Undo/Redo and recovery.
   Derived diagnostics disappear when their underlying condition is resolved.

Do not implement the global roadmap merely because this document lists it. Keep
the next authorized change bounded and use existing shared mechanisms. Preparation
and model/build checks do not establish interaction acceptance or global rollout.

## Evidence

At source `369a257`, a focused browser diagnostic exercised the legacy path warning,
Locate into Oscillation settings, Disable/Undo and Remove/Undo, verifying unchanged
path geometry. 415 model tests and the local build/backend checks passed. This is
evidence for the Composer flow, not other warning categories. Further browser
checks remain subject to the user's testing instructions.
