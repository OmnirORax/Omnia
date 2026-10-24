# Omnia backend architecture plan

Status: proposed architecture and implementation sequence; no backend implemented by this document.
Implementation update: the local foundation and initial hosted schema/function deployment are described in [BACKEND.md](BACKEND.md). Hosted public signup is disabled and verified; the website is published and its initial cloud/storage flow was manually verified by the user. Cloud atlas synchronization and other future stages remain proposals.
Prepared: 2026-10-24. Repository inspected at 98169540ef40128f2d37a09ca8679fc1b8a5e278.

Later implementation: frontend hosting now uses private Cloudflare Pages
([operations](CLOUDFLARE_DEPLOYMENT.md)). The first saved-prompt/active-node image
generation slice is described in [scene generation](SCENE_GENERATION.md); its
bounded attempt ledger does not implement the general durable worker proposed
below. Initial-checkout facts and recommendations in this plan are historical.

## 1. Purpose and scope

Build a reusable backend foundation for Omnia. Scene generation is deferred to a future feature agent; it is one consumer of this foundation, not the organizing principle of the entire backend.

The architectural direction supplied by the user distinguishes Omnium (structured knowledge), Omnic (its representation), and Omnia (the environment for experiencing, authoring, and developing it). Existing repository documents also use Omnium for the current spatial workbench. This plan preserves existing code names and formats; it does not silently rename the product or claim the long-term vision is implemented.

The destination is structured knowledge supporting multiple representations, personal exploration, reviewed contributions, AI assistance, learning, and coordinated work. The immediate deliverable is much smaller: authenticated ownership, persistent private resources, secure server operations, reproducible deployment, and clear extension contracts.

**Recommendation:** Supabase-managed PostgreSQL, Auth, Storage, and TypeScript Edge Functions. Keep the React/TypeScript frontend and GitHub Pages deployment. Use one repository and one backend project per deployed environment initially. Do not introduce microservices, a second backend platform, a graph database, or a general workflow engine now.

This is a proposed implementation plan, not authorization to purchase services, publish a deployment, change remote data, or rewrite the local atlas. Those actions remain subject to the user's instructions and available access.

## 2. Current facts that constrain the design

- The frontend is React, TypeScript, Three.js, and Vite Plus, using Node 24 and Yarn 4.18.1. There is no existing Supabase integration or backend in this checkout.
- The current version-2 atlas contract is in src/graph/structural.ts. Entities, compositions, typed relationships, placements, variants, investigative frames, and layout views already have separate roles.
- Entity IDs are strings, including legacy/imported IDs. They are not guaranteed to be UUIDs or globally unique across unrelated atlases.
- An atlas Document has a format version and local revision counter but no stable document ID. A revision can advance for presentation changes and undo/redo; it is not a cloud concurrency token or an epistemic acceptance status.
- App.tsx currently owns document edits, local history, import/export, and autosave to omnium.atlas.v2. The editor can work without a server.
- Existing AI changesets are validated against a local revision and reviewed by a human. They are not a complete public mutation API for every editor operation.
- Presentation assets currently embed data URLs. Their limits are 900 KB per asset and a 5 MB atlas import limit; these are not suitable defaults for large generated images/audio.
- Property coupling currently shares definitions and editing machinery while retaining independent values. It does not implement arbitrary reactive data bindings between graph fields and generator inputs.
- UI actions, editors, ownership, layout, appearance drafts, and transient selection already have shared contracts. Backend integration must use those contracts rather than introduce a parallel UI.

The user's supplied context is strategic direction. The repository and observed runtime are evidence of what exists. Keep those categories distinct in future status reports.

## 3. Architecture and responsibility boundaries

~~~mermaid
flowchart TD
  UI[React and Three.js interfaces] --> APP[Omnia application operations]
  APP --> DOMAIN[Domain rules and portable contracts]
  APP --> LOCAL[Existing local persistence]
  APP --> ADAPTER[Cloud adapter]
  ADAPTER --> AUTH[Supabase Auth]
  ADAPTER --> DATA[PostgreSQL APIs and scoped RPCs]
  ADAPTER --> STORAGE[Private asset storage]
  ADAPTER --> EDGE[Authenticated Edge Functions]
  DATA --> RLS[Database permissions and row policies]
  EDGE --> DATA
  EDGE --> STORAGE
  EDGE -. future .-> PROVIDERS[AI and other external providers]
  EDGE -. future .-> JOBS[Durable jobs and bounded workers]
~~~

| Layer | Responsibility | Boundary |
| --- | --- | --- |
| Domain | Identity, graph validation, operations, future acceptance/quest rules | No React, Supabase SDK, or provider dependencies |
| Application | Coordinate a user intent across repositories and services | No rendering assumptions; explicit authorization and failure outcomes |
| Adapters | Local persistence, Supabase queries, storage, external providers | Convert infrastructure-specific results into application contracts |
| Delivery | Browser controls, database API, RPCs, Edge handlers | Validate input and enforce the caller's authority |

Only introduce interfaces for capabilities actually implemented. Keep domain modules portable; isolate browser APIs and privileged credentials. Share runtime validation where compatible, with separate Node/Vite and Deno runtime configurations. Do not copy graph validation into an unrelated backend implementation or import the React application into an Edge Function.

Use Supabase's database/storage APIs with user-scoped authorization for straightforward reads and permitted writes. Use transaction-scoped PostgreSQL functions for atomic database operations, and Edge Functions for external services, secret-bearing requests, and orchestration. Do not proxy every read through an Edge Function merely to call it a backend.

## 4. Identity, ownership, and permissions

A user is an authenticated participant. A workspace is an access/ownership boundary for resources. An atlas is a document/model within a workspace. None of these is a canonical knowledge entity or an investigative frame.

Begin with private, invite-only access and one operational owner. The foundation may support additional workspace memberships for isolation validation and later invitations without building a public registration or invitation product.

Use workspace membership as the common permission source. Proposed capabilities:

| Role | Initial meaning |
| --- | --- |
| Owner | Manage their workspace and its resources; manage membership through a guarded operation |
| Editor | Read and modify ordinary workspace resources; no ownership or membership escalation |
| Viewer | Read resources shared within that workspace; no writes or paid generation by default |

Only an owner can delegate membership. Creation atomically inserts the workspace and its initial owner membership. Ownership transfer/removal is a dedicated transaction; never leave a workspace without an owner. Direct API requests cannot self-assign a higher role. A user's supplied owner_id, email, or editable auth metadata is not proof of authority.

Platform operations such as deployments and credential administration are separate from workspace roles. Owning a workspace does not confer database administrator privileges or GitHub write access.

Enable row-level security on exposed tables, restrict table/function grants explicitly, and apply storage policies too. Deny unauthorized access by default. Scope membership helpers to avoid recursive policies, fix search paths for privileged SQL functions, and restrict their execution grants. Review views as well as tables for unintended policy bypass. Index membership and resource-scope lookups.

Normal user requests should retain the user's database authority. Use elevated server credentials only for narrowly defined privileged operations, with explicit caller checks first. A server-side secret bypassing row policies does not replace authorization.

## 5. Minimal foundation data model

The first migrations should implement only the resources exercised by the foundation:

| Resource | Essential information |
| --- | --- |
| Workspace | UUID, name, lifecycle timestamps |
| Workspace membership | Workspace UUID, auth user UUID, role; unique membership and indexed access checks |
| Asset record | UUID, workspace, creator, storage object key, media type, byte size, lifecycle state, timestamps |

Use Supabase Auth for identity. Add a profile table only when an actual user-facing field needs it; do not duplicate auth credentials or an entire identity system.

Asset bytes live in Storage. Metadata and permissions live in PostgreSQL. Object paths are immutable and scoped by workspace/resource IDs, not editable labels. A replacement creates a new object/version; it does not silently change bytes at an existing reference.

Object upload and a database transaction are not one atomic operation. Model the lifecycle explicitly: reserve a pending record, upload, validate/finalize, then expose a ready asset. Failures leave recoverable pending state, with bounded orphan cleanup. Deletion also needs a retryable lifecycle. Enforce type and size restrictions in the storage/server boundary, not just browser controls; start with a narrow, useful file policy and extend it deliberately.

Keep buckets private initially. Generate time-limited download access after authorization; never store expiring signed URLs as durable references. Do not edit Supabase's storage metadata tables directly to upload/delete object bytes.

Atlas persistence, jobs, generation protocols, quests, mastery, evidence, and global canonical matching do not need speculative tables in the first migration. Their architectural contracts follow below.

## 6. Source of truth and a safe path to cloud graph data

**Foundation phase:** the current atlas remains local and authoritative for local editing. Adding login must not upload, replace, or merge it automatically. Cloud workspace/asset records are authoritative for those new cloud resources only. Signing out must not erase unrelated user-authored local atlases.

**First cloud-atlas feature:** explicitly register a cloud atlas and preserve the local source before upload. Assign a cloud atlas UUID and keep a local document identity/association outside the existing v2 payload until a deliberate format migration is needed. Imports default to a separate document identity; replacing an existing cloud atlas is an explicit choice. Importing the same labels or ID strings never silently merges canonical referents.

Start cloud persistence with validated v2 document snapshots and an independently generated server version. This gives a small migration path from the current app. It is not the final high-concurrency graph store. No second writable set of normalized graph tables should compete with those snapshots.

Distinguish these values:

- Format version: how to parse the document.
- Local document revision: the existing editor/changeset precondition.
- Cloud server version: concurrency token for an accepted cloud write.
- Acceptance status: epistemic/workflow state, introduced separately when needed.

A cloud write supplies the expected server version and a request identity. The server validates the payload, checks permissions, and atomically compares/advances the stored version. Reject stale writes; retain local drafts and expose an explicit reconcile/reload choice. No silent last-write-wins or automatic merge. Preserve the acknowledged server version separately from in-flight local edits so a delayed response cannot mark newer edits as saved. A retry with the same request identity must not duplicate a write.

For cloud-backed documents, the server is authoritative for acknowledged shared state; the local document is a draft/cache with an explicit saved/pending/conflicted state. A network outage must not silently switch a cloud document to a new independent master. Cross-account caches must be isolated and must not expose another user's private cloud data after logout.

**Later structured cloud graph:** when cross-atlas queries and fine-grained concurrent edits justify it, migrate authoritative data to relational entities, compositions, relationship types, participant rows, frames, and separate presentation/view resources. Preserve typed multi-participant relationships instead of forcing everything into binary edges. Keep current string IDs, qualified by atlas/namespace, until explicit global identity mappings exist.

At that transition, snapshots become exports/checkpoints or read projections derived from authoritative records. Perform a versioned, verified migration with a recovery path; do not maintain two independently editable truth stores. Separating semantic and view records is valuable, but splitting the current mixed v2 payload requires deliberate compatibility work.

## 7. Collective knowledge and personal exploration

A shared database is not automatically a shared accepted Omnium. Private/provisional exploration, reviewed proposals, and accepted collective knowledge need distinct permissions and lifecycles.

Future contribution services should build on stable identities, provenance, scoped revisions, and atomic acceptance operations. They must preserve the existing distinction between structural validity and epistemic truth. Current frame.promoted is not sufficient to publish collectively accepted knowledge.

Cross-workspace reference resolution must not leak private subjects. Global canonical matching needs an explicit process for identity resolution, aliases, merges, evidence, and disputed claims. Do not deduplicate by label, physical position, or imported ID collisions. These are future domain capabilities, not problems solved by choosing PostgreSQL.

Personal mastery, progression, achievements, quests, and rewards attach to appropriate participants and subjects without mutating shared facts merely because somebody viewed or completed an activity. Valuable score changes require server-validated rules; clients cannot award themselves points. Implement these policies when the corresponding feature is specified.

## 8. Server operations and contracts

Operations are named by domain intent, not arbitrary SQL or a generic execute-anything endpoint. Start with an authenticated workspace bootstrap operation that creates the workspace and owner membership atomically; use a narrowly scoped RPC and a thin Edge entry point where appropriate.

Every operation specifies input schema, authentication, authorization, transaction boundaries, result schema, and retry behavior. Mutating or billable operations use request identities where repeats can cause duplicate effects. Version wire contracts when incompatible changes occur; additive changes should not require every caller to update simultaneously.

Use a small common error vocabulary: unauthenticated, forbidden, invalid_input, not_found, conflict, rate_limited, dependency_unavailable, and internal_error. Include a request ID for diagnosis without exposing SQL internals, credentials, or private data. Not-found versus forbidden responses must not reveal inaccessible resources.

Enforce request limits, timeouts, and bounded pagination. Limit resource creation/uploads; later add billable-operation quotas before enabling paid generation. CORS restricts browser origins but is not an authorization mechanism. Validate tokens and permissions regardless of request origin.

## 9. Long-running work and external providers

Define the durable-job contract now; build its tables/runner when the first asynchronous feature needs them. Do not add an idle workflow platform to the foundation.

The future contract needs a scoped job ID, actor, operation/version, immutable input snapshot or authorized input references, request identity, state, attempt count, timestamps, provider request IDs, output references, and a safe failure result. States distinguish queued, running, succeeded, failed, and cancellation requests/outcomes. Keep non-sensitive operational events separate from private input payloads.

Use atomic claims with leases and bounded retries. Workers must recover after process death. Assume at-least-once delivery; design side effects to tolerate duplicates. A browser refresh, disconnect, or expired session must not be the only place a job exists. Revalidate relevant authorization before executing delayed effects; define what revocation and deletion mean for queued/running work.

Supabase Edge Functions are suitable for request handling and bounded network orchestration. Background waitUntil extends work beyond a response but is still subject to runtime limits and is not a durable queue. Use a PostgreSQL-backed queue and bounded worker invocations when needed; a genuinely long/heavy workload can later use a separate worker without changing the browser's job contract. Do not choose that additional provider until a workload demonstrates the need.

Prefer provider asynchronous job APIs and authenticated callbacks or bounded polling where supported. Record submission IDs and reconcile ambiguous failures before resubmitting a paid request. Application idempotency alone cannot guarantee exactly-once billing at an external provider. Cancellation does not promise a refund or that external computation stopped.

Image, music, and other providers implement their own adapters and capability declarations. Do not assume every provider supports image editing, seeds, streaming, or asynchronous requests. Credentials stay server-side. Restrict downloads to intended provider routes and validate returned objects rather than offering an unrestricted URL-fetch proxy.

## 10. Contracts for future feature agents

| Future feature | Reuses | Adds when implemented |
| --- | --- | --- |
| Scenes and music | Identity, workspace access, storage, server boundary | Context targets, protocol versions, generation jobs/provider adapters, explicit application of results |
| Cloud atlas | Workspace access, portable graph validation, contracts | Atlas identity, snapshots, concurrency handling, explicit upload/download UI |
| AI knowledge assistance | Authorized graph access, server operations, jobs | Scoped retrieval, structured proposals and acceptance rules; no unrestricted model writes |
| Collaboration | Membership, authoritative versions, transactions | Realtime channels, presence, conflict/merge rules, collaborative undo |
| Quests/progression | Participant identity, permissions, domain operations | Quest dependencies, validated completion/contribution events and reward rules |
| GitHub publishing | Server secret handling, operations, later jobs | Narrowly permissioned GitHub App and explicit publication intent |
| Simulation/Omnic | Portable contracts, scoped knowledge access | Separately specified language/runtime capabilities and suitable compute |

For scene/music specifically, shared property definitions remain the existing controller's responsibility. Resolving a graph context into protocol inputs is an explicit new data-binding capability, not something current coupling already supplies. Generation records should capture the resolved inputs, protocol version, source scope/version, and previous asset references. Context targets must distinguish entity, placement, and investigative frame; this plan does not settle the future visual scale/inheritance design.

Realtime is notification/presence transport, not a transaction, merge algorithm, or evidence of accepted knowledge. Never introduce broadcast messages as a second authoritative write path. Subscribe only to authorized scopes, recover missed events by reading durable versions, and keep selection/hover ephemeral. Use server-checked commands before collaborative writes; choose a collaboration algorithm when editing requirements are concrete.

GitHub remains the code/schema/deployment source. It is not the live database for accounts, workspaces, scenes, or quests. A GitHub App is only needed if a later feature actually publishes or synchronizes repository content.

## 11. Repository layout and agent coordination

Proposed additions, adjusted to actual implementation needs:

- supabase/config.toml: reproducible local configuration and explicit auth/feature settings.
- supabase/migrations/: ordered SQL for schema, policies, buckets, functions, and grants.
- supabase/functions/: thin TypeScript handlers, with separate runtime configuration and pinned imports.
- shared/backend/: only contracts/validators actually shared by browser and server; no credentials or platform-specific imports.
- src/backend/: optional frontend configuration, session integration, and Supabase adapters behind application operations.
- docs/BACKEND.md: operational guide, contract map, extension recipe, validation evidence, and known limitations once implemented.
- An ignored local environment file and a committed example containing placeholders only.

Keep the current repository rather than introducing worktrees, a monorepo tool, or extracting every existing graph file into a new package. Make the minimum extraction required for genuinely shared logic. Runtime import resolution must be verified in both frontend builds and Edge tooling.

Future agents read AGENTS.md, the worker map, the backend guide, and the affected feature contract. Implementation should add concise links to those entry documents and update the status map. This proposed plan is not itself an implemented API reference.

Each feature owns its domain modules and adds migrations/tests/docs for its own requirements. Coordinate changes to membership policies, shared wire contracts, existing migration ordering, storage rules, and domain identity rather than implementing parallel versions. Published migrations are immutable; add a new migration. Rebase and check migration ordering before integration. Schema deployment must remain compatible with older clients and functions during rollout.

Handoffs record schema/contract versions, relevant commit, files changed, setup commands, checks actually run, local versus hosted results, secret requirement names, and external blockers. Secrets and private payloads never belong in a handoff.

## 12. Local development, hosting, and operations

Use the Supabase CLI with Docker for reproducible local database/Auth/Storage/Edge development. Pin the CLI and server imports. Keep frontend Node 24/Yarn 4.18.1; Edge code uses Supabase's Deno runtime and its own config/checks. Inspect resource needs before pulling the local stack. Use synthetic local users/data only.

The frontend remains usable with no backend configuration. Missing configuration means local mode, with cloud controls unavailable and clearly explained; a configured but failing backend is an error, not silent fallback. Browser configuration contains only the project URL and publishable key. The key's public nature is expected; actual access is controlled by sessions, grants, and policies. Elevated database keys, provider keys, GitHub credentials, and deployment tokens never use VITE_ variables or enter a frontend build.

Start hosted use with a development project; isolate production before inviting real users or storing important collective data. Region and paid plan selection require the owner's operational choice. Set allowed auth redirect URLs and CORS origins deliberately. GitHub Pages uses a repository path, but its origin is the host without that path. Avoid callback routes that require unsupported server routing. Untrusted preview hosts should not automatically gain production authentication redirects or secret access.

Keep application, database, and storage backups/export paths explicit. Database backups do not by themselves preserve all object bytes. Define restore procedures, asset integrity checks, deletion/retention rules, and expected recovery coverage before treating hosted storage as the only copy of important data. Retain the current portable JSON export. Large media will need an explicit future export manifest/package; do not raise the atlas limit or replace embedded assets silently.

Use request IDs and structured error/state logs without credential values or full private documents/prompts. Separate user-visible errors from operator detail. Observe storage growth, failed operations, and later job/provider usage; set hard limits for paid features. Snapshot prompts for reproducibility do not imply a model can reproduce identical outputs.

Deploy migrations, functions, and frontend as separate compatible steps: additive schema first, compatible functions next, frontend last; remove old contracts only after consumers migrate. Use an explicit destructive-change procedure. Do not reset a hosted database to undo an application deployment. Keep backend CI separate from the existing Pages workflow initially, with deployment credentials scoped to the intended environment and no deployment secrets in untrusted pull-request jobs.

## 13. Implementation sequence and readiness gates

| Stage | Deliverable | Evidence before calling it complete |
| --- | --- | --- |
| 0. Architecture | This plan and an explicit first-slice scope | Known facts, assumptions, deferred decisions, and external prerequisites distinguished |
| 1. Reproducible local stack | Pinned tooling, config, migrations, safe examples | Fresh local initialization/reset reconstructs the intended schema and policy state |
| 2. Ownership and server operation | Auth, workspaces/memberships, guarded atomic workspace creation | Valid user can create/read their workspace; missing/invalid auth and role escalation are denied |
| 3. Private resources | Storage policies, metadata lifecycle, user-scoped access | Upload/read/delete round trip; second user cannot list/read/write the first user's resources; failed uploads remain recoverable |
| 4. Optional frontend connection | Minimal sign-in/cloud connection through existing UI contracts | Local-only workflow preserved; connection state/errors are explicit; reload and session boundaries behave correctly |
| 5. Hosted verification and handoff | Configured development project, deployed policies/functions, operations guide | Same authorized and denied operations verified remotely; no private keys in bundles; deployment and recovery limits documented |

The first product-independent proof is: sign in, create a private workspace, upload/retrieve/delete a small permitted resource, and verify another identity is denied. This exercises the foundation without building art generation, a quest system, or migrating the user's atlas.

Do not call the backend implemented merely because configuration files exist. Distinguish local implementation, local checks, hosted deployment, and hosted verification. Hosted access may be an external blocker while local work is still useful.

Validation should cover migrations, database/storage authorization with multiple identities, transaction failure behavior, server input/error handling, and frontend/build compatibility. Use existing checks where applicable; never substitute a health endpoint for permission validation. Repository policy currently reserves interaction testing for the user and prohibits extra tests without a request. This plan specifies proposed readiness evidence, not authorization to add/run extra suites now; follow that policy when implementation begins. No tests or application builds were run for this documentation-only plan.

## 14. Decisions intentionally left open

- Actual Supabase project, owner access, region, and billing tier; no paid provisioning assumed.
- Exact initial authentication method and trusted deployed callback origin. Recommendation: invite-only single-owner access first, then deliberate expansion.
- Global canonical identity reconciliation, epistemic acceptance governance, evidence model, and knowledge licensing.
- When cloud atlas snapshots become necessary, and when measured needs justify normalized graph storage.
- Collaboration/merge algorithm and its interaction with local undo.
- Job execution/provider choices once a concrete asynchronous workload exists.
- Scene inheritance/scale rules, music providers, Omnic grammar, simulations, quest/reward design, and full OmnOS architecture.

These are feature or operational decisions; they do not prevent local ownership/storage foundations. Revisit them at the point they become requirements rather than silently embedding assumptions in the foundation.

## 15. Source notes

Repository sources: AGENTS.md; docs/WORKER_ONBOARDING.md; PROJECT_DIRECTION.md; src/App.tsx; src/graph/structural.ts; src/graph/changeset.ts; src/graph/assets.ts; src/properties/function.ts; docs/SHARED_PROPERTIES.md; .github/workflows/deploy-pages.yml.

The user supplied the broader knowledge/experience architecture and the proposed Supabase direction in this conversation. The scoped decisions here adapt that context to the inspected repository.

Supabase documentation checked through its official source repository on 2026-10-24 because direct docs-page requests returned HTTP 403:

- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security): table grants, policies, view behavior, and elevated-key boundaries.
- [Storage access control](https://supabase.com/docs/guides/storage/security/access-control): storage policies and service-key bypass.
- [Edge Function limits](https://supabase.com/docs/guides/functions/limits) and [background tasks](https://supabase.com/docs/guides/functions/background-tasks): bounded execution still applies after responding.
- [Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast): a transport capability, not an application conflict-resolution design.

Recheck platform limits, auth/key handling, deployment commands, and pinned tool versions during implementation. This plan deliberately avoids depending on a hard-coded current pricing tier or execution timeout.
