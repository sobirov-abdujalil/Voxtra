import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  VOICE_SAMPLE_RATE,
  PlaybackScheduler,
  base64ToPCM16,
  floatToPCM16,
  pcm16ToBase64,
  pcm16ToFloat,
} from '../src/voice/audio.js';

describe('agent audio decode path', () => {
  it('produces the expected byte length for a known base64 input at 24kHz', () => {
    // 480 samples = 20ms @24kHz = 960 PCM16 bytes.
    const samples = new Float32Array(480);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin((i / samples.length) * Math.PI * 2) * 0.5;
    const pcm = floatToPCM16(samples);
    expect(pcm.byteLength).toBe(960);
    const b64 = pcm16ToBase64(pcm);
    const back = base64ToPCM16(b64);
    expect(back.byteLength).toBe(960);
    expect(new Uint8Array(back)).toEqual(new Uint8Array(pcm));
    const float = pcm16ToFloat(back);
    expect(float.length).toBe(480);
    expect(VOICE_SAMPLE_RATE).toBe(24000);
    // Playback duration for this chunk at 24kHz is exactly 20ms.
    expect(float.length / VOICE_SAMPLE_RATE).toBeCloseTo(0.02, 5);
  });
});

describe('gapless playback scheduler (g-g-g regression)', () => {
  it('schedules consecutive chunks contiguously with no gap and no overlap', () => {
    const clock = new PlaybackScheduler();
    const chunkDuration = 480 / 24000; // 20ms agent chunk
    const t0 = 10.0;
    const s0 = clock.schedule(t0, chunkDuration);
    const s1 = clock.schedule(t0 + 0.005, chunkDuration);
    const s2 = clock.schedule(t0 + 0.01, chunkDuration);
    expect(s0).toBeCloseTo(10.0, 5);
    expect(s1).toBeCloseTo(10.02, 5);
    expect(s2).toBeCloseTo(10.04, 5);
    expect(clock.playbackTime).toBeCloseTo(10.06, 5);
  });

  it('never starts in the past: late arrivals slot at now', () => {
    const clock = new PlaybackScheduler();
    const d = 0.05;
    clock.schedule(5.0, d);
    // Next chunk arrives after the first already finished.
    const late = clock.schedule(5.2, d);
    expect(late).toBeCloseTo(5.2, 5);
  });

  it('resets the schedule on barge-in / reply.done interrupted', () => {
    const clock = new PlaybackScheduler();
    clock.schedule(7.0, 0.2);
    clock.schedule(7.0, 0.2);
    expect(clock.playbackTime).toBeCloseTo(7.4, 5);
    clock.reset(8.0);
    expect(clock.playbackTime).toBeCloseTo(8.0, 5);
    const next = clock.schedule(8.0, 0.1);
    expect(next).toBeCloseTo(8.0, 5);
  });
});

describe('voice session wiring (static contract)', () => {
  it('uses gapless AudioContext-clock scheduling and keeps echo cancellation on', () => {
    const src = readFileSync(join(process.cwd(), 'src', 'voice', 'session.ts'), 'utf8');
    // Gapless pattern per the official lite client.
    expect(src).toContain('playbackClock.schedule');
    expect(src).toContain('src.start(when)');
    expect(src).toContain('playbackClock.reset');
    // Playback buffers are built at the 24kHz voice rate (context resamples).
    expect(src).toContain('VOICE_SAMPLE_RATE');
    // Browser echo cancellation stays on; server-side denoising means the
    // client must NOT stack noise suppression (official audio guidance).
    expect(src).toContain('echoCancellation: true');
    expect(src).toContain('noiseSuppression: false');
    // No gapful onended-chaining remains.
    expect(src).not.toMatch(/currentSrc/);
  });
});
