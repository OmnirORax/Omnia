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

`normalizeSceneVfx` and `serializeSceneVfx` whitelist these six fields. The FPS
control was explicitly added after the original five-field screenshot request.
The existing property registry, Color picker, numeric controls, settings history,
MC and save/export mechanisms remain the owners. Old five-field saves acquire
maxFps 120. Explicit zero/off values survive. No audio files, source handles,
permissions, spectra, playback position or hidden shader variables serialize.

## Coloured light response

The picked colour selects a broad, feathered hue family across the colour wheel.
Brighter matching pixels supply stronger emission; dark pixels supply less.
Yellow/gold regions pulse with yellow light when yellow is selected, blue regions
with blue light when blue is selected, and likewise for other colours. A neutral
colour selection instead follows neutral highlights. The glow reaches nearby
pixels, even if those neighbours are outside the selected hue family. Distant
unrelated regions stay unchanged. Silence restores the source image.

Audio increases core brightness and adds a soft near/far halo around the matching
regions. Core and halo blend toward the selected hue and saturation at full value,
using one bounded display-space blend rather than independent RGB addition and
clipping. At least 15% of the source remains at a peak. Saturation supports this
coloured-light appearance; hue/value are no longer held fixed. Fully saturated
dim pixels can now brighten. Already bright, pure pixels have less headroom.
This is a bounded light approximation, not physical HDR light transport.

The spatial glow is extracted and blurred on the GPU only when the image or
selected hue/saturation changes, using the existing 512-pixel bloom-edge budget.
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

**Choose audio file** creates temporary native website playback. Press Play to
allow browser audio. **Connect shared audio** opens the browser tab/screen picker;
select the music source and enable **Share tab audio**. Other websites cannot be
automatically listened to. System/desktop capture support depends on browser/OS;
there is no microphone fallback or captured-audio speaker echo.

The readonly **Audio input** meter shows what reaches the analyser. “No audio
connected” means there is no source. A connected stream with a zero meter can be
silent or missing music; this is distinct from an effect's visual response. Quiet
RMS is noise-gated/mapped into the response range before existing audio shaping.
Bass approximates the 31–65 Hz band for zoom; broadband RMS drives the coloured flash.

The app owns audio, media URLs and a hidden media parking host. Closing/reparenting
controls preserves playback/analysis; reopening reuses the player. **Disconnect
audio**, ending a share or scene-renderer teardown releases the connection.
Explicit stop/reconnect uses a fresh media element because WebAudio cannot attach
a second source node to a previously connected element. Late/cancelled capture or
old media events cannot replace the current source. Files are neither saved nor
uploaded; native browser permissions and autoplay policy remain authoritative.

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
setters, audio lifecycle, quiet signal/silence, no echo, resume/reconnect and FPS
pacing. Local model/type/build/backend success does not establish appearance.

Earlier user-approved browser checks established audio pickup and some limited
brightness/shadow cases. The user rejected those visual results. Neither those
checks nor the saturation-only test establishes this revision's appearance.
The prepared opt-in `tests/scene-light-emission.browser.mjs` checks matching core
brightness, coloured halos beyond source boundaries, yellow/orange/blue/green/pink,
neutral selection, distant regions, intensity and silence through the complete
bloom/output path. **It has not been run; no fresh browser approval was received.**
A model regression covers cached GPU work, bounded buffers, renderer-state
restoration after success/failure and resource release; it does not execute GLSL.
Actual image appearance and interactive performance remain user acceptance.
