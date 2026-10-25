# Scenes: manual generation and optional API connection

The normal workflow currently uses the user's ChatGPT subscription **outside**
Omnia. The saved prompt resolves one named input from the selected Omnium node.
Omnia copies that prompt, imports the returned image and remembers a static scene
per selected node. No API key, cloud login, cloud origin change or paid API request
is needed for this manual workflow. The existing OpenAI API path is retained in a
collapsed optional section and stays disabled until separately configured.

## Manual user flow

1. Open **Scene** and select an Omnium node. Edit the saved image prompt using a
   placeholder such as `{{subject}}`; choose label, notes, or both as its source.
2. Inspect **Resolved prompt**, then click **Copy resolved prompt**. Paste into
   ChatGPT and request an image there. The copy action saves the exact resolved
   text, template, binding and node snapshot in this browser.
3. Return to Scene. **Image belongs to** defaults to that copied prompt's node,
   even if another node is now selected. Choose **Active node** to override it.
4. Click **Paste image** (browser clipboard permission may be required), or save
   the image from ChatGPT and use **Choose image**. Copy the actual image rather
   than its link. File import is the fallback when image clipboard reading is
   unsupported or denied.
5. The image is saved in the browser library and assigned to the chosen node.
   Select that node to view its scene. Selecting another node restores its own
   saved scene, or the theme background if it has none. Selecting/deselecting
   does not persist edits, add history, upload anything or generate images.
6. **Imported images** can reapply an image to the active node, download its
   original bytes for backup/transfer, or permanently delete it. **Clear scene**
   unassigns only the active node's scene without deleting the image. Undo/Redo
   restores application/clear references without inference or byte copies.

The library and node assignments persist across reload in the same browser and
website origin; select a node again after reload to view its scene. They do not
sync to other preview addresses, production, devices or accounts. Atlas/UI export
files do not embed these images or assignments. Download originals for backup;
clearing site data removes them. A copied snapshot is a convenience, not proof the
imported image came from that prompt or ChatGPT.

Prompt input remains one named binding (its placeholder may repeat). There are no
visible wires or new canonical graph relationships. Unsupported/unconnected
placeholders are rejected; selection updates the resolved input without generation.
Prompt/variable/source reuse shared UI settings, discovered properties, Master
Controller, field drafts and history. Edits commit on field blur; Escape cancels.
New manual commands use the existing shared action/shortcut catalog.

## Optional API user flow

Expand **API generation (optional)**, sign in through Workspace settings → Cloud
connection and choose an authorized workspace. **Generate & apply** is available
only when the server reports enabled. Only the frozen selected-node text and saved
prompt are sent to the backend/provider. The ready private asset becomes the active
node's scene. Saved API results can be explicitly applied to the active node
without generating again. Existing backend permissions/quotas are unchanged.

## State and implementation boundaries

- Active node means the selected placement and its entity's label/notes. Camera
  focus/zoom is not a new semantic parent. Selection/import/revision, prompt,
  account/workspace and background changes prevent late automatic application.
- Settings store only prompt/binding configuration. `omnia.scene.copied-prompt.v1`
  stores the most recent copied snapshot. `omnia.scene.background.v2` stores a
  placement-ID → scene-reference map plus a no-selection fallback. Version-1 cloud
  backgrounds migrate to that fallback, without being copied onto every node.
  Node associations are browser-local presentation data: renaming/moving a node
  keeps them; importing a graph with the same placement IDs reuses them. There is
  no separate stable cloud/atlas identity or parent inheritance in this slice.
- `src/scene/library.ts` stores image Blobs once in IndexedDB
  `omnium-scene-library` with separate lightweight metadata for listing. Undo,
  settings and graph files never carry image bytes. Imports accept PNG/JPEG/WebP
  by signature, up to 10 MiB, 4096 px per side and 12 megapixels; encoded dimensions
  are checked before browser decode. Animated WebP is rejected. Library quotas
  are 100 images / 100 MiB, enforced in the write transaction. Failed imports
  preserve the previous assignment. No thumbnail or per-frame library decoding.
- A returned image uses an explicit copied-node or active-node destination,
  frozen before file/clipboard work. Removed destinations or intervening
  background changes leave the image in the library for explicit application.
  Imported metadata retains the prompt snapshot when one is available.
- Background application/clear uses `ui/actionHistory.ts`; selection itself
  does not. Explicit resource deletion confirms that bytes cannot be undone,
  clears all matching assignments and deletes the Blob/metadata. Undo cannot
  recover deleted resource bytes; download first if a backup is needed.
- Cloud images retain their user/asset references and authorized Storage downloads;
  signing out hides cloud images but does not erase local imported images. Local
  imports are browser data, not an account-private cloud store. Object URLs and
  Three.js textures are released when replaced; reference/account checks suppress
  stale display on navigation. Image bytes do not enter embedded atlas/icon stores.
- `src/scene/wallpaper.ts` draws one static screen-space texture in the existing
  Three.js scene with cover cropping, selection feedback and disposal. It is not
  pickable. Theme background remains the fallback; safe UI mode hides wallpaper.
  No animated inference, per-pointer scans or progress ticks in the app root.
- Scene assignment currently uses the selected placement, not semantic parent,
  camera focus or zoom. Ancestor defaults/inheritance, semantic environment/mood/
  scale rules, multiple bindings, image editing, music and animated scenes remain
  future work. Do not claim arbitrary reactive bindings or cloud atlas sync.

## Backend contract

After the user verified prompt binding and persistence in the private preview,
the additive migration and compatible backend function were deployed to the
existing Supabase project. Thirteen hosted checks passed, including disabled
scene readiness, workspace isolation and unauthorized generation rejection.
Temporary test identities/resources and the verification endpoint/secret were
removed. OpenAI credentials/enabling remain unconfigured; no paid request ran.
The exact PR preview origin still needs explicit CORS approval before testing
generation there; do not enable wildcard preview origins.

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

Original API-slice evidence: all 172 existing model checks and 21 backend
checks passed, including disabled readiness and generation gates. Frontend and
frozen Deno type checks, production build and self-contained preview build passed.
The production bundle retains its existing large-chunk warning. No automated
browser suite or real provider request was run, so rendering/perceived smoothness
and the paid provider round-trip remain user verification items.

Manual-import follow-up: all 188 existing model/architecture checks, production
build (including TypeScript/property checks) and self-contained preview build
passed. The existing large-chunk warning remains. The user performs clipboard/
file import, per-node restore, reload, clear/undo and image rendering checks. No
browser suite or actual image generation was run for this local flow. Backend
code, provider secrets, hosted settings and deployment workflows are unchanged.
