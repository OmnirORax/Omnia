Describe the concrete behavior added, changed or fixed.

Capability guidance: link the changed sections of `docs/CAPABILITIES.md` and name
any replaced/retired route. Include exact entry points, minimal test steps and
expected outcomes in the source catalog, then regenerate the guide. For a change
with no user-facing behavior, state that explicitly.

Validation: checks actually run; user/browser acceptance still pending; deployment
requirements where applicable. Keep implementation, verification and release
status distinct.

Saved-data impact ([contract](../docs/DATA_EVOLUTION.md)): identify affected
owners/formats and existing values/references, or explain why unaffected. For
changes: describe compatibility/migration or deliberate retirement, historical
fixture evidence, original-preserving failure/recovery behavior, and any
older-client/rollback/backend rollout requirements. Distinguish implemented
safeguards from outstanding work.
