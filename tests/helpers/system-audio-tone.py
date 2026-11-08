"""Opt-in synthetic source for the user-approved browser check; no devices used."""
import asyncio
import math
from pathlib import Path
import struct
import sys
import threading
import time
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'native' / 'audio-helper'))
from bridge import Capture, serve, pcm_packet

capture = Capture()


def tone():
    position = 0
    while not capture.stop_event.is_set():
        if not capture.active.wait(.01):
            position = 0
            continue
        # Repeated short tone/silence phases exercise both input and retraction.
        pcm = []
        for i in range(480):
            t = (position + i) / 48000
            value = (.25 * math.sin(2 * math.pi * 60 * t) + .15 * math.sin(2 * math.pi * 600 * t)) if t % 1 < .55 else 0
            pcm.extend([value, value * .5])
        packet = pcm_packet(struct.pack('<960f', *pcm), 48000, 2, position // 480)
        with capture.lock:
            capture.queue.append(packet)
        position += 480
        time.sleep(.01)


async def main():
    threading.Thread(target=tone, daemon=True).start()
    async with await serve(capture):
        capture.set_status('ready', 'Synthetic test source')
        print('Synthetic PCM helper ready', flush=True)
        await asyncio.Future()


try:
    asyncio.run(main())
except KeyboardInterrupt:
    capture.close()
