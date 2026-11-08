# Omnium Audio Helper — first Windows implementation

This helper is adapted from Manuel-1312/minimeters-bridge's WASAPI capture and
recovery approach, not from the commercial MiniMeters application. It needs
neither MiniMeters nor Spotify/Spicetify. Its wire format is Omnium-specific;
the unmodified upstream bridge on port 8985 is not compatible.

## Try the Windows build

1. Download **Omnium-Audio-Helper-Windows** from the repository's
   [Windows audio helper workflow](https://github.com/OmnirORax/Omnia/actions/workflows/audio-helper.yml).
   Extract the artifact ZIP, then run `Omnium-Audio-Helper.exe`.
   Python is bundled; end users do not install dependencies or enter commands.
2. Leave its console open. On **https://omnium.nexus**, after this frontend change
   is deployed, open **Scene → Scene effects** and switch **System audio** on.
   Local development served on `http://localhost:<port>` or
   `http://127.0.0.1:<port>` is also supported. Grant the browser's loopback-network
   permission if requested. For the GitHack preview, copy the 32-character code printed in the **new**
   helper window into **Pairing code**, then connect **once**. No omnium.nexus
   login is needed. Use the **remembered pairing** helper build. The code is saved
   at `%LOCALAPPDATA%/Omnium/AudioHelper/pairing-code.txt`, surviving restarts and
   EXE updates. After a successful connection, this browser remembers it locally
   across GitHack preview URLs/PRs. The helper still needs to be running.
   A new preview reconnects automatically; click anywhere if browser autoplay
   requires activation. Nothing needs to be copied on each preview.
   GitHack has a shared browser origin, so remembered access applies across that
   host: only open trusted previews. Private browsing/storage clearing or another
   browser profile needs pairing again. Do not share or publish the code.
3. Play music in another app/tab through the Windows default output. Audio input
   and the current wallpaper effects should react. Capture isn't played back.
4. Change headphones/output device: capture reopens automatically. Closing the
   website's settings doesn't disconnect it. **System audio off** disconnects and stops
   capture; closing the helper exits it. **System audio off** also disables automatic startup while retaining pairing.
   **System audio on** re-enables it; **Audio connection settings → Forget system audio** stops capture
   and removes this browser’s remembered code. Closing the helper pauses capture,
   but does not reset its identity.

This first delivery is a console executable, not the final signed installer or
automatic startup/update flow. The helper captures only while an allowed website
tab is connected. Up to 16 tabs receive the same audio independently from one capture stream.
Connecting/closing/switching off in one tab does not disconnect other tabs. Capture stops
when the last tab disconnects. Each tab has a bounded six-packet queue. It does not listen on the LAN,
save audio, use a microphone, upload samples or request browser screen sharing.

Windows/browser prompts may appear. ASIO/exclusive playback or audio on a different
output isn't guaranteed to be captured. The current browser queue uses the first
two channels (mono is duplicated); surround downmix and phones/macOS/Linux are not
implemented. Local Windows output/driver and browser tests remain necessary.

## Developer build

Windows, Python 3.12: run `./build.ps1` in PowerShell. Build dependencies are
development-only. The workflow runs unit tests and packages the executable and
license/readme. Unsigned prototype binaries may trigger Windows reputation prompts.

For development without packaging:

    python -m pip install -r requirements.txt
    python bridge.py

Capture uses the default WASAPI loopback, callbacks requested at 10 ms, and a
six-packet bounded queue. Only capture/reconnection remains from the upstream
approach; no numpy/scipy, LUFS history, Mel spectrum, oscilloscope or vectorscope
work. The browser resamples a bounded PCM queue into a muted AudioWorklet and
feeds the same analyser/response path as the existing scene analyser.

## Protocol

WebSocket: `ws://127.0.0.1:8986/omnium/audio-v1`. Host/path/origin are fixed by
the helper and client. Origin is mandatory; only the canonical site and explicit
localhost development origins are accepted directly. The shared raw.githack.com origin and exact single-label
`https://<alias>.omnia-web-bae.pages.dev` preview origins require the per-install pairing code in the `pair` query parameter. Missing,
wrong or duplicate codes and unrelated origins are rejected before capture starts.
JSON status messages accompany
binary PCM packets. OMA1 packets are little-endian:

| Bytes | Meaning |
| --- | --- |
| 0–3 | ASCII OMA1 |
| 4–7 | uint32 source sample rate |
| 8–9 | uint16 source channels |
| 10–11 | uint16 frame count |
| 12–15 | uint32 sequence (continues over device reopen; wraps) |
| 16… | interleaved float32 PCM |

Rate 8–192 kHz, channels 1–32, frames 1–4096, exact packet length and finite samples
are required. Browser queue retains at most ~60 ms; starvation produces silence.
Disconnect clears pending PCM; reconnect backs off 1–8 seconds and Stop cancels it.
PCM/device buffers stay transient. A versioned browser-local connection preference
(`omnium.system-audio.connection.v1`) stores pairing and automatic-start choice,
separately from atlas exports, workspace settings and history. Unknown/corrupt
preferences are preserved rather than silently overwritten; Forget explicitly
removes them. Older clients ignore this key and keep manual connection behavior. Existing effect/tint settings are unchanged.

Preview pairing is covered by actual localhost WebSocket handshakes using the
GitHack Origin (valid/missing/wrong/duplicate codes and unrelated origins), plus
frontend code validation, URL/retry retention and analyser wiring tests. This is
not a browser or Windows-device acceptance check of preview pairing.

Remembered pairing also has model/socket coverage for identity reuse, damaged-file
preservation, auto-start and gesture resume, Stop/Forget, retry identity retention
and simultaneous identical PCM delivery and independent tab disconnect. No new
browser or real Windows-device check was run for remembered connections.

### Switching to private Pages previews

Rebuild/update the helper for Pages preview support. Open the Access-protected
PR alias (for example `https://pr-61.omnia-web-bae.pages.dev`), then Scene →
Scene effects → Preview pairing code. Paste the same helper code once and switch
System audio on. Access login does not authorize local audio capture: pairing is still
required. Use the stable PR alias to retain the remembered connection between
uploads. Each deployment hash hostname is a separate browser origin and needs its
own pairing. Stop and Forget retain their existing behavior. Existing GitHack
connections remain supported. Local workspaces and preferences do not move between
origins; export/import workspace content through the existing chooser. Pairing
codes stay device-local and never enter exports or source provenance.

### Minimal connection controls

System audio is one on/off toggle. On connects or retries while the helper is
running; off cancels retries and disables automatic reconnection without deleting
pairing. The toggle represents requested connection, not whether PCM is arriving;
status and Audio input show actual readiness. First pairing is shown only until
saved. Replace pairing code and Forget are tucked into Audio connection settings;
turn off/on to apply a replacement code. The file picker/player and separate
Play/Stop actions are retired. Their old saved layout/shortcut references remain
unavailable rather than being reassigned. Pairing preference v1 and helper identity
files are unchanged. No audio files or samples were saved in workspace exports.
