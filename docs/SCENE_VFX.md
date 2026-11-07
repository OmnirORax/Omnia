# Scene image VFX and audio response

Open **Scene → Scene effects**, then import/apply a scene through the existing
image workflow. Effects apply to the displayed scene texture, including imported
images, without modifying the stored image, scene assignment, camera or atlas.
This is an approximation from the user's `wallpaper_selected_vfx.json` extract;
the original shader files, particle preset and personalized override JSON were
not provided. Extracted script strings are reference data and are never executed.

Exactly five effect settings persist in `WorkspaceSettings.sceneVfx`:

| Field | Control | Default | Bounds |
| --- | --- | --- | --- |
| audioLight | Audio Light | `#aa3300` (orange, estimated from screenshot) | RGB colour |
| audioBounce | Audio Bounce, maximum scale multiplier | 1.12 | 1–1.5 |
| waves | Waves | true | On/off |
| distortion | Distortion | 0.4 | 0–1 |
| glitching | Glitching | 0.3 | 0–1 |

These screenshot values override the different extract-time values. There are no
separate serialized frequency/smoothing, tint-low/high, wave-speed/direction,
particle, shader or audio-source settings. `normalizeSceneVfx` and
`serializeSceneVfx` whitelist exactly these five fields. Shared property discovery,
MC, UI-field customization and settings history use one registered `scene.vfx`
consumer. Audio Light reuses the existing Color property with a contextual caption;
there is no second colour property/picker. Existing settings/export mechanisms
carry this five-field branch; other pre-existing workspace settings are unchanged.

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
no microphone fallback. **Disconnect audio**, ending the share, or closing the
Scene panel releases the connection. Starting another source cancels the former
source; a late permission response cannot reconnect it. Audio file output is routed
through its analyser to the destination exactly once. Browser autoplay restrictions
remain authoritative; the native Play action retries audio-context resume.

## Approximation and performance

One existing background shader performs image-cover sampling, water-wave UV
movement and one VHS displacement combining the Distortion and Glitching controls.
No extra full-screen pass, particle system or image decode occurs per frame.
Reference fixed internals are wave scale 10, speed 5 and strength .025, VHS slow
speed .5 and strip tracking, and audio smoothing 25. Bass is approximated by the
31–65 Hz FFT band for bounce from scale 1 to Audio Bounce. Broadband RMS drives the
coloured light pulse, using the reference exponent 4 and amount 1.2. Unlike the
extract's separate low/high tint controls, the requested single colour is the pulse
tint and the unconnected image remains untinted. The exact original shaders,
blend implementation and frequency mapping cannot be reproduced from references.
Snow and every unpictured setting/effect are excluded.

Animation is capped at 30 fps, uses existing renderer invalidation (no geometry
refresh or React/settings updates per sample), and shares the existing scene pixel
budget. FFT buffers are reused. It pauses when hidden or reduced motion is enabled;
reduced motion renders undistorted static imagery. No animation is scheduled when
all motion effects are zero/off and no audio/fading response remains. Replacing
images resets response and rejects stale texture completion; disposal cancels all
wallpaper work. Wave/VHS displacements clamp edge sampling to avoid exposed black
borders. This can stretch extreme edge pixels; bounce is deliberately capped at 1.5.
Interactive/dense-scene GPU performance still needs user acceptance.

## Verification

The model suite covers defaults, the exact five-field serializer, explicit zero/off
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
