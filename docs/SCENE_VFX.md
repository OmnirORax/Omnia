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

**Tint mode → Single colour** retains the normal Low/High tint pickers.
**Omni (all colours)** has independent **Low tint (Omni)** and **High tint (Omni)**
pickers. Both use the shared native colour editor’s saturation/brightness square:
left–right controls saturation, up–down controls value. Each image region supplies
its own hue at both endpoints; the picker hue strip is ignored. Swatches show
the native picker’s chosen display colour, not a restriction to that hue. Native
picker appearance varies by browser. Omni Low defines the resting image; Omni
High defines the added light contribution. Single keeps its saved endpoints when
switching modes. The source Low/High blend stays unchanged.

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
low/high tint choices are saved independently.
Manual audio processing, exponent 0.1 and Manual bounce are unchanged. Automatic is
a separate response path, described below.
Selected colours remains removed. Image tint stays separate and off by default.

## Detailed automatic audio response

Open **Audio response → Automatic · detailed**. Existing saved settings keep
Manual until you select Automatic; new settings default to Automatic. Use just:

- **Sensitivity** (default 8, 0.25–8): admits attacks above learned background texture.
- **Drop contrast** (default 1, 1–4): shapes the strength gap; 1 retains linear intermediate peaks.
- **Flash amount** (the existing Audio amount, default 1.7, 0–2): scales light output.

Automatic now models finite flare events rather than letting every changing
frequency keep the light on. Positive spectral-change energy is pooled across
bins, and a short recent-background median distinguishes an attack from dense
ongoing texture. Related changes are grouped instead of making separate sparks.

An admitted flare rises through a smooth 30 ms attack, then retracts over 45 ms to
zero added pulse: about 75 ms total. Changes within that interval do not keep
extending its deadline. A substantially stronger real attack can replace a faint
late tail. Zero pulse means the chosen Low tint baseline, not a black wallpaper.

- **Sensitivity** controls attack prominence above the learned background. It
  changes admission, not the duration or brightness of every accepted event.
- **Drop contrast** shapes the height of the event. At 1, its calibrated amplitude
  is linear, preserving intermediate strengths instead of pushing most of them
  close to the maximum. Higher settings favour stronger drops.
- **Flash amount** scales the resulting envelope as before.

Peak calibration has a 0.25 reference floor, an eight-second reference decay and
current spectral-energy headroom. It learns accepted attack peaks without
amplifying tiny texture into full flashes. The background histogram is a fixed
64-bin transient log-energy distribution with 0.6-second decay. No frame-time
array allocation or persisted calibration is added. Source/mode changes reset
learning; pause/stop clears an in-flight flare. Colour and numeric setting edits
preserve the live process rather than resetting it. AudioContext time governs
pulse progress so rendering/config restarts cannot stretch the tail.

Automatic retains its unsmoothed 1024-sample stereo FFT (about 21 ms at 48 kHz)
and −100..0 dB range. Manual retains its original 2048-sample band/threshold/
exponent path. The existing tint/spatial rendering is unchanged: this flare is a
temporal envelope. Frame/display rate, FFT windowing and coalescing limit very
rapid event separation; new events within one flare can be grouped deliberately.

**Light response** shows actual shader pulse input (0–2), sampled for display at
10 Hz, separately from the RMS Audio input meter. Automatic ignores but retains
Manual-only parameters. Audio amount remains shared across modes. Shared settings,
history and exports own the existing mode/sensitivity/contrast/amount fields.
Requested RGB/default values and the current bass-bounce behavior are unchanged.
Shared sliders apply on release; committing an edit no longer restarts a flare.

## Continuous bass bounce with less delay

Automatic bounce keeps the original 31–65 Hz mono bass band, but decodes its
logarithmic FFT values into linear amplitude before mapping them to zoom.
Sustained bass retains a steady expansion; it no longer uses the light’s per-hit
onset detector or responds across the broader 180 Hz bass/harmonic region.
Light Sensitivity filters light only. **Audio Bounce** still sets maximum image
scale (default 1.3); Flash amount and Drop contrast do not scale motion.

Its mono FFT uses −100..0 dB so stronger drops are not clipped by the old −30 dB
ceiling. A recent bass-peak reference maps strong drops to the configured maximum
and smaller levels proportionally below it. The reference starts at 0.03, tracks
higher peaks immediately, decays with a 12-second time constant and never goes
below 0.03. This is a gain reference, not a zoom hold. The current amplitude alone
sets the current target. A floor of max(0.001, 2% of reference) rejects residual
noise; quiet bass above it creates only a small expansion. Reference state is
transient and resets with audio-session notifications or response-mode changes;
colour edits do not reset it. No saved calibration or additional user knobs.

Automatic retains analyser smoothing 0.15 and the 12 ms attack/45 ms release, so
motion rises quickly and returns gently to the newly lower target even when
nonzero background bass remains. These are filter constants, not measured total
latency; the original 2048-sample bass FFT window remains. Manual keeps its legacy
log-byte mapping, −30 dB ceiling and smoothing. No extra analyser/source or
permission is added. Actual motion feel remains user acceptance. Regression now
covers a drop followed by nonzero residual bass, rather than only digital silence.

## Optional Image tint

The user liked full-image tinting as a separate effect. Open **Scene effects →
Image tint → Enable image tint**, then choose **Image tint colour**. This multiplies
wallpaper RGB after its audio pulse, without changing audio input, response curves
or graph/UI colours. It works with Single/All and is off by default. The starter
colour is #c20000 (red from the user's screenshot). Disable it to restore the
underlying image response. Both toggle and colour inherit shared controls,
history, save/reload and exports. The tint shader code is compiled only when on.

## Current defaults and controls

Defaults match the user’s explicit RGB/numeric request: base 250/240/240
(#faf0f0), high 61/0/0 (#3d0000), Sensitivity 8, Drop contrast 1, Flash amount 1.7.
Both Single and Omni endpoint defaults use these swatches. In Omni their hue is
ignored, as above. Existing explicit saved values are retained.

| Saved field | Control | Default / bounds |
| --- | --- | --- |
| pulseRangeMode | Audio response | auto for new settings; manual for existing settings lacking mode |
| pulseSensitivity | Sensitivity (Automatic) | 8; 0.25–8 |
| pulseDropContrast | Drop contrast (Automatic) | 1; 1–4 |
| pulseTintLow | Low tint | #faf0f0 |
| pulseTintHigh | High tint / Colour to add | #3d0000 |
| pulseFrequencyMin | First frequency band | 14; integer 0–15 |
| pulseFrequencyMax | Last frequency band | 15; integer 0–15 |
| pulseAudioLow | Audio lower threshold | 0.01; 0–1 |
| pulseAudioHigh | Audio upper threshold | 1; 0–1 |
| pulseExponent | Audio exponent | 0.1; 0–4 |
| pulseAmount | Audio amount | 1.7; 0–2 |
| pulseColorMode | Tint mode | tint; Single colour / Omni |
| pulseOmniTint | High tint (Omni); only HSV saturation/value used | #3d0000 (S 1, V 61/255) |
| pulseOmniTintLow | Low tint (Omni); only HSV saturation/value used | #faf0f0 |
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

The current serializer whitelists 42 fields: 21 active and 21 archived.
Selected mode maps to Single; its palette/range remain archived. The earlier
approximation fields and three superseded Omni sliders remain exportable without
active controls/render paths. Existing Low/High tint choices are preserved.

If pulseOmniTint is absent and a valid saved pulseAllBrightness exists, the
compatibility reader encodes it as fully saturated reference red at the same value
(rounded to native 8-bit precision). Its hue is ignored. Without a saved legacy
strength, it uses the current #3d0000 default. Explicit picker colours, including
black, take precedence and round-trip
unchanged. Missing pulseOmniTintLow inherits the saved Single Low tint’s hex,
using only its saturation/value in Omni; explicit new Low values win. Single
low/high values remain untouched. The former exposure multipliers are retained but not applied: the user
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

The RMS Audio input meter and both bounce modes retain the app-owned audio session.
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

Local models reproduce the old dense-frequency failure: after warmup that fixture
never dropped below half emission and averaged about 0.69. The replacement tests
require mostly-zero background output, independent graded peaks over nonzero
texture, completed valleys between attacks 100 ms apart, smooth rise/fall at
60/120/240 Hz, and coalesced changes without deadline extension. A graded fixture
produces approximately 6%, 11%, 30%, 76% and 93% peaks. These are synthetic model
measurements, not a claim about the user’s music or GPU output.

Live sampler checks cover the same dense-background case, Manual restoration,
pause/resume and audio-clock progress even when render dt is reset. Renderer
checks ensure colour edits preserve a live pulse. Existing colour/serialization,
source blend, defaults, bass-bounce/noise release and native-output cases remain.
No new browser run was authorised. Real flare appearance, musical event grouping,
midrange richness, perceived timing and clipping need user acceptance.

## Waves fidelity limit

The user rejected the current whole-image wave deformation. The extract provides
scale 10, speed 5 and strength 0.025 for a Background Effects project layer, but
none of effects/waterwaves/effect.json or its vertex/fragment shader implementation.
The current base-image UV sine formula and extra multipliers are guessed. Matching
those numbers does not reproduce their original meaning or layer composition.
The supplied pulse shader/header do not define Waves. Turn Waves off for an
undistorted image; a faithful port needs the actual waterwaves effect/shaders and
relevant project-layer setup. No wave behavior/default was changed in this repair.
