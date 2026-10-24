# AI music and wallpaper integration handoff

Read AGENTS.md and WORKER_ONBOARDING.md first. This brief records the starting
point and integration boundaries for an agent working independently on media.
It is not a completed feature specification or a backend implementation.

## Scope and current state

The user intends to add AI music and wallpaper generation. Providers, models,
hosting, credentials, persistence, playback controls and the first deliverable
have not been selected in this conversation. Responsive wallpapers were discussed;
static images/video first and an isolated reactive renderer were recommendations,
not an agreed requirement to implement a Wallpaper Engine clone.

The current integration includes the Supabase backend foundation described in
[BACKEND.md](BACKEND.md): Auth, workspace roles, private image storage, and a
server-side function boundary. The schema/function are hosted and public signup
is disabled. Website publication remains pending. The atlas itself still saves
locally. Existing "External AI proposal" accepts reviewed graph changesets; it is
not a model provider connection. Image/music generation, jobs, audio/video storage,
playback, and context-to-protocol bindings remain unimplemented.

Backend work was deferred in the earlier media conversation; the user subsequently
implemented and deployed the foundation in the backend task. Reuse the actual
backend contracts rather than assuming there is no service or building a parallel
identity/storage system. This does not settle the media feature specification.

Use a separate feature branch/PR from the latest agreed integration base. If
sharing an environment, commit before switching branches; a separate chat does
not isolate files. Reconcile shared action/property/state changes when merging.

## Performance is an integration constraint

The user still reports general UI lag. Recent fixes remove identifiable repeated
work, but smoothness has not been verified in the user's browser. A successful
build or model test is not evidence of spare CPU/GPU capacity.

- Generation and playback/rendering are separate lifecycles. Keep requests,
  progress and cancellation asynchronous and local to the feature. Avoid document
  or whole-app state updates for progress ticks, pointer samples and audio frames.
- Avoid expensive decoding/transforms on the interaction path. Use appropriate
  media decoding, background work or a remote service for expensive generation;
  do not assume in-browser inference is affordable on this app's current budget.
- A reactive wallpaper should consume bounded input snapshots in its renderer,
  not rerender the workspace through React on every frame. Stop/release its timers,
  subscriptions, audio nodes and GPU resources when replaced or disabled. Respect
  visibility and reduced-motion behavior. Account for concurrent blur, translucent
  windows, glow, scene rendering and background effects sharing GPU resources.
- Reject stale asynchronous completion: a cancelled/replaced request must not
  later change the current wallpaper, selection or playback. Surface errors without
  unmounting or blocking the workbench.
- Flag a substantially expensive proposed approach and offer a cheaper option
  before implementation. Quality limits/fallbacks need to be scoped with the actual
  renderer; no universal safe resolution, FPS or effect budget has been established.

Preserve these recently repaired shared paths:

- `useInterfaceState.ts` validates/normalizes changed branches only; layout-only
  edits preserve settings and appearance references. `appearance/session.ts`
  preserves unchanged settings references. Do not restore whole-settings
  normalization on every frame toggle or action.
- `UIWorkspace.tsx` shares the default-window projection for permission checks.
  `NativeActions.tsx` indexes ownership per layout snapshot and skips unchanged
  DOM writes. Do not reintroduce all-window copying once per discovered button,
  or repaint all buttons for an unrelated context-wrapper update.
- Search indexes hierarchy destinations instead of every target/property pair;
  global results are bounded and hover revelation has a cancellable dwell.
  New media controls must not recreate a combinatorial search catalog.

## Media storage and service boundary

Provider secrets belong on a server/service boundary when using privileged API
credentials. Vite client environment variables, bundled source, GitHack preview
HTML, UI templates and localStorage do not hide secrets from site visitors.
Static Pages/GitHack deployment does not supply a backend automatically. Keep a
provider integration separate from its chosen hosting and from the renderer;
document any new service's setup instead of assuming it already exists.

Existing resource formats are deliberately small and are not a general media
library:

- `src/graph/assets.ts`: embedded PNG/JPEG/WebP/SVG images or GLB, at most 900 KB
  per asset. Audio and video are unsupported.
- `src/graph/structural.ts`: the atlas has a 3.5 MB embedded-asset budget.
- `src/ui/layout.ts`: UI icon assets accept images only, also with a 3.5 MB total
  data-URL character budget. This is an icon store, not wallpaper/music storage.

Do not silently weaken these validators or put full songs, videos or repeated
base64 wallpaper copies into UI settings, render state, undo snapshots or templates.
Choose durable media storage/reference and export behavior for the actual task.
Blob/object URLs are temporary, need cleanup and cannot serve as durable saved
references. Provider download URLs may expire. Reuse an existing asset path only
when its supported format/size/ownership actually fits; otherwise define the new
resource contract and migration explicitly. Store media once and refer to it.

Generation completion, preview and applying an output are different actions.
Keep requests/progress/previews transient. Committing a chosen wallpaper or saved
configuration should use its proper state owner and shared history. Undoing that
application must not rerun a paid generation request. Generated media is
presentation/resource data, not automatically a canonical knowledge assertion.

## Shared app integration, even for a non-UI feature

New controls still inherit the existing app architecture:

- Commands use the shared action catalog and `useFeatureActions`; configurable
  shortcuts use universal Shift configuration. See FUNCTION_CONFIGURATION.md.
- Declare adjustable inputs with `*.function.ts` and reuse shared property IDs,
  independent consumer values and setters. Registration alone does not make a
  renderer support a property. See SHARED_PROPERTIES.md.
- Use existing frame/field/property components and compact layouts, not a second
  settings panel or shortcut system. See UI_COMPONENT_CONTRACT.md.
- Wallpaper surfaces should integrate with the existing workspace-background
  consumer/renderer where applicable. Inspect `appearance/registry.ts`,
  `sceneAppearance.ts`, `appearance/sceneFeedback.ts` and the Three.js scene setup.
  Do not assume a CSS backdrop and the 3D world background are the same layer.
- Preserve graph/UI/appearance ownership, draft Apply/discard and history behavior.
  New visual capabilities need an actual adapter to be editable/selectable; do not
  promise automatic visual editing merely because a control was discovered.

Follow the repo's verification instructions. The user performs browser interaction
checks; do not launch unsolicited browser suites. Keep static previews self-contained;
external generation services still require their own configuration and connectivity.
Update this brief when decisions are made, clearly separating implemented behavior
from plans and recommendations.
