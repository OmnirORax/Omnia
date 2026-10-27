# Omnic Stage 2: workspace library

Status: implementation for review. Stage 1 remains implemented with browser
acceptance pending. Stage 2 adds persistence and organization, not a finalized
grammar. Full interpretation/frame enforcement remains Stage 3.

## Agreed scope

The user chose a **workspace-wide library** and **explicit cloud save/load**.
Local editing autosaves independently. No background cloud synchronization,
Realtime collaboration, automatic merging or semantic identity reconciliation.
All existing Master Controller, selector, compactness and performance contracts
still apply. This supersedes the Stage 1 deferral of library organization and
explicit version pins in [OMNIC_COMPOSER.md](OMNIC_COMPOSER.md).

## Identity and persistence

`omnic/workspace.ts` defines the version-1 `omnium-workspace` envelope. It has a
stable workspace ID, stable named atlas IDs, one canonical `Entity[]`, atlas
documents without duplicate entity arrays, and library organization. An active
atlas borrows that shared pool through a cached projection; the ordinary version-2
atlas/Three.js editor continues working. UI containment, collections, tags,
families and placement never assert canonical knowledge relationships.

The first load migrates `omnium.atlas.v2` (or v1) without changing canonical IDs or
placement state. The previous atlas storage is retained. Existing composer drafts
are copied into the workspace namespace; new drafts/history owners use workspace
and entity identity so unrelated workspaces cannot share an accidental legacy ID.
Opening an empty atlas still provides the shared objects through library/reuse.

`workspaceStorage.ts` uses IndexedDB `omnium-workspaces` / `snapshots`, slot
`active`, with transaction-completion reporting. A localStorage compatibility
fallback tracks which store has the latest successful write; a failed authoritative
read must not silently reopen an older copy. Storage failure reports that export
is needed. The `before-replace` slot preserves the previous workspace before a
workspace import or cloud load. **Recover previous workspace** restores that slot.

Normal atlas export remains available and carries the canonical definitions and
archived dependencies needed to reconstruct it. Library **Export workspace**
includes every atlas, organization and revision. Workspace JSON/cloud snapshots
are capped at 8 MB; ordinary atlas import retains its 5 MB bound. Existing JSON
atlas import creates an independent atlas and remaps incoming canonical IDs,
recipe references and role addresses. Equal imported IDs or drawings never merge
unrelated objects. Workspace import deliberately restores the complete supplied
identity graph and makes a recovery backup first.

The shared `omnium` history owner now reads workspace state. It excludes navigation
and monotone local counters from conflict patches. Undo after an atlas switch
restores the correct workspace objects, without applying one atlas's edit to a
different atlas. Removing an identity still used by another atlas fails validation;
remove the other placements/references explicitly first. No private library undo.

## Revisions and dependencies

`Entity.omnic` is the current live definition. Stage 2 saves use recipe version 2;
version-1 recipes remain importable. Migration upgrades the format without changing
identity or geometric parameters. Version 2 prevents a Stage 1 reader from silently
ignoring a pin and displaying a different live dependency. `Entity.omnicHistory` stores saved
structural snapshots, identified by their recipe revision, with frozen dependency
references. There is still one canonical identity. `Component.referenceRevision`
is absent for live follow, or names an archived revision for a pin. Shared edits
continue updating all live uses by default. Choosing a pinned revision is explicit.

`omnic/revisions.ts` archives definitions and supplies the same resolver to the
evaluator, composer, library and scene renderer. Snapshot dependencies are pinned
recursively, so later changes in reused objects cannot change an old saved result.
Missing pins and cycles are rejected; a finite reference to an earlier revision
of the same object is permitted. An unresolved generated role remains explicit.

At most 32 revisions per object and 2,048 archived recipes per workspace are
supported. Old unreferenced versions may age out; incoming pins preserve their
versions. Saving fails explicitly if required pins exhaust the supported archive.
The explicit **Prune unpinned history** action frees old snapshots while keeping
the current version, incoming pins and their self-reference closure; shared Undo
can restore the pruned archive. Restoring a saved definition creates a new current
revision, preserving chronology;
it does not rewrite an archived revision. **Create independent copy** creates a
new canonical identity. Copying a placement continues referencing the same object.

## Use

Open **Create → Omnic library** (also searchable and rebindable). Choose the
active atlas at the top. In **Organization**, enter a name to create/rename an
atlas, workspace or collection. Collections can nest and one object may belong
to several; membership never copies its structural definition.

Search by name/alias/tag, optionally combine **Structural filters**, then select
an object. **Edit object** opens its composer; **Place shared object** creates an
ordinary placement in the current creation context; **Create independent copy**
creates and opens a distinct object. Edit name/tags together and save, assign
collections, or mark it **Reusable preset**. Workspace presets appear in the
composer's existing Preset control and load into its draft. Ordinary live reuse
remains the Reference generator.

Structural filters cover computed unit count, boundary/fill/motion presence,
generators, enabled operators and declared numeric parameter ranges, including
referenced definitions. Computed geometry is distinct from authored tags/frame
declarations. A family is a named saved combined query, evaluated against the
current indexed facts. It is not a claim that visually matching objects have the
same meaning. Parent collection filtering includes its nested collections.

**Dependencies / revisions** shows direct live/pinned uses and their source
objects. Select a saved revision for a frozen preview and **Restore as new
revision** to adopt it. In the composer, selecting a reference component exposes
**Dependency version**: live by default, or an explicit saved revision.

## Search and rendering budgets

The library generates no thumbnail for result rows. Results mount 32 rows per
page; only the selected archived revision renders a preview. Structural evaluation
builds a cache in short scheduled batches (4 ms between yields, progress published
at most every 50 ms). Queries read facts and never evaluate recipes while typing
or scrolling. The last two workspace indexes remain cached across library reopening. Cache keys
track immutable recipe identities and transitive versions,
including changes that reuse an undone revision number. Metadata-only edits reuse
unchanged facts. Indexing is limited to 256 distinct dependencies per object and
reports unavailable facts explicitly; unknown is never treated as zero/false.

Existing evaluator and scene budgets remain in force. No extra scene animation,
per-object clocks, broad pointer scans or per-frame persistence were introduced.
The model/build checks do not establish actual browser smoothness. Large entity
pools still use existing document validation/projection paths; whole-document
commits and initial indexing are bounded but are not a completed performance
recovery of those older systems.

## Cloud contract and rollout

Sign in/create a private workspace through the existing **Workspace settings →
Cloud connection**. In the library's Cloud workspace section choose that workspace
and explicitly save or load. The first save expects an empty cloud slot. An
existing slot requires loading first, or a locally remembered base version for
this account, cloud resource and local workspace. A local edit during download
aborts replacement. Cloud saving captures one workspace; edits made while the
request is in flight remain local until the next save.

Migration `20261027000100_workspace_snapshots.sql` adds an RLS-protected snapshot
table with a separate monotone server concurrency version, plus an atomic service-
only save function. The existing authenticated Edge handler validates membership,
the shared portable workspace model and byte budget, then calls that function.
The database locks the workspace row, rechecks owner/editor membership, checks
the expected version, and handles retries with the same request ID idempotently.
Viewers may read; outsiders cannot read and ordinary clients cannot directly write
rows or invoke the trusted save RPC. Concurrent saves cannot both win. No secrets
are added to browser configuration, and there is no parallel auth/asset service.

Apply the additive migration, deploy the compatible existing backend function,
then release the frontend through the normal review flow. Do not reset a hosted
database or relax origin/access rules. This feature's code does not deploy itself;
the previously hosted backend remains unchanged until that rollout is authorized.
GitHack stays a local visual preview and is not added to the backend origin allowlist.

See [BACKEND.md](BACKEND.md) for environment setup and permission tests. Validation
results and any environment limitations are recorded at handoff; browser acceptance
and hosted rollout must be distinguished from model/local backend evidence.

## Validation (2026-10-27)

- `node --run test`: 271 model/architecture checks pass, including workspace migration,
  identity isolation, version pins, frozen dependencies, import target remapping,
  archive bounds, undo across atlas switches, index invalidation and storage recovery.
- Production/type/property-contract and self-contained preview builds pass; the
  existing large-chunk warning remains.
- Edge Function frozen type/dependency check passes.
- `node --run test:backend`: 22 isolated local backend checks pass, including snapshot CAS/retry,
  concurrent writers, denied direct writes/RPC, viewer/editor boundaries, revocation
  and malformed workspace rejection. The local sandbox needed temporary loopback
  proxy bypasses and the authoritative system certificate bundle, with TLS
  verification retained. These are test-environment adaptations, not app changes.
- No browser suite or new performance trace was run; user acceptance remains pending.
- Hosted migration/function deployment was not performed.
