# Shared domain filtering

`src/filtering/model.ts` is the pure matching owner. Systems supply a typed
`FilterSchema<T, Context>` with searchable text and facets. Each facet declares a
stable ID, label, options and an accessor returning its applicable option IDs.
Domain facts can come from prepared indexes or account context. Reuse existing
search normalization; queries are literal token matches, not executable regex.

`prepareFilters` captures facts/text once per item/schema/context snapshot.
`applyFilters` combines text with AND across selected facets and derives option
counts under all other filters. Missing selections mean All; invalid transient
choices are ignored. Source objects are never mutated. A system needing an extra
facet supplies its adapter; it does not copy matching logic or add a switch for
its system ID to the shared base.

`useFilters` owns transient selection, reset, clamped pagination and revealing a
newly authored item. `FilterControls` and `FilterPagination` provide shared
UIField/UIAction controls, identity, search/movement/customization integration,
counts and navigation. Callers supply a stable scope/category, memoized schema
and context, then render `filters.items`. The quest pagination preserves its
existing `quests:previous` and `quests:next` action IDs. New systems get separate
hook instances/scopes, not a global shared selection store. Extend this base for
new broadly applicable control kinds instead of copying its state or matcher.

Questboard's only domain adapter is `metrics/questFilters.ts`: Speed clicking
means under 30 seconds; Endurance clicking means at least 30 seconds. Existing
seed quests cover both, so no synthetic quests or reward claims are inserted.
Status uses current-account claims and best results. Both categories retain the
same timed primary-click benchmark engine; this is classification, not a new
input activity. Category labels appear on cards and in search. Changing filters
resets pagination; publishing reveals the new item, resetting incompatible filters.
Account changes reset the transient selection. Refreshes update profile facts.

Preparation/matching depends on bounded cloud snapshots (currently at most 500
quests), not pointer or timer events. Rendering stays capped at 12 cards per page.
Filtering adds no network requests, database writes, geometry evaluations or
workbench-wide timer subscriptions. An independent inventory-domain test verifies
reuse without importing quest rules or reading domain facts on every query.

Saved-data impact: none to authored quests, benchmark identity, claim/reward
semantics, schemas, exports or timer preferences. Category is derived from the
existing duration; filter selection is memory-only. Shared control layout/naming
continues through the existing UI owner. No automatic backend migration is needed.
Older clients continue to see the same quest records and behavior.

Existing Omnic structural filters have evaluator-specific prepared facts and saved
query semantics. They were inspected as an analogue and remain intact; migrating
those saved filters is separate work, rather than silently changing their format
or matching semantics. This base initially supports text and single-choice facets;
new systems can extend shared capabilities when they actually need other kinds.

See [the maintained walkthrough](CAPABILITIES.md#interface-filters). Model/build
checks do not establish browser interaction or performance acceptance.
