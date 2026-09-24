"""Build drill-full.wav: chained golden-path utterances with silence gaps.

Re-run from C:\\Voxtra:  python3 e2e/fixtures/audio/build-drill.py
Input: 02-isolate-area + 03-notify-supervisor + 05-inspect-label
  + 04-document-incident + 01-clean-it-up
(each separated by silence so turn detection closes each turn; leading silence
lets the agent greeting finish before the first utterance).
Output: e2e/fixtures/audio/drill-full.wav (16-bit PCM mono, 22050 Hz).

Timing (2026-09-22 loop hardening, extended 2026-09-24): Chromium replays the
capture file when it ends, and any replayed utterance becomes a spurious
post-completion turn that breaks the exactly-5 assertion. The 150s tail keeps
the whole drill plus the 12s settle plus report/shutdown inside the first pass
even when a degraded window pushes a spec past ~3min (2026-09-24 run 3:
warehouse double-pass after outlasting the 126.5s tail). Gaps stay 4s (the
8-intent Warehouse agent round-trips inside them).
"""
import pathlib
import wave

HERE = pathlib.Path(__file__).parent
RATE = 22050


def silence(seconds: float) -> bytes:
    return b'\x00' * int(RATE * seconds) * 2


def read(name: str) -> bytes:
    with wave.open(str(HERE / name), 'rb') as w:
        assert (w.getnchannels(), w.getsampwidth(), w.getframerate()) == (1, 2, RATE), name
        return w.readframes(w.getnframes())


parts = [
    silence(6.0),
    read('02-isolate-area.wav'),
    silence(4.0),
    read('03-notify-supervisor.wav'),
    silence(4.0),
    read('05-inspect-label.wav'),
    silence(4.0),
    read('04-document-incident.wav'),
    silence(4.0),
    read('01-clean-it-up.wav'),
    silence(150.0),
]
out = HERE / 'drill-full.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    for p in parts:
        w.writeframes(p)
print(f'wrote {out} ({sum(len(p) for p in parts) // 2 / RATE:.1f}s)')
