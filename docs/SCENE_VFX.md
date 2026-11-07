# Scene image effects and audio response

Open **Scene → Scene effects** and apply an image through the existing scene
workflow. **Audio Light makes image regions near the picked colour pulse as
coloured light sources, with a soft surrounding glow.** This replaces the
saturation-only revision, which could not emit light. It also replaces unbounded
additive gain, which washed the image out to white.

## Saved controls

| Field | Control | Default | Bounds |
| --- | --- | --- | --- |
| audioLight | Audio Light: colour-range target | `#aa3300`, estimated screenshot orange | RGB colour |
| audioBounce | Audio Bounce: maximum zoom multiplier | 1.12 | 1–1.5 |
| waves | Waves | true | On/off |
| distortion | Distortion | 0.4 | 0–1 |
| glitching | Glitching | 0.3 | 0–1 |
| maxFps | Max FPS | 120 | 60–1000, whole frames/sec |
| lightAllColors | All colours | false | On/off; each source hue reacts independently |

`normalizeSceneVfx` and `serializeSceneVfx` whitelist these six fields plus the
13 numeric light-tuning fields below and the saved **All colours** toggle. The FPS
control was explicitly added after the original five-field screenshot request.
The existing property registry, Color picker, numeric controls, settings history,
MC and save/export mechanisms remain the owners. Old five-field saves acquire
maxFps 120; five/six-field saves acquire the current light-tuning defaults without changing
their existing choices. Explicit zero/off values survive. No audio files, source handles,
permissions, spectra, playback position or hidden shader variables serialize.

## Light tuning

Open **Scene → Scene effects → Light tuning** (initially collapsed). These are the
actual shader/audio parameters previously fixed in code. Changes apply live and
use existing settings save/reload, Undo/Redo and workspace/UI-template exports.
The pictured values are now defaults for missing settings; existing explicit tuning is preserved.
The light model stays the same; this exposes its parameters rather than adding a
new additive-light algorithm. No new browser test was run for these controls.

| Saved field | Control | Default | Range / meaning |
| --- | --- | --- | --- |
| lightCoreStrength | Core strength | 8 | 0–8; contribution at matching source pixels |
| lightNearStrength | Near glow strength | 8 | 0–8; tight halo contribution |
| lightFarStrength | Far glow strength | 1 | 0–8; broad halo contribution |
| lightNearRadius | Near glow radius (%) | 0.2 | 0–5; blur sampling radius as % of image long edge |
| lightFarRadius | Far glow radius (%) | 0 | 0–10; additional broad blur radius as % of image long edge |
| lightGain | Light gain | 12 | 0–12; how quickly the colour blend grows toward its maximum |
| lightMix | Maximum colour mix | 0.12 | 0–1; peak replacement with the selected bright tint; 0 disables light |
| lightTintSaturation | Light saturation | 2 | 0–2; multiplier of picked colour saturation; 0 gives white light, 1 uses picked saturation, result capped at full saturation |
| lightHueInner | Full colour range (°) | 180 | 0–180; hue distance receiving full matching weight |
| lightHueOuter | Outer colour range (°) | 0 | 0–180; hue distance where matching fades to zero |
| lightSourcePower | Bright-source emphasis | 2.78 | 0.25–8; higher values favour bright sources, lower values include darker ones |
| lightAudioGain | Audio sensitivity | 8 | 0–8; multiplier before the bounded audio pulse |
| lightAudioPower | Audio response curve | 8 | 0.25–8; lower values make quiet input more responsive, higher values favour peaks |

Hue thresholds are interpreted smaller → larger even if entered in reverse; equal
values use a tiny nonzero feather to avoid undefined smoothstep behavior. Radii
change sampling distance, not GPU buffer allocation. Zero far radius means no
additional broad blur; the far-strength contribution still uses the near mask. Editing hue thresholds,
source emphasis or radii regenerates the cached spatial mask; intensity, mix,
saturation and audio curve edits reuse it. GPU work remains bounded at 512 pixels
on the long edge. Large radii can show soft/banded halos at this resolution.

To experiment: set **Audio Bounce 1** to hold framing; set **Core strength 0** to
isolate glow; increase **Far glow strength/radius** to explore outward light. Set
**Light saturation 1** for picked colour purity. Raise **Light gain** for a stronger
response or lower **Audio response curve** for quiet music. Setting maximum colour
mix or all three strengths to 0 switches off the colour effect; settings are kept.
These controls still tune a bounded colour blend, so they do not create physically
additive scene lighting. Raising maximum mix toward 1 can erase source detail.

The serializer now contains exactly 20 whitelisted fields. Audio files, permissions,
media/session handles and cached GPU masks remain excluded. Older six-field clients can drop the 13 numeric tunings and All colours;
the preceding 19-field clients can drop All colours when resaving; export your
settings from this revision before experimenting in an older preview. Original
image bytes/assignments stay intact.

## All colours

Click **Scene → Scene effects → All colours**, beside Audio Light. On enables
response from every source colour instead of the selected hue range: reds pulse
red, blues blue, yellows yellow, and neutral highlights stay neutral. Core colours
and cached RGB halos derive from the image, not a single globally applied tint.
Neighbouring colours can blend where their halos overlap. Source emphasis, audio
curve, core/glow strengths, radii, mix and saturation still apply. The selected
colour and hue-range controls are retained for switching back to selective mode.
All colours defaults off and uses the shared toggle/property, history and exports.

The same four bounded GPU targets and five preparation draws are reused. Mode
changes regenerate RGB masks; playback reuses them. There is no new per-frame
blur or CPU pixel readback. Silence restores the image in both modes. This is
still the bounded blend model, not physical relighting of world objects.

## Coloured light response

The picked colour selects a broad, feathered hue family across the colour wheel.
Brighter matching pixels supply stronger emission; dark pixels supply less.
Yellow/gold regions pulse with yellow light when yellow is selected, blue regions
with blue light when blue is selected, and likewise for other colours. A neutral
colour selection instead follows neutral highlights. All colours bypasses this
selection rule and uses each image region’s own colour. The glow reaches nearby
pixels, even if those neighbours are outside the selected hue family. Distant
unrelated regions stay unchanged. Silence restores the source image.

Audio increases core brightness and adds a soft near/far halo around the matching
regions. Core and halo blend toward the selected hue and saturation at full value,
using one bounded display-space blend rather than independent RGB addition and
clipping. At the default maximum colour mix, at least 88% of the source remains at a peak;
the user can now change that limit. Saturation supports this
coloured-light appearance; hue/value are no longer held fixed. Fully saturated
dim pixels can now brighten. Already bright, pure pixels have less headroom.
This is a bounded light approximation, not physical HDR light transport.

The spatial glow is extracted and blurred on the GPU only when the image,
selected hue/saturation, activation mode or spatial tuning changes, using the existing 512-pixel bloom-edge budget.
Audio frames sample two cached masks and vary intensity; they never repeat the
blur or read back image pixels. Masks follow the image's cover/bounce/wave/VHS UVs,
so the glow remains registered to the image. Radiance is composited inside the
wallpaper shader before the normal output pipeline, behind world content.
The wallpaper stays black in the shared additive glow mask, avoiding a second
bloom addition that could whiten its colour. Other world/UI glow is unchanged.

For a useful colour-only comparison, set **Audio Bounce to 1** temporarily so its
zoom does not change which parts of the image are in the frame. Waves and VHS
remain approximations until the original effect implementations are supplied.
The extract's script strings are reference data and are never executed. Snow and
other unpictured controls are excluded.

## Audio sources and lifetime

Use **Scene → Scene effects → Choose audio file → Play audio**. The website plays
that file and analyses the same media element directly through WebAudio. The
native player's Play/Pause/seek/volume controls remain available. There is no tab,
screen, system-audio or microphone capture implementation and no sharing picker
or Chrome sharing indicator started by this version. Music in other apps/tabs
is not an input. A native audio bridge would be a separate, unimplemented feature.
Files are temporary local playback, not uploaded or persisted.

The former **Connect shared audio** action is now **Play audio**, retaining action
ID `scene.audioConnect` so saved bindings/residents remain usable. The former
**Disconnect audio** is now **Stop audio**, retaining `scene.audioDisconnect`.
Play without a file asks for a file in the existing status text. Playback still
requires a user gesture under native autoplay policy; no sharing permission.

The readonly **Audio input** meter shows what reaches the analyser. “No audio
connected” means no active source; a zero meter can mean paused/silent playback.
Quiet RMS is noise-gated/mapped into the existing response curve. Bass approximates
31–65 Hz for zoom; broadband RMS drives the coloured flash.

The app owns the player, object URL, analysis graph and hidden media parking host.
Closing/reparenting controls preserves playback/analysis; reopening reuses the
player. **Stop audio** or scene-renderer teardown pauses and releases analysis.
Stop keeps the selected file ready; Play reconnects via a fresh media element,
since WebAudio cannot attach a new source to a previously connected element.
Repeated Play/resume reuses an active source instead of duplicating it.

Captures already started by older preview tabs are owned by those older pages.
Close those preview tabs or stop their existing shares in Chrome. This version
cannot cancel another page's capture, and never starts a new one.

## Rendering and limits

One existing background shader handles cover sampling, coloured light, wave UV
movement and shared VHS distortion/tracking. Original image bytes, assignments,
atlas geometry and camera are unchanged. There is no per-frame image decode,
geometry refresh, settings write or React audio update. FFT buffers are reused;
the input meter updates its DOM at 10 Hz. Max FPS follows the display animation
clock, retains phase on fast displays and discards missed-frame debt. Actual
output is limited by display refresh and rendering capacity. Existing resolution
budgets, reduced-motion and hidden-tab suspension remain.

Wave scale/speed/strength and VHS internals remain fixed approximate values from
the extract. Original shaders, exact blend/frequency mapping and exact screenshot
orange were unavailable. This is not a pixel-identical Wallpaper Engine port.

## Verification status

Model checks cover settings defaults/serialization, historical saves, shared
setters, direct playback lifecycle, quiet signal/silence, resume/reconnect and FPS
pacing. Local model/type/build/backend success does not establish appearance.

Earlier user-approved browser checks established audio pickup and some limited
brightness/shadow cases. The user rejected those visual results. Neither those
checks nor the saturation-only test establishes this revision's appearance.
The prepared opt-in `tests/scene-light-emission.browser.mjs` checks matching core
brightness, coloured halos beyond source boundaries, yellow/orange/blue/green/pink,
neutral selection, distant regions, intensity and silence through the complete
bloom/output path. **It has not been run; no fresh browser approval was received.**
Model regressions cover historical six-field settings, all 13 shared setters,
serialization, bounds, explicit zero values and round trips. A model regression covers cached GPU work, bounded buffers, renderer-state
restoration after success/failure and resource release; it does not execute GLSL.
Actual image appearance and interactive performance remain user acceptance.


The default update and All colours have not had a browser run. Model regressions
check the screenshot defaults, preservation of earlier 19-field explicit tuning,
mode toggling/round trips, retained selective colour and cache invalidation/reuse.
The prepared emission browser check includes multi-hue All colours coverage; it
remains opt-in and unrun for this revision.


The capture-free revision has no fresh browser run. Model checks verify direct
media → analyser → speaker routing, zero capture API requests, idempotent resume,
Play/Stop/replay, view subscription retention and disposal. A source-boundary check
rejects capture APIs in the scene-audio module. The prepared browser audio script
uses Play audio and fails if any tab/screen/microphone capture is requested.
