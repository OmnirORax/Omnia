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
- `src/scene/wallpaper.ts` loads the original texture and draws the wallpaper at
  the output resolution after graph-only post-processing. SpatialWorkspace uses
  separate graph/output pixel budgets: ordinary 2560×1440/1600 at DPR 1 is native,
  wallpaper output is capped at 8,294,400 pixels / DPR 2, and graph targets retain
  1.5 million pixels with existing glow limits. The wallpaper is excluded from the
  graph render/AA/glow passes; its final shader combines the image with the linear
  premultiplied graph layer and applies output colour conversion once. Cover crop,
  selection feedback and image disposal are retained. Theme remains the fallback;
  removing the image restores the original output budget. If offscreen composition
  fails, the existing direct renderer is the fallback at the selected output size,
  which may increase graph cost. Actual sharpness/performance await user testing.
  The canvas has CSS width/height 100%; physical pixel dimensions never determine
  its visible CSS size. Imports retain original accepted file bytes, with no resize
  or recompression. No new storage, per-pointer scans or app-root progress ticks.
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


## Selected image effects (2026-11-07)

The same screen-space wallpaper renderer now supports the pictured audio/VFX
controls and the requested Max FPS cap without changing image bytes or node assignments. See
[SCENE_VFX.md](SCENE_VFX.md) for defaults, permitted audio sources, shared settings,
reduced-motion/performance limits and the Wallpaper Engine approximation boundary.

## Non-destructive image normalization

Scene → **Image normalization** defaults on globally. It applies during local
Choose image/Paste image import and when viewing existing scene images. Originals
are committed to the existing library first and never rewritten; download still
returns the encoded source. The active world uses a disposable corrected PNG when
ready, or the original while processing/on failure. **Normalize scene images** switches
that same world between before/after without moving its camera or creating a
separate comparator. The enabled setting and
constraints use discovered settings inputs, existing settings persistence/history,
Master Controller and normal movable UIField/CoupledField controls.

Preferred ranges are soft constraints, not a filter preset or one image's histogram.
Current user-selected raw defaults are luminance minimum .10 / maximum 0, contrast
minimum .66 / maximum .02, saturation 1 / 1, neutral colour tolerance .30, maximum
exposure correction 1 EV, contrast/saturation correction .75 and neutral colour
correction .20. Crossed endpoints are kept as authored in controls and interpreted
as unordered pairs: effective luminance 0–.10, contrast .02–.66. Min/max bound one
acceptable interval: below it correction increases the metric, above it correction
decreases it, and inside it that constraint requests no change. These are not two
independent contrast effects. Limits can prevent reaching the requested interval;
remaining violations are reported. Explicit saved values still override defaults.
EV labels the bounded log-odds tone adjustment, not physical camera simulation.

A portable deterministic search evaluates small bounded corrections against
measured range violations plus an identity penalty. Already acceptable images
are unchanged. Colour balance uses only low-saturation midtone pixels, and needs
at least 2% neutral coverage plus 32 weighted samples; dominant artistic casts are
preserved without that evidence. Saturation/balance adjustments are searched only
when their respective output constraints are violated. Tone mapping preserves
black/white endpoints, neutral correction retains linear luminance, and chroma is
compressed to gamut instead of clipping channels. Quantization never introduces a
new 0/255 channel endpoint; alpha and fully transparent pixels are preserved.
Original clipping cannot be reconstructed. The worker remeasures its actual output
sample before lossless PNG encoding and reports remaining violations rather than
claiming success at the bounds. Metrics use up to 16,384 regularly sampled pixels;
protection applies to every transformed pixel, not just that sample. This is a
global correction, not semantic relighting, local dodging or style transfer.

Pixel correction runs in an inline worker, without a new dependency or render pass.
Existing 4096px/12MP limits apply. Decoding/canvas readback/PNG encoding still use
browser APIs and may cost time; no hardware performance claim is made. Constraint
or source changes cancel obsolete display work, close decoded bitmaps, terminate
workers and revoke derived URLs. Original/derivative display uses the existing
reference/account guard. The same actual texture feeds wallpaper and adaptive
sphere blending, so the latter samples the image being displayed.

Disposable local derivatives and reports use a separate IndexedDB cache keyed by
SHA-256 source bytes, algorithm version and all constraints. It retains at most
8 results / 32 MiB with LRU eviction; oversized derivatives work but are uncached.
Identity results cache only a report. Preference changes reprocess from the source,
not a previous derivative. Cache failure cannot reject an import or overwrite an
original. Source deletion purges its derivative keys before source removal; if
purging fails deletion reports failure and retains the original. Private cloud
scene derivatives stay transient and are not persisted in this cache. Settings
travel with existing settings/UI exports; scene bytes, references and cache remain
outside those exports. No backend schema/deployment or graph migration is needed.
Older clients may retain numeric/boolean unknown function values but do not apply
normalization. Cache version changes invalidate disposable results; originals
remain authoritative. Browser import/toggle/cache/visual/performance acceptance is
user-owned; model/build success does not establish it.

Live control correction: shared CoupledField/CoupledProperties now forward optional
transient preview candidates, and settingsAdapter validates them through the same
state adapters without writing settings/history. Active context bindings route
preview to the same owner as commits. Restoring the stored value cancels the
candidate; release clears preview and commits through the existing settings owner.
Normalization consumes that transient settings view. A serial latest-candidate
queue provides reduced 384px images during held drags without aborting every
pointer sample; a bounded eight-source sample cache keeps correction parameters
consistent with full-image analysis. These source samples and drag images stay in
memory; private samples are never persisted. Release generates the full image and
normal persistent cache entry. Live-preview output measurements are approximate
at preview resolution and labelled; the final image is remeasured normally. The
last same-source result stays on screen while processing/loading its replacement.
Scene/account identity changes and explicit clear still clear immediately. Keeping
or collapsing the settings section does not control scene refresh. No saved format
changes or new global input listeners are introduced.

Responsiveness follow-up: the user confirmed that the header click was incidental;
both metrics and image were delayed by processing. The focused built-app trace
showed worker processing followed by PNG encoding and image loading on the drag
path. Dragging now passes reduced canvases directly to the existing wallpaper
sampler (CanvasTexture, sRGB, matching orientation) and requests paint immediately.
Only committed full-size results use PNG encoding/persistent caching. Candidate
changes kick the serial latest-value queue directly; there is no polling interval.
A processor/worker is reused within the display editing session and disposed on
cancellation/source changes. Pixel metrics/transforms use scalar inner loops to
remove repeated arrays/callbacks; frozen fixtures retain pre-optimization byte
output. Existing source samples, correction equations, clipping guards, saved
settings and cache keys are unchanged. Source/account changes still clear prior
imagery; same-source updates retain it until a replacement is ready. These remove
concrete overhead, but user interactive latency acceptance and hardware performance
remain unverified after this change; model/build checks do not establish them.
Short drags also catch up with a small final frame before starting full-size PNG
work if no preview of the committed value arrived yet. This is still a transient
frame; settings commit normally and only the full result enters the saved cache.


## Full-resolution normalization display

The reduced 384px drag image was visibly blurry before the full image arrived.
Normalization now retains the original full-resolution texture through dragging,
release and on/off comparison. The shared wallpaper sampler applies correction
coefficients in GLSL using the CPU tone, neutral balance, gamut and quantization
equations; adaptive sphere blending samples the same corrected image. Updating
coefficients changes uniforms and requests paint without replacing/loading images.
The worker solves from the original bounded source sample during dragging; no small
image is generated, encoded, uploaded or substituted. Final CPU processing and PNG
caching remain on commit for verified output/reuse. The hook no longer creates URLs
for normalized derivatives; the existing original-background owner still owns URLs,
identity/account guards and deletion. Texture resolution and viewport pixel budgets
are unchanged. GPU floating-point and sampling can differ from CPU-cached output;
exact visual/pixel parity and GPU cost remain user browser acceptance. The user
chose to test the preview; no new browser suite/profiling was run for this path.
This supersedes reduced-image/canvas preview descriptions above. It changes display
implementation, not saved original bytes or constraint interpretation.

The redundant Preview original UI field and its transient app state are retired. Use Normalize scene images off/on for original/corrected comparison. Existing saved organization for scene.normalize.preview is retained by unavailable-ID compatibility; no normalization settings or image bytes are removed.


PR #58/#59 integration (2026-11-08): normalization now feeds the audio-capable
native wallpaper owner directly. Correction uniforms transform the original
full-resolution sample before the Low/High audio tint, without changing texture
identity/dimensions while dragging. Source replacement/clear retains normalization
ownership/correction reset and existing stale-load guards. The shared interface
preview owner supplies normalization candidates and the preview-vs-committed flag,
so drag samples stay outside settings/history and derivative-cache writes. The
user explicitly retired wallpaper-to-sphere blending; its old shared sphere
sampler is removed. Normalization, source originals, native output and audio
controls remain. No browser/GPU parity claim is inferred from the merge tests.

## Shared pattern paint

The current scene can feed a shared multicolour pattern for registered UI text,
contours and surfaces. The pattern owns the colour connection; consumers opt in
globally or through hierarchy use modes without copying colours. See
[Shared scene pattern paint](SCENE_PATTERN_PAINT.md) for controls, resting-tint
semantics, renderer limits and data ownership.
