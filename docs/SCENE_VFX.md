# Scene image VFX and audio response

Open **Scene → Scene effects**, then import/apply a scene through the existing
image workflow. Effects apply to the displayed scene texture, including imported
images, without modifying the stored image, scene assignment, camera or atlas.
This is an approximation from the user's `wallpaper_selected_vfx.json` extract;
the original shader files, particle preset and personalized override JSON were
not provided. Extracted script strings are reference data and are never executed.

The five pictured effects plus the subsequently requested Max FPS control persist in `WorkspaceSettings.sceneVfx`:

| Field | Control | Default | Bounds |
| --- | --- | --- | --- |
| audioLight | Audio Light colour-range target | `#aa3300` (orange, estimated from screenshot) | RGB colour |
| audioBounce | Audio Bounce, maximum scale multiplier | 1.12 | 1–1.5 |
| waves | Waves | true | On/off |
| distortion | Distortion | 0.4 | 0–1 |
| glitching | Glitching | 0.3 | 0–1 |
| maxFps | Max FPS | 120 | 60–1000, whole frames/sec |

These screenshot values override the different extract-time values. There are no
separate serialized frequency/smoothing, tint-low/high, wave-speed/direction,
particle, shader or audio-source settings. `normalizeSceneVfx` and
`serializeSceneVfx` whitelist exactly these six fields. Shared property discovery,
MC, UI-field customization and settings history use one registered `scene.vfx`
consumer. Audio Light reuses the existing Color property with a contextual caption;
there is no second colour property/picker. Existing settings/export mechanisms
carry this six-field branch; other pre-existing workspace settings are unchanged.

## Audio

**Choose audio file** opens temporary local playback with ordinary native audio
controls. Press Play to allow browser audio. The file is not uploaded or saved,
and playback state/permissions do not enter settings or exports. The reusable
`connectSceneAudioElement` adapter also accepts a future website music player's
media element; no music-generation/catalog service exists in this delivery.

**Connect shared audio** invokes the browser's tab/screen picker. Select a source
and enable its **Share audio** option. Availability of tab versus desktop/system
audio depends on the browser and OS. The app reads only the audio track; it never
samples the captured screen video and does not echo captured audio to speakers.
A stream without audio is rejected and all tracks/context are released. There is
no microphone fallback. **Disconnect audio**, ending the share, releases the connection. Closing the Scene panel keeps the app-owned audio
session playing/analysing. Leaving the scene renderer releases the session. Starting another source cancels the former
source; a late permission response cannot reconnect it. Audio file output is routed
through its analyser to the destination exactly once. Browser autoplay restrictions
remain authoritative; the native Play action retries audio-context resume.

## Approximation and performance

One existing background shader performs image-cover sampling, water-wave UV
movement and one VHS displacement combining the Distortion and Glitching controls.
No extra full-screen pass, particle system or image decode occurs per frame.
Reference fixed internals are wave scale 10, speed 5 and strength .025, VHS slow
speed .5 and strip tracking, and audio smoothing 25. Bass is approximated by the
31–65 Hz FFT band for bounce from scale 1 to Audio Bounce. Broadband RMS is noise-gated and mapped to an audible 0–1 response range before
driving the coloured light pulse, using the reference exponent 4 and amount 1.2. Unlike the
extract's separate low/high tint controls, the requested single colour selects a broad, softly blended hue family. Lighter
and darker variants retain their source colour and receive local audio-driven
emission; distant hues stay unchanged. The shared bloom pass receives only this
emission, with live time/audio/image uniforms, instead of the whole image. The exact original shaders,
blend implementation and frequency mapping cannot be reproduced from references.
Snow and every unpictured setting/effect are excluded.

Animation uses the saved Max FPS cap (default 120, minimum 60), uses existing renderer invalidation (no geometry
refresh or React/settings updates per sample), and shares the existing scene pixel
budget. FFT buffers are reused. It pauses when hidden or reduced motion is enabled;
reduced motion renders undistorted static imagery. No animation is scheduled when
all motion effects are zero/off and no audio/fading response remains. Replacing
images resets response and rejects stale texture completion; disposal cancels all
wallpaper work. Wave/VHS displacements clamp edge sampling to avoid exposed black
borders. This can stretch extreme edge pixels; bounce is deliberately capped at 1.5.
Interactive/dense-scene GPU performance still needs user acceptance.

## Verification

The model suite covers defaults, the exact six-field serializer, explicit zero/off
values, historical settings, shared setters, bounded response and stream lifecycle
(rejection, cancelled requests, stopped tracks). The opt-in
`tests/scene-vfx.browser.mjs` is a focused synthetic-tone/shader/control check,
authorized for this delivery only. It does not establish desktop/system capture
compatibility or visual equivalence to Wallpaper Engine. Those require the user's
browser and selected music/image.

Focused local browser result (2026-11-07): the approved synthetic Chromium check
passed defaults, native file-player analysis, actual shader compilation, image
displacement, audio-driven rendered changes, zero-effects original restoration,
exact five-field serialization and no animation after disposal. No shader/page
errors were observed. Browser capture permission/OS compatibility and interactive
performance remain unverified. Playback connects through native media interaction
rather than ref mounting, avoiding duplicate media-source creation during React
lifecycle replay. Disconnect replaces this player's media element before reuse.


## Audio-pickup repair after user testing (2026-11-07)

The user reported that Audio Light/Bounce did not respond. The earlier loud 55 Hz
synthetic check did not establish ordinary-music or desktop-capture acceptance.
A quiet RMS .05 previously yielded light strength .00012, effectively invisible.
The adapter now maps audible RMS to an engine-style 0–1 response range before the
existing shader shaping. The waveform noise floor keeps digital silence still;
no sixth gain/frequency setting is introduced.

Audio/file-URL ownership now lives in the app session rather than the settings
panel. Closing/reparenting controls detaches their view without stopping playback
or capture; reopening reuses the same player. Explicit Disconnect stops and closes
the graph, with a fresh media element available for reconnection. Renderer disposal
releases the player URL and capture resources. Cancelled/stale source events cannot
replace the current source. Shared capture can resume a suspended context without
requesting a second share. A readonly input meter shows actual analysed signal,
updates its DOM at 10 Hz without React/settings writes, and is never serialized.

New model evidence covers quiet audible input, silence, shared-context resume,
source cleanup/no echo, view subscriptions retaining playback, stop/reconnect and
final disposal. The user approved the quiet/shared-stream browser extension and subsequently
confirmed that audio response works. The focused result below covers the repair;
real OS/browser capture compatibility remains user-tested. Actual effect matching
is deferred until the original effect code is supplied.


## Colour-range lighting and 120 fps (2026-11-07)

Audio Light now selects a broad, feathered hue range around any chosen chromatic
colour, including adjacent hues and light/dark variants. Neutral/black pixels are
excluded from hue lighting. Matching source radiance is boosted with highlight weighting; dark shadows retain
their original levels and the image is not globally tinted. The shared SceneGlow capability `sceneGlowPass` supplies
an emission-only mask, with live shared uniforms so cached bloom cannot freeze an
old audio/texture state. Existing scene glow strength/quality still governs halo
appearance. No additional effect setting is serialized.

Wallpaper pacing uses Max FPS (default 120, minimum 60) through the display's animation clock. It
retains phase on high-refresh displays and discards missed-frame debt. A 60 Hz
display remains 60 Hz; GPU/renderer load can reduce the delivered rate. Existing
resolution budgets, reduced-motion and hidden-tab suspension remain in force.
No unrelated profiling/benchmark suite was run.

The approved focused Chromium regression passed quiet local website playback
through an actually imported scene and quiet real WebAudio tracks through the
shared-audio command (only the OS picker was simulated). Both reached the actual
wallpaper light and bounce uniforms. The live input meter agreed with the signal.
A real DOM retention check found that browsers can pause a media element removed
from the document. Closing/reparenting its view now parks it in an app-owned hidden
DOM host; reopening reuses that element and final disposal removes the host.

GPU patch tests passed orange and lighter-orange response, unchanged distant
blue/green pixels, switching the target to blue, emission-only bloom and live
cached-mask response. Shader/page errors were absent. Actual original Wave/VHS
shader matching remains deferred until the effect sources are supplied.


## Editable maximum frame rate (2026-11-07)

Scene → Scene effects → **Max FPS** sets a whole-number cap, minimum 60,
default 120 (supported numeric range 60–1000). It uses the existing registered
numeric editor, shared settings history/persistence, MC and serializer. Changing
it resets pacing without changing image/wave phase, source audio or other values.
The actual rate cannot exceed display refresh or rendering capacity. Old five-field
settings acquire maxFps 120 while retaining every existing choice. This sixth
serialized setting was explicitly requested after the original screenshot-only
scope; audio internals and source/session data remain excluded. Model regressions
cover historical default, lower bound, persistence/shared setter and selected caps
on a fast display clock. Earlier focused colour/audio browser evidence remains;
no new browser suite was run for this standard numeric-control addition.


## Shadow-preserving flash correction (2026-11-07)

The user clarified the comparison: image 1 is the original, image 2 is this app's
washed-out output, image 3 is the desired vivid blue flash. The prior shader
normalised source chroma and added an emission floor even to dark matching pixels.
That lifted shadows and lowered the apparent contrast. Audio Light now multiplies
source radiance with a highlight-weighted gain. It does not recolour matching
pixels toward the picked RGB value or add an arbitrary floor to their shadows.
The broad hue selector and emission-only bloom remain; brighter matching details
flash strongly while near-black cloth/space and unrelated hues retain their base.

The user-approved `scene-light-contrast.browser.mjs` check exercises the actual
SceneAppearance → SceneGlow → OutputPass stack. It reproduced the old dark-blue
lift (source blue 26 became 95), then verified the new peak leaves that patch at
26, black at zero and non-target gold unchanged, while bright blue/cyan becomes
stronger. No-audio base and restored source patches match exactly. No page/shader
errors were observed. This controlled evidence is not a claim of exact Wallpaper
Engine visual equivalence; actual-image acceptance remains with the user.


## Bright-colour headroom revision (2026-11-07; visual validation pending)

The user reported that orange and other bright colours became white. The prior
source-radiance gain could exceed the display range in several RGB channels at
once, despite preserving shadows. The revision maps brightness into
remaining SDR headroom and scales RGB together. Full-bright source colours receive
no extra core brightness; mid-tone colours can brighten without changing channel
ratios. The glow-mask halo has a separate small energy budget instead of reusing
the unbounded core gain. No saved controls, defaults or source image bytes change.

The focused full-bloom/output regression is extended with orange, pale gold,
near-white, blue, green and pink. It must reproduce the former orange white-out,
then check hue/saturation retention, mid-tone response, source restoration and
shadow preservation. This new bounded browser check has not been run: no explicit approval was
received. Local model/type/build checks do not establish visual acceptance. The
user correctly challenged the earlier tests: brighter pixels plus retained shadows
were insufficient criteria for colour retention or a Wallpaper Engine match.
This revision is published for direct comparison on the user's image, with no
claim that its visual result is verified.
