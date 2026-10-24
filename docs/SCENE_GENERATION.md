# Scene generation: first connection

This feature implements the user's narrowed first step: a saved prompt box with
one input inherited from the active Omnium node, plus **Generate & apply**. There
are no visible wires and no new canonical graph nodes/relationships for a binding.

## User flow

Open **Scene** in the workbench sidebar. Select an Omnium node, edit the saved
image prompt, and use a placeholder such as `{{subject}}`. The variable name is
editable; its value comes from the active node's label, notes, or both. Expand
Resolved prompt to inspect the literal substitution. Unsupported/unconnected
placeholders are rejected. The first version has one named binding; its placeholder
may occur more than once. Node selection updates the input but never generates.

Sign in through Workspace settings → Cloud connection, choose the authorized
workspace in Scene, then press Generate & apply. Only the selected node text and
saved prompt snapshot are sent to the backend/provider, not the entire atlas.
The result is saved privately and applied behind the 3D workspace contents.
Clear scene restores the existing theme background. Undo/Redo restores references
without rerunning generation or deleting stored files. Saved results can be
reapplied explicitly without provider calls.

The prompt/variable/source use normal saved UI settings, property discovery,
Master Controller, field drafts and shared history. Their edits commit on field
blur; Escape cancels the field draft. Text is a bounded shared property kind,
not a second feature-specific setter/editor system.

## State and implementation boundaries

- Active node means the selected placement and its entity's label/notes. Camera
  focus/zoom is not a new semantic parent. Selection/import/revision, prompt,
  account/workspace and background changes prevent late automatic application.
- Settings store only the prompt and binding configuration. A separate local
  `omnia.scene.background.v1` record stores the current private asset reference
  and owning user ID. It contains no image bytes, tokens or provider key. Background
  changes register with `ui/actionHistory.ts` as appearance actions.
- On reload, authorized Storage download creates a temporary object URL. Account
  changes clear display; object URLs and Three.js textures are released when
  replaced. Generated files do not enter the tiny embedded atlas/icon stores.
- `src/scene/wallpaper.ts` draws one static screen-space texture in the existing
  Three.js scene with cover cropping. It reuses selector/hierarchy background
  feedback, is not pickable, and disposes GPU resources. Theme background remains
  the fallback; safe UI mode hides the wallpaper. No per-pointer scans, animated
  inference or progress updates in the app root are added.
- This slice remembers one applied background in this browser. Per-parent scene
  defaults, automatic context-to-saved-scene switching, atlas/cloud association,
  image editing, arbitrary environment/mood node fields, multiple bindings, music
  and animated scenes remain future work. Do not claim full cloud atlas sync or
  arbitrary reactive property bindings.

## Backend contract

At implementation handoff, the additive migration and updated function have been
validated locally; the hosted read-only plan reports the new migration pending.
Hosted secret metadata confirms neither the OpenAI key nor scene enable flag is
configured. No hosted scene rollout or real paid generation has been performed.

Migration `20261024000300_scene_generation.sql` adds `scene_generations` and a
service-only atomic claim RPC. Existing workspace membership and image storage
policies remain the authority. Members can read workspace attempts; only verified
owners/editors can submit. Ordinary clients cannot claim jobs or forge success.
The handler verifies Auth and workspace access before any privileged/provider call.
Current role is checked again when reserving/finalizing output.

`POST /functions/v1/backend`, operation `scene.generate`, accepts workspace/request
UUIDs, prompt, variable, source and a bounded node-text snapshot. It rejects
extra fields, including browser-supplied provider keys/models/user IDs. The body
limit remains 16 KiB, prompt 4,000 characters, notes 3,000, resolved text 12,000.
Label-only bindings omit notes from the submitted snapshot.

`scene.capabilities` takes a workspace UUID and returns an authenticated, role-aware
enabled flag without exposing secrets or making provider calls. The UI keeps
Generate & apply disabled until the server reports ready; Refresh scene status
reloads this readiness after setup changes.

The provider adapter calls the fixed OpenAI Images endpoint with one image,
landscape `1536x1024`, low quality, and WebP output. Default model is
`chatgpt-image-latest`; `OMNIA_SCENE_MODEL` is a server-only override for a compatible
GPT image model. The request shape was checked against OpenAI's official SDK
`src/resources/images.ts`. API access/billing are separate from a ChatGPT subscription.
No provider-returned URL is fetched; bounded base64 bytes must pass the existing
image signature/type/size checks before private asset finalization.

This is a **single bounded request plus a persisted attempt ledger**, not a durable
background worker/queue. OpenAI submission has a 90-second timeout and no automatic
retry. Atomic claims prevent repeated request identities from submitting twice.
Process death or a timeout can leave the outcome/billing uncertain. After three
minutes, the UI labels an unfinished attempt uncertain; a new paid attempt needs
explicit confirmation. Refresh/status reads never resubmit. Reloading can recover
the status/result for explicit application; it does not resume inference.

Submission guardrails: at most one recent running attempt per workspace; rolling
24-hour limits of five attempts per actor, ten per workspace, 25 globally, including
failed/uncertain attempts. Existing asset quotas also apply. This limits request
counts, not exact monetary spend. Configure provider project billing controls
before enabling. Cancellation/refunds/exactly-once external billing are not promised.

Failed storage may leave a normal pending asset linked to the attempt. Recover
or delete it through the existing Cloud connection asset lifecycle; do not delete
Storage metadata with SQL or delete attempt records to bypass submission quotas.

## Configuration and rollout

Generation is disabled unless the server has BOTH:

```text
OPENAI_API_KEY=<configure securely in Supabase Edge Function Secrets>
OMNIA_SCENE_GENERATION_ENABLED=true
```

Never use `VITE_OPENAI_API_KEY`, commit a credential or paste it in chat. Local
development may use an ignored server env file with `functions serve --env-file`.
CI uses no provider key and never spends API credit. Keep Cloudflare Access and
the exact backend origins intact; the browser calls the existing Supabase backend.

Deploy additive migration and compatible backend function before merging the
frontend, since `master` publishes automatically. `scripts/backend-hosted.mjs`
includes the new provider module in its deployment bundle. Do not reset existing
data, amend already-hosted migrations or change unrelated Auth/provider settings.
Keep generation disabled while doing schema/function rollout and permission
verification. After review, configure the secrets securely and perform one
user-initiated browser generation to verify the real provider/render path.

## Verification

Existing model/architecture checks, frontend/server type checks, production and
self-contained preview builds are required. Backend checks cover literal prompt
substitution, unknown/privileged input rejection, fixed provider route/output
validation, no automatic retry, role isolation, service-only mutation, idempotency
and submission guardrails. Provider responses in automated tests are local fakes;
they do not establish real OpenAI account access or image generation quality.
The user performs browser interaction checks; do not add/run browser suites
without a request. Check actual image rendering, reload, clear/undo, account
changes and navigation during generation. A build alone does not prove these.

Local implementation evidence: all 172 existing model checks and 21 backend
checks passed, including disabled readiness and generation gates. Frontend and
frozen Deno type checks, production build and self-contained preview build passed.
The production bundle retains its existing large-chunk warning. No automated
browser suite or real provider request was run, so rendering/perceived smoothness
and the paid provider round-trip remain user verification items.
