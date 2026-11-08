# Scene image effects and audio response

Open **Scene → Scene effects → Wallpaper Engine pulse**. This is now the only
light renderer; the Earlier approximation renderer, model selector and tuning
controls have been removed at the user's request. The supplied pulse.vert,
pulse.frag and common_blending.h mode-9 calculation remains the basis:

```glsl
low = image * tintLow;
high = image * tintHigh;
result = max(vec3(0), mix(low, min(low + high, vec3(1)), pulse));
```

There is no invented saturation/halo operator. The audio pulse averages selected
bands from both stereo channels, smoothsteps bounds, applies exponent and amount.
Amount is not clamped to one after multiplying. Browser spectrum mapping remains
an approximation of Wallpaper Engine's undocumented FFT bands/scaling/smoothing.

## Colour activation

**Colour activation** has three saved modes:

- **Single tint** uses High tint directly: the original supplied shader behavior.
- **Selected colours** activates the union of source-image hue families in a
  palette, evaluating each selected tint through the original pulse equation with its
  actual RGB and brightness. Matching regions receive that tint’s own response. Blue and orange can react
  together. Unselected regions retain their Low tint rest appearance.
- **All colours** activates every source colour, including neutral highlights,
  deriving a chromatic high tint from each source region’s hue, rather than
  substituting white. Neutral regions keep a neutral response. High tint stays saved when switching back to Single tint.

In Selected colours, pick **Colour to add** and press **Add tint colour**. The
palette initially contains blue and orange. Use **Selected colours (#hex)** to
edit/remove entries directly (comma-separated six-digit hex), or **Clear selected
colours** to empty it. Undo restores edits. Up to eight unique colours are kept;
case is normalized and invalid tokens are ignored. Empty palette means no audio
activation in Selected colours, not automatic All colours. Overlapping hue ranges blend the independently evaluated coloured responses
without doubling their intensity; isolated matches reproduce the matching tint’s
Single tint result.

**Colour range (°)** sets the hue distance around each selected colour. The inner
half has full weight and the outer half feathers to zero, wrapping around red.
Neutral selections match neutral pixels; chromatic selections exclude greys.
Detection uses the image before Low tint. Low tint remains a global rest tint in
all modes. Selected/All are explicit extensions of the supplied shader; Single
tint preserves its original high-tint multiplication. All colours uses
**All-colour brightness** for response strength. For older saves missing that
field, it starts from the maximum channel of the saved High tint, preserving its
brightness instead of jumping to full white strength. Explicit zero stays zero.

## Current defaults and controls

The new defaults follow the user's 2026-11-08 screenshot. Numeric values are read
directly; without exact hex values, the pale pink and dark blue swatches are
approximated as #ffe5e5 / #001438. Explicit older saved choices are preserved.

| Saved field | Control | Default / bounds |
| --- | --- | --- |
| pulseTintLow | Low tint | #ffe5e5 |
| pulseTintHigh | High tint / Colour to add | #001438 |
| pulseFrequencyMin | First frequency band | 14; integer 0–15 |
| pulseFrequencyMax | Last frequency band | 15; integer 0–15 |
| pulseAudioLow | Audio lower threshold | 0.01; 0–1 |
| pulseAudioHigh | Audio upper threshold | 1; 0–1 |
| pulseExponent | Audio exponent | 0.1; 0–4 |
| pulseAmount | Audio amount | 2; 0–2 |
| pulseColorMode | Colour activation | tint; tint / selected / all |
| pulseColors | Selected colours (#hex) | #0044ff,#ff8800; up to eight |
| pulseAllBrightness | All-colour brightness | initially High tint’s peak channel; 0–1 |
| pulseColorWidth | Colour range (°) | 30; 1–180 |
| audioBounce | Audio Bounce | 1.3; 1–1.5 |
| waves | Waves | true |
| distortion | Distortion | 0.4; 0–1 |
| glitching | Glitching | 0.3; 0–1 |
| maxFps | Max FPS | 120; integer 60–1000 |

Shared Color/numeric/text/selection editors and action registry own these controls;
all edits inherit settings/history, save/reload and template/workspace exports.
Reversed frequency/threshold bounds are sorted; equal thresholds use a defined
hard transition. Low tint applies at zero pulse even when disconnected. Use Low
tint white, Bounce 1 and Waves/Distortion/Glitching off for original-file comparisons.

## Compatibility and retirement

The current serializer whitelists 33 fields: 17 active fields above and 16 inactive
historical approximation/model fields kept only for settings round trips and older
client rollback. No current renderer or registered editor consumes those retired
fields. The earlier shader/cache implementation and its obsolete browser test are
deleted. Loading lightModel=legacy cannot select the retired renderer in this
version. Retained values are inspectable in the existing JSON exports; they are
not silently erased or reinterpreted as the new palette.

Older 29-field saves acquire mode=tint, a blue/orange starter palette and width 30.
Missing numeric/tint values acquire the screenshot defaults; existing explicit
values, including zeros, survive. Older clients may drop the new palette/brightness
fields when resaving and still expose their old rendering modes. Preserve a current
export before using older previews. No image bytes, assignments, atlas/backend
formats, source permissions or durable audio storage change.

## Audio and rendering

**Choose audio file → Play audio** uses direct website playback and analysis of
the same media element. Stop audio ends playback/analysis and keeps the file ready;
closing controls keeps playback running. There is no tab/screen/system/microphone
capture or native bridge. Music in other apps/tabs is not an input. Any captures
still active in older preview pages must be stopped there/by closing those pages.

The RMS Audio input meter and bass bounce retain the app-owned audio session.
Two stereo analyser taps supply 16 log bands/channel from 20 Hz to min(20 kHz,
Nyquist), without connecting those taps back to speakers. Arrays are reused;
there are no per-audio-frame React/settings writes. Source frequency calibration
is not a claim of bit-identical Wallpaper Engine audio processing.

The native wallpaper composition remains: 2560×1440/1600 at DPR 1 gets native
output, bounded at 8,294,400 pixels / DPR 2. Graph targets stay at 1.5 million pixels;
graph AA/glow does not filter the wallpaper. Colour detection adds at most eight
hue comparisons per image pixel in Selected mode, with palette HSV prepared only
on settings changes. Single/All bypass palette matching. There are no synthetic
halo buffers or blur passes. Hidden/reduced-motion suspension and saved FPS cap
remain; actual rate depends on hardware. Waves/VHS are still approximate.

## Verification

Model regressions cover screenshot defaults, palette parsing/bounds/deduplication,
blue/orange union, exclusion of green/neutral pixels, hue wrap, feathering, empty
palette and non-amplification of overlapping matches. Settings tests cover shared
palette setters, round trips, archived old preferences and absence of old editors.
Source pulse/stereo/no-capture and native output/lifecycle regressions remain.

Independent-response regressions compare a single palette tint with the original
Single tint calculation, verify blue/orange isolation and overlap handling, and
distinguish source-hue All from uniform white. Brightness migration/zero values
and the shared brightness setter are covered.

No fresh browser check was authorised. Prepared opt-in source-pulse and native
wallpaper checks remain unrun; they do not establish this revision's visual result.
Actual colour selection, picker/Add/Clear interaction, appearance and GPU performance
await user testing. Exact screenshot tint hex values remain unconfirmed.


## Waves fidelity limit

The user rejected the current whole-image wave deformation. The extract provides
scale 10, speed 5 and strength 0.025 for a Background Effects project layer, but
none of effects/waterwaves/effect.json or its vertex/fragment shader implementation.
The current base-image UV sine formula and extra multipliers are guessed. Matching
those numbers does not reproduce their original meaning or layer composition.
The supplied pulse shader/header do not define Waves. Turn Waves off for an
undistorted image; a faithful port needs the actual waterwaves effect/shaders and
relevant project-layer setup. No wave behavior/default was changed in this repair.
