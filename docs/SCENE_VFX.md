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

## Low and high tints

Both modes retain **Low tint (base)** as an adjustable resting level. **High tint
type** chooses **Single colour** or **Omni (all colours)**. Omni changes the high
response only; it does not replace both tints or force a white lower endpoint.

Single colour uses the ordinary **High tint** picker and the direct source pulse
equation. It compiles without palette or Omni calculations. Selected colours is
removed; old Selected settings fall back to Single and retain their palette data
only for rollback. Audio processing, exponent 0.1, timing, smoothing and bounce are
unchanged. A local renderer-frame test verifies changing light uniforms at 0.1;
actual GPU response and the reported slowdown remain user testing.

Omni derives the high response colour from each source region. **Omni high tint
strength** sets its value. Low tint remains visible and feeds the same source
blend, establishing the base from which the light rises. Use a dim neutral Low
when you want an untinted, darker rest image with room for the pulse to brighten.
A coloured Low intentionally colours the resting image, as in the source effect.
Neutral regions receive a neutral Omni response.

The ordinary High tint is saved when switching to Omni; the numeric Omni strength
is saved when returning to Single. Both modes share Low and the same audio curve.
The optional Image tint filter remains separate and disabled by default.

## Optional Image tint

The user liked full-image tinting as a separate effect. Open **Scene effects →
Image tint → Enable image tint**, then choose **Image tint colour**. This multiplies
wallpaper RGB after its audio pulse, without changing audio input, response curves
or graph/UI colours. It works with Single/All and is off by default. The starter
colour is #c20000 (red from the user's screenshot). Disable it to restore the
underlying image response. Both toggle and colour inherit shared controls,
history, save/reload and exports. The tint shader code is compiled only when on.

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
| pulseColorMode | High tint type | tint; Single colour / Omni |
| pulseAllBrightness | Omni high tint strength | fixed default 56/255; 0–1 |
| imageTintEnabled | Enable image tint | false |
| imageTint | Image tint colour | #c20000 |
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

The current serializer whitelists 35 fields: 17 active fields above and 18 inactive
historical approximation/model fields kept only for settings round trips and older
client rollback. No current renderer or registered editor consumes those retired
fields. The earlier shader/cache implementation and its obsolete browser test are
deleted. Loading lightModel=legacy cannot select the retired renderer in this
version. Retained values are inspectable in the existing JSON exports; they are
not silently erased or reinterpreted as the new palette.

Older selected mode now maps to tint; its palette/range remain archived. Missing
Image tint fields acquire disabled/red defaults. Explicit tint and pulse choices
are retained.
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
graph AA/glow does not filter the wallpaper. There is no palette detection or synthetic halo work. Single/All and optional
Image tint are separate compiled shader variants; changing ordinary colour/response
values does not recompile their variant. Hidden/reduced-motion suspension and saved FPS cap
remain; actual rate depends on hardware. Waves/VHS are still approximate.

## Verification

Local regressions cover the direct source pulse and stereo analysis, changing
light uniforms at exponent 0.1 with independent bounce, compile-variant switching,
Selected retirement and preservation of inactive palette fields, Omni High strength, Image tint opt-in/serialization, and existing native output/lifecycle.
No fresh browser run was authorised. The user reported Single tint looked frozen
and slowed after the shared palette change; this repair restores its direct shader
path without changing audio.ts or response settings. GPU response/speed recovery
is not inferred from model/build success and remains user testing.

## Waves fidelity limit

The user rejected the current whole-image wave deformation. The extract provides
scale 10, speed 5 and strength 0.025 for a Background Effects project layer, but
none of effects/waterwaves/effect.json or its vertex/fragment shader implementation.
The current base-image UV sine formula and extra multipliers are guessed. Matching
those numbers does not reproduce their original meaning or layer composition.
The supplied pulse shader/header do not define Waves. Turn Waves off for an
undistorted image; a faithful port needs the actual waterwaves effect/shaders and
relevant project-layer setup. No wave behavior/default was changed in this repair.
