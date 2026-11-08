import asyncio
import struct
import sys
import types
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import bridge


class PacketTests(unittest.TestCase):
    def test_pairing_identity_survives_restart_and_update_without_overwriting_bad_data(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'settings' / 'pairing-code.txt'
            code = bridge.load_pairing_token(path)
            self.assertRegex(code, r'^[A-Za-z0-9_-]{32}$')
            self.assertEqual(bridge.load_pairing_token(path), code)
            path.write_text('unsupported identity', encoding='ascii')
            with self.assertRaises(OSError): bridge.load_pairing_token(path)
            self.assertEqual(path.read_text(), 'unsupported identity')

    def test_header_payload_and_sequence_wrap(self):
        pcm = struct.pack('<4f', .1, -.2, .3, -.4)
        packet = bridge.pcm_packet(pcm, 48000, 2, 0x100000003)
        self.assertEqual(bridge.HEADER.unpack(packet[:16]), (b'OMA1', 48000, 2, 2, 3))
        self.assertEqual(packet[16:], pcm)
        for data, rate, channels in [(b'x', 48000, 2), (pcm, 0, 2), (pcm, 48000, 0), (b'', 48000, 2)]:
            with self.assertRaises(ValueError):
                bridge.pcm_packet(data, rate, channels, 0)

    def test_capture_is_bounded_and_waiting_discards_old_packets(self):
        capture = bridge.Capture()
        capture.queue.extend(range(100))
        self.assertEqual(capture.pull(), list(range(94, 100)))
        capture.queue.append(b'old audio')
        capture.set_status('waiting', 'Device changed')
        self.assertEqual(capture.pull(), [])

    def test_explicit_origins_only(self):
        for origin in ['https://omnium.nexus', 'http://localhost:5173', 'http://127.0.0.1:4180']:
            self.assertTrue(bridge.allowed_origin(origin))
        for origin in [None, 'null', 'https://raw.githack.com', 'https://omnium.nexus.evil.test', 'http://192.168.1.2:5173', 'http://localhost.evil.test:1234']:
            self.assertFalse(bridge.allowed_origin(origin))

    def test_pages_previews_require_pairing_and_exact_project_suffix(self):
        code = 'a' * 32
        for origin in ['https://pr-61.omnia-web-bae.pages.dev', 'https://a1234567.omnia-web-bae.pages.dev']:
            self.assertFalse(bridge.allowed_origin(origin))
            self.assertFalse(bridge.allowed_origin(origin, 'b' * 32, code))
            self.assertTrue(bridge.allowed_origin(origin, code, code))
        for origin in ['https://other.pages.dev', 'https://pr-61.omnia-web-bae.pages.dev.evil.test',
                       'http://pr-61.omnia-web-bae.pages.dev', 'https://a.b.omnia-web-bae.pages.dev',
                       'https://pr-61.omnia-web-bae.pages.dev:443', 'https://omnia-web-bae.pages.dev']:
            self.assertFalse(bridge.allowed_origin(origin, code, code))

    def test_wasapi_reopens_on_default_change_without_restarting_sequence(self):
        capture = bridge.Capture()
        capture.active.set()
        events, sequences = [], []
        endpoints = iter(['first', 'second', 'second'])

        class Audio:
            def __init__(self): events.append('enumerate')
            def get_default_wasapi_loopback(self): return {'defaultSampleRate': 48000, 'maxInputChannels': 2, 'index': 4}
            def open(self, **options):
                self.options = options
                options['stream_callback'](b'\0' * 480 * 2 * 4, 480, {}, 0)
                events.append('open')
                if events.count('open') == 2: capture.stop_event.set()
                return self
            def is_active(self): return True
            def stop_stream(self): events.append('stop')
            def close(self): events.append('close')
            def terminate(self): events.append('terminate')

        audio = types.SimpleNamespace(PyAudio=Audio, paFloat32=1, paContinue=0)
        utilities = types.SimpleNamespace(GetSpeakers=lambda: types.SimpleNamespace(id=next(endpoints)))
        com = types.SimpleNamespace(CoInitialize=lambda: None, CoUninitialize=lambda: None)
        original = bridge.pcm_packet
        def packet(data, rate, channels, sequence):
            sequences.append(sequence)
            return original(data, rate, channels, sequence)
        with patch.dict(sys.modules, {'pyaudiowpatch': audio, 'pycaw': types.ModuleType('pycaw'), 'pycaw.pycaw': types.SimpleNamespace(AudioUtilities=utilities), 'comtypes': com}), patch.object(bridge, 'pcm_packet', packet):
            capture.run()
        self.assertEqual(events.count('open'), 2)
        self.assertEqual(events.count('terminate'), 2)
        self.assertEqual(sequences, [0, 1])


class LocalConnectionTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.capture = bridge.Capture()
        self.code = 'a' * 32
        self.server = await bridge.serve(self.capture, port=0, preview_token=self.code)
        self.url = f'ws://127.0.0.1:{self.server.sockets[0].getsockname()[1]}{bridge.PATH}'

    async def asyncTearDown(self):
        self.server.close()
        await self.server.wait_closed()

    async def test_real_socket_carries_pcm_and_disconnect_releases_capture(self):
        from websockets.asyncio.client import connect
        async with connect(self.url, origin='http://localhost:5173') as client:
            self.assertIn('status', await asyncio.wait_for(client.recv(), 1))
            self.assertTrue(self.capture.active.is_set())
            packet = bridge.pcm_packet(struct.pack('<2f', .25, -.25), 48000, 2, 7)
            self.capture.queue.append(packet)
            self.assertEqual(await asyncio.wait_for(client.recv(), 1), packet)
        for _ in range(20):
            if not self.capture.active.is_set(): break
            await asyncio.sleep(.01)
        self.assertFalse(self.capture.active.is_set())

    async def test_untrusted_origin_cannot_start_capture(self):
        from websockets.asyncio.client import connect
        from websockets.exceptions import InvalidStatus
        with self.assertRaises(InvalidStatus):
            async with connect(self.url, origin='https://unrelated.example'):
                self.fail('Unauthorized peer was accepted')
        self.assertFalse(self.capture.active.is_set())

    async def test_preview_requires_current_code_and_correct_origin(self):
        from websockets.asyncio.client import connect
        from websockets.exceptions import InvalidStatus
        for suffix, origin in [('', 'https://raw.githack.com'),
                               ('?pair=' + 'b' * 32, 'https://raw.githack.com'),
                               ('?pair=' + self.code + '&pair=' + self.code, 'https://raw.githack.com'),
                               ('?pair=' + self.code, 'https://unrelated.example')]:
            with self.assertRaises(InvalidStatus):
                async with connect(self.url + suffix, origin=origin):
                    self.fail('Unpaired preview accepted')
            self.assertFalse(self.capture.active.is_set())
        async with connect(self.url + '?pair=' + self.code, origin='https://raw.githack.com') as client:
            await asyncio.wait_for(client.recv(), 1)
            self.assertTrue(self.capture.active.is_set())
            packet = bridge.pcm_packet(struct.pack('<2f', .2, -.2), 48000, 2, 1)
            self.capture.queue.append(packet)
            self.assertEqual(await asyncio.wait_for(client.recv(), 1), packet)

    async def test_tabs_receive_identical_pcm_and_disconnect_independently(self):
        from websockets.asyncio.client import connect
        async with connect(self.url, origin='http://localhost:5173') as first:
            await first.recv()
            async with connect(self.url + '?pair=' + self.code, origin='https://raw.githack.com') as second:
                await second.recv()
                packet = bridge.pcm_packet(struct.pack('<2f', .1, -.1), 48000, 2, 2)
                self.capture.queue.append(packet)
                self.assertEqual(await asyncio.wait_for(first.recv(), 1), packet)
                self.assertEqual(await asyncio.wait_for(second.recv(), 1), packet)
                self.assertIsNone(first.close_code)
            await asyncio.sleep(.03)
            self.assertTrue(self.capture.active.is_set())
            packet = bridge.pcm_packet(struct.pack('<2f', .3, -.3), 48000, 2, 3)
            self.capture.queue.append(packet)
            self.assertEqual(await asyncio.wait_for(first.recv(), 1), packet)
        await asyncio.sleep(.03)
        self.assertFalse(self.capture.active.is_set())
