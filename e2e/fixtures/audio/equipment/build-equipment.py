"""Build equipment-drill.wav: chained Equipment golden-path utterances with silence gaps.

Re-run from C:\\Voxtra:  python3 e2e/fixtures/audio/equipment/build-equipment.py
Input: 01-hit-estop + 02-isolate-power + 03-evacuate-area
  + 04-verify-technician + 05-document-incident
(each separated by silence so turn detection closes each turn; leading silence
lets the agent greeting finish before the first utterance).
Output: e2e/fixtures/audio/equipment/equipment-drill.wav (16-bit PCM mono, 22050 Hz).

Timing (same hardening as the Forklift track): 10s gaps (the Equipment agent
reasons over 14 intents and speaks a reply per turn — the wider gap lets the
reply finish and turn detection close each utterance before the next starts,
so turns cannot queue-jump or barge-in cascade past the pending call) and a
150s tail (extended 2026-09-24 from 90s, same run-3 evidence as the Forklift
track: Chromium replays the capture file when it ends, and any replayed
utterance becomes a spurious post-completion turn that breaks the exactly-5
assertion — the tail keeps the whole drill plus the 12s settle plus
report/shutdown inside the first pass even in a degraded ~3min/spec window;
the E2E stops polling at completion and ignores the tail).
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
    read('01-hit-estop.wav'),
    silence(10.0),
    read('02-isolate-power.wav'),
    silence(10.0),
    read('03-evacuate-area.wav'),
    silence(10.0),
    read('04-verify-technician.wav'),
    silence(10.0),
    read('05-document-incident.wav'),
    silence(150.0),
]
out = HERE / 'equipment-drill.wav'
with wave.open(str(out), 'wb') as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(RATE)
    for p in parts:
        w.writeframes(p)
print(f'wrote {out} ({sum(len(p) for p in parts) // 2 / RATE:.1f}s)')
