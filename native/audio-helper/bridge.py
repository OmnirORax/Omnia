"""Omnium system-audio input, adapted from Manuel-1312/minimeters-bridge (MIT).

Only WASAPI capture/recovery is retained. No metering, recording, audible output,
microphone fallback or cloud service. See THIRD_PARTY_LICENSES.txt.
"""
import asyncio
from collections import deque
from http import HTTPStatus
import json
import re
import secrets
import struct
import sys
import threading
import time
from urllib.parse import urlsplit, parse_qs

HOST, PORT, PATH = "127.0.0.1", 8986, "/omnium/audio-v1"
HEADER = struct.Struct("<4sIHHI")


def allowed_origin(origin, token=None, preview_token=None):
    trusted = origin == "https://omnium.nexus" or bool(
        isinstance(origin, str)
        and re.fullmatch(r"http://(?:localhost|127\.0\.0\.1):[0-9]{1,5}", origin)
    )
    # Shared preview hosting never gets ambient access. A per-run capability is
    # copied by the user from the local helper and kept in the page's memory only.
    paired = (origin == "https://raw.githack.com" and isinstance(token, str)
              and re.fullmatch(r"[A-Za-z0-9_-]{32}", token) is not None
              and isinstance(preview_token, str) and len(preview_token) == 32
              and secrets.compare_digest(token, preview_token))
    return trusted or paired


def pcm_packet(data, rate, channels, sequence):
    if not 8000 <= rate <= 192000 or not 1 <= channels <= 32:
        raise ValueError("Unsupported output format")
    if len(data) % (channels * 4):
        raise ValueError("Unaligned PCM block")
    frames = len(data) // (channels * 4)
    if not 1 <= frames <= 4096:
        raise ValueError("Unsupported PCM block size")
    return HEADER.pack(b"OMA1", rate, channels, frames, sequence & 0xFFFFFFFF) + data


class Capture:
    """One bounded producer; a slow browser can never accumulate old audio."""
    def __init__(self):
        self.lock = threading.Lock()
        self.queue = deque(maxlen=6)  # ~60 ms at the requested 10 ms callback size.
        self.active = threading.Event()
        self.stop_event = threading.Event()
        self.state = ("waiting", "Waiting for the website to connect")
        self.thread = None
        self.sequence = 0

    def status(self):
        with self.lock:
            return self.state

    def set_status(self, state, message):
        with self.lock:
            self.state = (state, message)
            if state != "ready":
                self.queue.clear()

    def start(self):
        if self.thread is None:
            self.thread = threading.Thread(target=self.run, daemon=True)
            self.thread.start()

    def pull(self):
        with self.lock:
            packets = list(self.queue)
            self.queue.clear()
        return packets

    def run(self):
        import pyaudiowpatch as pa
        from pycaw.pycaw import AudioUtilities
        import comtypes
        comtypes.CoInitialize()
        try:
            while not self.stop_event.is_set():
                if not self.active.wait(.2):
                    continue
                audio, stream = None, None
                try:
                    # Recreate PortAudio on recovery so device enumeration is fresh.
                    audio = pa.PyAudio()
                    device = audio.get_default_wasapi_loopback()
                    rate, channels = int(device["defaultSampleRate"]), int(device["maxInputChannels"])
                    endpoint = AudioUtilities.GetSpeakers().id

                    def callback(data, _frames, _timing, _status):
                        if self.active.is_set() and not self.stop_event.is_set():
                            try:
                                packet = pcm_packet(data, rate, channels, self.sequence)
                                self.sequence += 1
                                with self.lock:
                                    self.queue.append(packet)
                                    self.state = ("ready", "System output captured")
                            except (ValueError, TypeError):
                                self.set_status("waiting", "Unsupported output format — choose another Windows output")
                        return None, pa.paContinue

                    stream = audio.open(format=pa.paFloat32, channels=channels, rate=rate,
                                        input=True, input_device_index=device["index"],
                                        frames_per_buffer=max(1, rate // 100), stream_callback=callback)
                    self.set_status("ready", "System output captured")
                    while self.active.is_set() and not self.stop_event.wait(.5):
                        if not stream.is_active() or AudioUtilities.GetSpeakers().id != endpoint:
                            break
                except Exception:
                    self.set_status("waiting", "Waiting for a Windows output device — retrying…")
                    self.stop_event.wait(1)
                finally:
                    if stream is not None:
                        try:
                            stream.stop_stream()
                            stream.close()
                        except Exception:
                            pass
                    if audio is not None:
                        audio.terminate()
                    self.set_status("waiting", "Reconnecting to the Windows output device…")
        finally:
            comtypes.CoUninitialize()

    def close(self):
        self.active.clear()
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=3)


async def serve(capture, port=PORT, preview_token=None):
    from websockets.asyncio.server import serve as websocket_server
    occupied = False

    async def check(connection, request):
        url = urlsplit(request.path)
        if url.path != PATH:
            return connection.respond(HTTPStatus.NOT_FOUND, "Unknown audio protocol\n")
        tokens = parse_qs(url.query).get('pair', [])
        token = tokens[0] if len(tokens) == 1 else None
        if not allowed_origin(request.headers.get("Origin"), token, preview_token):
            return connection.respond(HTTPStatus.FORBIDDEN, "Preview pairing required\n")

    async def handler(socket):
        nonlocal occupied
        if occupied:
            await socket.close(1013, "Another Omnium tab is connected; disconnect it first")
            return
        occupied = True
        capture.pull()
        capture.active.set()
        previous, heartbeat = None, 0
        try:
            while socket.close_code is None:
                state = capture.status()
                if state != previous or time.monotonic() - heartbeat >= 1:
                    await asyncio.wait_for(socket.send(json.dumps({"type": "status", "state": state[0], "message": state[1]})), .5)
                    previous, heartbeat = state, time.monotonic()
                packets = capture.pull()
                for packet in packets:
                    await asyncio.wait_for(socket.send(packet), .25)
                await asyncio.sleep(.005)
        except Exception:
            # A disconnected/slow peer is dropped; capture never queues indefinitely.
            pass
        finally:
            capture.active.clear()
            capture.pull()
            occupied = False
            await socket.close()

    return await websocket_server(handler, HOST, port, process_request=check,
                                  max_size=1024, max_queue=1, write_limit=65536,
                                  compression=None, ping_interval=10, ping_timeout=10)


async def main():
    if sys.platform != "win32":
        raise SystemExit("This first Omnium Audio Helper build supports Windows only.")
    # Initialize the COM wrapper on the main thread; capture balances its own
    # worker-thread CoInitialize/CoUninitialize pair.
    __import__("comtypes")
    capture = Capture()
    preview_token = secrets.token_urlsafe(24)
    try:
        async with await serve(capture, preview_token=preview_token):
            capture.start()
            print("Omnium Audio Helper is ready. In Omnium: Scene → Scene effects → Connect system audio.", flush=True)
            print("Leave this window open. Close it or press Ctrl+C to stop. No audio is recorded.", flush=True)
            print("To use the Omnium GitHack preview, paste this code into Preview pairing code:", flush=True)
            print(preview_token, flush=True)
            print("The code expires when this helper closes. Only paste it into your Omnium preview.", flush=True)
            await asyncio.Future()
    finally:
        capture.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except OSError as error:
        print("Could not start audio helper (it may already be running):", error)
        input("Press Enter to close.")
