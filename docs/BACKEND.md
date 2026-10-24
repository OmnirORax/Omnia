# Backend foundation

Implementation: Supabase PostgreSQL/Auth/Storage plus an authenticated TypeScript Edge Function. The core schema and backend function are deployed to project tqjjcabekjjmmspttbli. Public signup is disabled and verified through both administrative and public Auth settings. Publishing the changed frontend to the actual website is pending. The broader [architecture plan](BACKEND_ARCHITECTURE_PLAN.md) includes future systems that are not implemented here.

## What exists

- Private workspaces with owner, editor, and viewer roles.
- Atomic, idempotent workspace creation; owner-controlled membership for existing accounts.
- Private PNG/JPEG/WebP uploads, server-side signature/size/type validation, download, and retryable deletion.
- Database grants and row-level policies; no ordinary client can change membership or finalize a file by writing table rows.
- Optional frontend connection in Workspace settings → Cloud connection, using the existing shared UI section, fields, and action catalog.
- Local-only tooling and an isolated backend permission suite. No public signup, cloud atlas synchronization, AI generation, durable job runner, collaboration, quest system, or GitHub publishing integration.

The atlas still autosaves to the existing browser storage. Signing in creates no cloud copy. Cloud assets are a separate resource and are not inserted into the atlas or applied as backgrounds.

## Local setup

Prerequisites: Node 24, Yarn 4.18.1, and a working Docker daemon with sufficient space for the local Supabase images and volumes. The project pins Supabase CLI 2.122.0, Deno 2.9.6, and supabase-js 2.118.0. The CLI wrapper defaults to Supabase's smaller supported images and keeps CLI state in ignored .cache/supabase-cli without changing the user's home directory.

1. Install dependencies with yarn install --immutable.
2. Start the local stack with yarn backend:start. Its configuration is supabase/config.toml; migrations apply on a fresh database.
3. In another shell, run yarn backend:serve and keep that process running.
4. Run yarn backend:ready to wait for the handler, then yarn test:backend for functional permission validation.
5. Run yarn backend:configure once to create ignored .env.local containing the local public URL/key. It refuses to overwrite an existing file. Restart the frontend after changing this file.
6. Run yarn backend:local-user [email] to create a confirmed, local-only account. Its random password is saved in a mode-600 file under .cache, with the path reported by the helper. The helper never targets hosted Auth or resets an existing account.
7. Start the frontend with yarn dev, open Workspace settings → Cloud connection, and use that local account.

No credential values belong in source code, screenshots, CI logs, or handoffs. Supabase's own CLI status/start output can include local privileged credentials; avoid dumping it into reports. The local helpers capture status internally and report only outcomes.

Run yarn backend:stop to stop services while retaining local data. yarn backend:reset resets the LOCAL database and reapplies migrations; it is destructive to local backend records. It is not a hosted migration command. On an existing database, apply new migrations with yarn backend:cli migration up --local. Do not reset merely to deploy a feature.

Some cloud sandboxes inject proxies into containers. BusyBox health probes may send loopback HTTP through that proxy, and the Edge dependency loader may need the machine's trusted CA bundle. Diagnose these as environment issues: route only local health/internal service traffic directly, install the authoritative system trust bundle where required, and retain TLS verification. This prepared cloud instance has machine-specific helpers under /workspace/.tools; ordinary developers do not need them. See its saved environment startup instructions. Never use insecure certificate flags or claim an unhealthy stack is ready.

## Browser and server configuration

.env.example documents optional browser configuration:

- VITE_SUPABASE_URL: the project API origin.
- VITE_SUPABASE_PUBLISHABLE_KEY: a public publishable key, or the legacy anon key for compatibility. Secret/service keys are rejected by the browser adapter.

With both absent, the app remains local-only. A partial/invalid configuration is shown as an error. A configured but unavailable backend does not silently switch cloud resources into a second local authority.

Server settings are in supabase/functions/.env.example. Supply OMNIA_ALLOWED_ORIGINS as exact comma-separated origins when hosting. Defaults permit local development origins only. Auth is validated independently of CORS; scripts with no Origin still need a valid session. SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are injected by the platform for the handler. They never belong in VITE_ configuration. Local overrides can be passed with yarn backend:cli functions serve backend --env-file <ignored-file>.

The local configuration disables global and anonymous signup. The email provider remains enabled for existing accounts. Hosted provider/signup/redirect settings must be applied explicitly; a local config file is not proof of hosted settings. The initial UI uses password sign-in for pre-created accounts and does not handle email/OAuth callbacks. Hosted invitations and password setup are operational prerequisites, not an implemented account-management UI.

## Data and authorization contracts

Supabase Auth supplies user identity. public.workspaces is the ownership boundary; public.workspace_members defines roles. This is distinct from graph entities, atlas documents, frames, and UI containers. There is one owner per workspace in this first implementation; ownership transfer/workspace deletion are intentionally not exposed. This protects against orphaning data while those lifecycles are unspecified.

Only authenticated workspace members can read workspace records. Owner/editor can create and delete files; viewer can read ready files. Pending file bytes can be read only by their creator. The current UI lists up to 200 workspaces and 200 recent files; pagination beyond that is a future extension, not silently complete enumeration.

Private helpers avoid recursive membership policies and check the actual auth.uid(). Their schema is not exposed through the Data API. SQL definer functions have fixed search paths and explicit execution grants. Ordinary clients have SELECT grants only on foundation tables; mutations use guarded RPCs. Elevated handlers must first verify the session and user-scoped access, then use the elevated key only for the narrow operation that needs it. Raw frontend role checks are convenience, not security enforcement.

Workspace creation is capped at 25 per creator. Asset reservations are capped at 1,000 files and 500 MiB of reserved bytes per workspace, with a 10 MiB per-file storage limit. These are initial guardrails, not paid-generation billing controls. Extend limits deliberately when adding file types or workloads.

Role changes apply to new authorization checks without token renewal because membership is read from the database. Revocation cannot retract bytes already downloaded or invalidate all previously issued bearer download links immediately. The frontend uses authenticated downloads rather than persistent signed links. Never store expiring signed URLs as asset identity.

## Operation map

Portable contracts/validators live in supabase/functions/_shared/contracts.ts so both the Edge runtime and browser build can import the same file without runtime-specific dependencies. Server-only code stays in backend/index.ts. The Deno import and integrity lock are committed alongside that handler; Yarn separately locks browser/tooling dependencies.

POST /functions/v1/backend accepts:

| Operation | Input | Result |
| --- | --- | --- |
| workspace.create | name, requestId (UUID) | Workspace and requestId |
| asset.finalize | assetId (UUID) | Ready asset and requestId |
| asset.delete | assetId (UUID) | Deleted asset ID and requestId |

Send the user access token as Bearer authorization and the project's public key as apikey. The handler validates tokens with Auth itself; gateway verify_jwt is disabled for this handler to support its explicit verification, not to allow unauthenticated writes. JSON bodies are bounded to 16 KiB, unknown operation fields are rejected, and database/network calls have timeouts.

Error responses have an error object with code, message, and requestId. Codes distinguish unauthenticated, forbidden, invalid_input, not_found, conflict, rate_limited, dependency_unavailable, and internal_error. Responses do not expose SQL internals, tokens, or private input payloads. Logs contain request IDs and safe status/category fields.

The workspace creation requestId is an idempotency key scoped to its authenticated creator. Repeating it with the same name returns the same workspace; changing the name conflicts. It is not a cloud document revision.

User-scoped database RPCs:

- create_workspace: guarded atomic creation; also used by the Edge handler.
- set_workspace_member: owner-only grant/revoke editor/viewer membership for an existing Auth user UUID. Null role revokes. Cannot alter ownership. No public invite UI or account enumeration endpoint.
- reserve_asset: reserve a client-generated UUID, workspace, name, allowed media type, and byte size. Repeating an identical reservation is safe; changing its parameters conflicts.
- begin_asset_delete: validates current write access and moves the resource to deleting.

complete_asset and complete_asset_delete are executable only by the service role. Future agents must not broaden their grants to make a browser integration easier.

## File lifecycle and recovery

1. Reserve metadata through reserve_asset.
2. Upload the bytes to workspace-assets at the returned immutable object_key using the user's authorization. Arbitrary paths and upserts are denied.
3. Call asset.finalize. The server reads the reserved bytes with user-scoped access and checks actual size, response media type, and image signature before committing ready state. Signature checks are not full image decoding or malware scanning. SVG/HTML are not accepted.
4. Download ready files through authorized Storage requests. Neither source labels nor signed URLs identify the stored object.
5. asset.delete authorizes the caller, marks deleting, removes storage bytes, and removes the metadata after storage reports the object gone.

PostgreSQL and object storage are not one transaction. If upload/finalization fails, the pending record stays visible to its creator/editors; Finish pending upload can retry verification if bytes arrived. Otherwise delete the reservation. If deletion fails, the deleting record remains and Delete can retry. A completed deletion retried after its response was lost may return not_found; refresh the listing to confirm absence.

There is no automatic scheduled orphan sweeper in this foundation. Operators should inspect old pending/deleting resources and retry cleanup. Do not delete raw storage metadata with SQL: use the Storage API for object bytes. Before adding broad/public uploads, add the needed automated stale-resource cleanup and stronger abuse controls. Quotas and lifecycle policies must account for pending objects, failed transfers, and concurrent operations.

## Validation and CI

- yarn backend:check: frozen-lock Deno typecheck for server code.
- yarn test:backend: local-only contract and multi-account functional checks. Requires the stack and serving handler; fails rather than pretending a missing stack is a passing test. Creates synthetic accounts/resources and cleans them up.
- yarn test: existing model and architecture checks, including shared action integration.
- yarn typecheck and yarn build: frontend typecheck, property contracts, production output.
- yarn build:preview: the required self-contained preview output.

Browser interaction suites remain user-driven. Backend checks do not establish that the settings UI has been interactively tested. The user explicitly authorized adding/running backend permission checks for this task.

Local evidence on 2026-10-24: fresh database reset reapplied both migrations;
18 backend checks and all 141 existing model checks passed; frozen-lock Edge
typecheck, frontend typecheck, production build, and self-contained preview build
passed. The stack was stopped/restarted with data retained and the backend checks
passed again. Browser-style multipart upload is covered through the SDK's Blob
route. Frontend HTTP/module checks passed, but browser interaction was not tested.
Built frontend output was checked for absence of the local privileged keys.
That local validation preceded hosted deployment. The user subsequently created
the hosted project and authorized deployment with a project-scoped token.

The separate backend CI workflow uses a temporary local stack and synthetic identities, without hosted secrets or deployments. Existing Pages deployment remains intact. Do not add privileged deployment credentials to pull-request workflows.

## Hosted deployment and recovery

Hosted deployment is a separate step and needs a user-owned Supabase project. Local success does not establish hosted permissions, auth settings, or function configuration.

Hosted evidence on 2026-10-24: both migrations were committed atomically with
compatible migration history; backend was deployed ACTIVE through the Management
API; exact browser origins were configured. Ten hosted smoke checks passed:
synthetic sign-in, workspace creation, idempotency, workspace isolation, multipart
upload, server finalization, download, file isolation, viewer restrictions, and
deletion. Synthetic accounts, rows, files, verification function, and its challenge
secret were removed after the checks. No provider generation or paid provisioning
was enabled. Local development passwords do not sign into the hosted project.

The API currently requires BOTH auth_config_write and project_admin_write to PATCH
Auth settings. The narrowly scoped deployment token has insufficient project
permission for this route: the server returned 403 naming project_admin_write.
The user disabled "Allow new users to sign up" in Authentication → Sign In /
Providers. Fresh administrative GET /config/auth and public /auth/v1/settings
both confirmed disable_signup=true on 2026-10-24. Other authorized deployment work
was completed independently. No broader token was requested for this setting.

To connect the published website, set the PUBLIC GitHub repository Actions variables
VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the hosted project values.
The Pages build now reads those variables; deployment tokens and service keys must
never be supplied to that build. The code changes still need publishing through
the repository's normal review/merge flow. Environment snapshots do not push code
to GitHub or update Pages. If both variables are absent, the optional cloud controls
remain unconfigured and local editing still works. Create the actual owner's
hosted account through Supabase Authentication administration; local account
passwords are not hosted credentials, and smoke-test accounts are deleted.

For project-scoped/proxy-backed tokens, use the explicit Management API helper:
NODE_USE_ENV_PROXY=1 node scripts/backend-hosted.mjs plan <project-ref>, then the
same command with deploy. It requires the ref to match VITE_SUPABASE_URL, refuses
untracked existing application tables or changed migration contents, and records
applied SQL in supabase_migrations.schema_migrations. It does not reset existing
data. The CLI's legacy token validator rejected this scoped token even though
the API accepted it; do not replace it with a full-account legacy token.

NODE_USE_ENV_PROXY=1 node scripts/backend-hosted-verify.mjs <project-ref> explicitly
deploys a temporary, random-secret-protected verification function. Server-injected
credentials stay inside that function. It creates synthetic users/resources,
checks actual authenticated operations, and removes test resources, the function,
and its challenge secret. It requires Edge Functions and Edge Function Secrets
read/write plus the public frontend settings; no API-key-secret read permission
is needed. It refuses to overwrite existing verification resources. Treat any
cleanup failure as an operator action item; never report such a run as passed.

Before deployment, configure the intended region/plan and invite-only Auth settings; create the initial account through trusted administration. Store management/database credentials securely in deployment tooling, never in browser configuration. Review the actual CLI diff and migrations, then apply versioned migrations and deploy the backend function. Set exact permitted frontend origins, configure any account email/redirect requirements, and build the frontend with only the URL/public key. Re-run authorized and denied operations against the hosted environment before calling it ready.

Keep additive database migrations compatible with older clients/functions during rollout. Never amend a migration already applied to a shared environment. Current initial migrations may be revised only while this backend is local/unpublished. Keep database records and object bytes in the backup/restore procedure; a database-only backup is not a complete asset backup. Retain local atlas export as an independent recovery path.

## Extending this foundation

Read the architecture plan and affected domain contracts first. Add feature-owned migrations, adapters, checks, and documentation. Keep core logic independent of the SDK. Coordinate membership/security or shared wire changes rather than adding parallel authority paths.

Future scene/music agents add protocols, explicit data bindings, context targets, jobs, and provider adapters. Current property coupling does not already resolve graph fields into prompt variables. Future cloud atlas agents add atlas identity and server concurrency independently from the existing document revision. Future collaboration agents must define merging and shared undo; Realtime alone does not supply them. Shared accepted knowledge, evidence, canonical identity reconciliation, and quest/reward policies remain domain work.

Hand off actual implementation status, relevant migrations/contracts, verified commands, local versus hosted evidence, and outstanding limitations. Never mark a planned feature as available merely because it appears in the architecture plan.
