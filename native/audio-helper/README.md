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
   is deployed, choose **Scene → Scene effects → Connect system audio**.
   Local development served on `http://localhost:<port>` or
   `http://127.0.0.1:<port>` is also supported. Grant the browser's loopback-network
   permission if requested. For the GitHack preview, copy the 32-character code printed in the **new**
   helper window into **Preview pairing code**, then connect. No omnium.nexus
   login is needed. The old helper build cannot pair. The code stays in tab memory,
   clears from the input on connect, and expires when the helper closes. Paste it
   only into your Omnium preview. A helper restart needs its new code and an
   explicit reconnect; closing/reopening settings keeps an active connection.
3. Play music in another app/tab through the Windows default output. Audio input
   and the current wallpaper effects should react. Capture isn't played back.
4. Change headphones/output device: capture reopens automatically. Closing the
   website's settings doesn't disconnect it. **Stop audio** disconnects and stops
   capture; closing the helper exits it. Reconnect with the same control.

This first delivery is a console executable, not the final signed installer or
automatic startup/update flow. The helper captures only while an allowed website
tab is connected. Only one tab connects at a time. It does not listen on the LAN,
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
feeds the same analyser/response path as website file playback.

## Protocol

WebSocket: `ws://127.0.0.1:8986/omnium/audio-v1`. Host/path/origin are fixed by
the helper and client. Origin is mandatory; only the canonical site and explicit
localhost development origins are accepted directly. The shared raw.githack.com
origin requires the per-run pairing code in the `pair` query parameter. Missing,
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
This is transient device input; no audio/connection state enters atlas exports,
workspace settings or history. Existing effect/tint settings are unchanged.

Preview pairing is covered by actual localhost WebSocket handshakes using the
GitHack Origin (valid/missing/wrong/duplicate codes and unrelated origins), plus
frontend code validation, URL/retry retention and analyser wiring tests. This is
not a browser or Windows-device acceptance check of preview pairing.
