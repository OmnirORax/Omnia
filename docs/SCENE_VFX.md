# Scene image effects and audio response

Open **Scene → Scene effects** and apply an image through the existing scene
workflow. Audio Light now means **audio-driven saturation in a selected hue range**.
The user rejected the earlier brightness/bloom model because it washed colours
out to white. There is no Audio Light exposure gain or audio-driven bloom.

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

## Saturation response

The picked colour selects a broad, feathered hue family across the colour wheel.
Audio drives saturation toward full colour purity in that family. Processing uses
visible sRGB/HSV: hue and HSV value (the maximum colour channel) stay fixed while
saturation increases. Already fully saturated pixels remain unchanged, as do
neutral greys/white and distant hue families. Silence preserves the source pixels.
Increasing saturation removes neutral components; perceived luminance can decrease
even though the peak channel value stays fixed. This is a colour-purity adjustment,
not a brightness/exposure operation.

The selected hue is prepared when settings change. The shader converts the source
into display colour space for saturation and back into linear working space for
the normal output pipeline. Audio Light contributes black to the shared glow mask;
it never adds a white/coloured halo. Other world/UI glow retains its existing owner.

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
Bass approximates the 31–65 Hz band for zoom; broadband RMS drives saturation.

The app owns audio, media URLs and a hidden media parking host. Closing/reparenting
controls preserves playback/analysis; reopening reuses the player. **Disconnect
audio**, ending a share or scene-renderer teardown releases the connection.
Explicit stop/reconnect uses a fresh media element because WebAudio cannot attach
a second source node to a previously connected element. Late/cancelled capture or
old media events cannot replace the current source. Files are neither saved nor
uploaded; native browser permissions and autoplay policy remain authoritative.

## Rendering and limits

One existing background shader handles cover sampling, saturation, wave UV
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
brightness/shadow cases. The user reported those visual results were wrong; they
do not validate this saturation revision. Obsolete brightness/halo assertions are
retired in favour of a prepared saturation contract: hue/value fixed, saturation
increased, no added light through bloom/output, distant hues unchanged and silence
restoring the source. **That new check has not been run; no fresh approval was
received.** Actual image appearance and Wallpaper Engine equivalence remain user
acceptance. No visual success is inferred from the local model/build checks.
