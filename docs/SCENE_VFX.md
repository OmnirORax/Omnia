# Scene image effects and audio response

Open **Scene → Scene effects → Wallpaper Engine pulse**. This is now the only
light renderer; the Earlier approximation renderer, model selector and tuning
controls have been removed at the user's request. The supplied pulse.vert,
pulse.frag and common_blending.h mode-9 calculation remains the Single-colour basis:

```glsl
low = image * tintLow;
high = image * tintHigh;
result = max(vec3(0), mix(low, min(low + high, vec3(1)), pulse));
```

There is no invented saturation/halo operator. Manual audio averages selected
bands from both stereo channels, smoothsteps bounds, applies exponent and amount.
Amount is not clamped to one after multiplying. Browser spectrum mapping remains
an approximation of Wallpaper Engine's undocumented FFT bands/scaling/smoothing.

## Low and high tints

**Low tint (base)** remains the resting colour/level in both modes. **High tint
type → Single colour** uses the normal High tint picker. **Omni (all colours)**
uses **High tint (Omni)** through the same shared native colour picker, with its
usual saturation/brightness square. Left–right controls saturation; up–down
controls value (brightness). Omni ignores the picker’s hue strip: each image
region supplies its own hue. The swatch is the native picker’s chosen display
colour, not a restriction to that hue. Picker appearance depends on the browser.

Omni extracts the full HSV hue even from pale image colours; it does not
blend that hue back toward white based on the source saturation. Exactly neutral
regions have no hue and retain a neutral response.

At the left edge, high tint is neutral; at the right, it uses source hues.
At the bottom, high tint is black (no added high contribution); at the top its
value is one. Both dimensions change together in a single picker, just like
normal High tint. Low and high feed the same supplied mode-9 pulse equation.
Audio amount above one still overdrives the blend; very strong settings can clip.

The separate Colour strength, Base brightness and Flash brightness sliders are
removed. Their saved preferences remain in JSON for rollback. Single and Omni
high tint choices are saved independently, while Low tint remains shared.
Manual audio processing, exponent 0.1 and bounce are unchanged. Automatic is
a separate response path, described below.
Selected colours remains removed. Image tint stays separate and off by default.

## Detailed automatic audio response

Open **Audio response → Automatic · detailed**. Existing saved settings keep
Manual until you select Automatic; new settings default to Automatic. Use just:

- **Sensitivity** (default 2, 0.25–8): sets quiet-attack contrast across the full range.
- **Flash amount** (the existing Audio amount, default 2, 0–2): scales light output.

Automatic listens across both channels and detects upward changes separately in
each frequency bin. A loud continuous tone cannot hide a quieter new hit in a
different bin or keep the flash open. A 20 ms running local baseline distinguishes
an attack from sustained volume; there is no added output hold. Zero input gives
zero pulse immediately. Its FFT smoothing is zero and dB range is −100 to 0 instead
of Manual’s −100 to −30.

Sensitivity now controls quiet-detail contrast logarithmically, rather than gain
on a nearly saturated square-root volume curve. Higher values make small attacks
more prominent; Flash amount scales output independently. The local change ratio
sets the brief pulse decay separately, so high sensitivity does not stretch a hit
into a long tail. A steady unchanging tone settles rather than glowing constantly.
This is an onset response, deliberately replacing Automatic’s former sustained
loudness response. Manual remains available for the old volume/threshold behavior.

Automatic uses 1024 FFT samples (about 21 ms at 48 kHz), restored to 2048 in Manual.
Frequency resolution is consequently coarser (first non-DC bin about 47 Hz at
48 kHz); transient separation is limited by FFT windowing, the 20 ms analysis
baseline, frame rate and display. Arbitrarily rapid/sub-window sounds cannot be
promised separate flashes. The FFT floor also limits the quietest detectable sound.

A slow 8-second calibration adjusts gain to changing music levels; it never holds
light output. It starts at reference amplitude 0.03 and bottoms at 0.01; silence
does not raise gain. Source reconnect or response-mode change resets calibration;
colour edits and closing controls do not. All state is transient. No extra audio
route, source permissions, or audible playback processing is added. Bounce retains
its existing path. Automatic affects both Single and Omni light modes.

**Light response** shows actual shader pulse input (0–2), sampled for display at
10 Hz. It differs from the existing RMS Audio input meter. Switch to **Manual**
to restore selected frequency bands, lower/upper thresholds and exponent exactly;
Automatic ignores those values but retains them. Audio amount is shared across
both modes. Shared settings/history/exports own mode and sensitivity.

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
| pulseRangeMode | Audio response | auto for new settings; manual for existing settings lacking mode |
| pulseSensitivity | Sensitivity (Automatic) | 2; 0.25–8 |
| pulseTintLow | Low tint | #ffe5e5 |
| pulseTintHigh | High tint / Colour to add | #001438 |
| pulseFrequencyMin | First frequency band | 14; integer 0–15 |
| pulseFrequencyMax | Last frequency band | 15; integer 0–15 |
| pulseAudioLow | Audio lower threshold | 0.01; 0–1 |
| pulseAudioHigh | Audio upper threshold | 1; 0–1 |
| pulseExponent | Audio exponent | 0.1; 0–4 |
| pulseAmount | Audio amount | 2; 0–2 |
| pulseColorMode | High tint type | tint; Single colour / Omni |
| pulseOmniTint | High tint (Omni); only HSV saturation/value used | #380000 (S 1, V 56/255) |
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

The current serializer whitelists 40 fields: 19 active and 21 archived.
Selected mode maps to Single; its palette/range remain archived. The earlier
approximation fields and three superseded Omni sliders remain exportable without
active controls/render paths. Existing Low/High tint choices are preserved.

If pulseOmniTint is absent, the compatibility reader encodes the saved old
pulseAllBrightness as a fully saturated reference red of the same value (rounded
to the native picker’s 8-bit precision). Its hue is ignored. The default is
#380000. Explicit picker colours, including black, take precedence and round-trip
unchanged. The former exposure multipliers are retained but not applied: the user
requested the High tint blend instead. This is an intentional rendering change,
not a claim of equivalent output to the abandoned exposure model. Normalization
is idempotent; no eager storage writes are added.

Older clients can drop the new picker field and render their old Omni semantics
when resaving. Retain a current export before rollback. No image bytes,
assignments, atlas/backend formats, source permissions or durable audio storage
change. Missing Image tint fields retain disabled/red defaults.

## Audio and rendering

**Choose audio file → Play audio** uses direct website playback and analysis of
the same media element. Stop audio ends playback/analysis and keeps the file ready;
closing controls keeps playback running. There is no tab/screen/system/microphone
capture or native bridge. Music in other apps/tabs is not an input. Any captures
still active in older preview pages must be stopped there/by closing those pages.

The RMS Audio input meter and bass bounce retain the app-owned audio session.
Two stereo analyser taps supply Manual’s 16 log bands/channel or Automatic’s
strongest-bin signal from 20 Hz to min(20 kHz, Nyquist), without connecting those
taps back to speakers. Arrays are reused;
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
Selected retirement and preservation of inactive palette fields, Omni saturation/value hue independence and legacy preference conversion, Image tint opt-in/serialization, and existing native output/lifecycle.
Automatic regressions cover repeated hits/silence with no output hold, quiet
detail, increasing hit strength, bass coverage, FFT mode restoration and retained
Manual settings. New regressions exercise repeated hits over a louder constant background (the
previous silence-separated test missed this), a useful slider progression from
0.25 through 8, short settling at maximum sensitivity and the live sampler.
No fresh browser run was authorised for these changes. The numerical checks
verify colour math and settings wiring, including normal-versus-Omni blend
equality for pale gold/blue source hues; they do not verify GPU appearance. Test Omni
with different saturation/brightness positions, then compare Single colour; actual brightness,
highlight clipping and response on the user’s display remain user acceptance.

## Waves fidelity limit

The user rejected the current whole-image wave deformation. The extract provides
scale 10, speed 5 and strength 0.025 for a Background Effects project layer, but
none of effects/waterwaves/effect.json or its vertex/fragment shader implementation.
The current base-image UV sine formula and extra multipliers are guessed. Matching
those numbers does not reproduce their original meaning or layer composition.
The supplied pulse shader/header do not define Waves. Turn Waves off for an
undistorted image; a faithful port needs the actual waterwaves effect/shaders and
relevant project-layer setup. No wave behavior/default was changed in this repair.
