/**
 * Browser-side pure audio helpers (DOM-free, unit-testable logic).
 * Algorithms mirror server/src/voice/audio.ts exactly.
 */

export const VOICE_SAMPLE_RATE = 24000;
export const FRAME_SAMPLES = 480;

function clamp16(v: number): number {
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

export function floatToPCM16(samples: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = clamp16(samples[i] as number);
    view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return buf;
}

export function pcm16ToFloat(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  const out = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = (view.getInt16(i * 2, true) as number) / 0x8000;
  }
  return out;
}

export function downsampleTo24k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === VOICE_SAMPLE_RATE) return Float32Array.from(input);
  if (!Number.isFinite(inputRate) || inputRate <= 0) throw new Error('invalid inputRate');
  if (input.length === 0) return new Float32Array(0);
  const outLength = Math.floor((input.length * VOICE_SAMPLE_RATE) / inputRate);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const pos = (i * inputRate) / VOICE_SAMPLE_RATE;
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = pos - i0;
    out[i] = (input[i0] as number) * (1 - frac) + (input[i1] as number) * frac;
  }
  return out;
}

export function expectedFrameCount(inputLength: number, inputRate: number): number {
  return Math.floor((inputLength * VOICE_SAMPLE_RATE) / inputRate);
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function pcm16ToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = (bytes[i + 1] as number) ?? 0;
    const c = (bytes[i + 2] as number) ?? 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}

export function base64ToPCM16(b64: string): ArrayBuffer {
  const clean = b64.replace(/\s/g, '');
  if (clean.length % 4 !== 0) throw new Error('invalid base64 length');
  const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const outLen = (clean.length / 4) * 3 - pad;
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i] as string) << 18) |
      (B64.indexOf(clean[i + 1] as string) << 12) |
      ((clean[i + 2] === '=' ? 0 : B64.indexOf(clean[i + 2] as string)) << 6) |
      (clean[i + 3] === '=' ? 0 : B64.indexOf(clean[i + 3] as string));
    if (o < outLen) out[o++] = (n >> 16) & 255;
    if (o < outLen) out[o++] = (n >> 8) & 255;
    if (o < outLen) out[o++] = n & 255;
  }
  return out.buffer as ArrayBuffer;
}

/** Strip HTML tags and escape entities; safe to render via textContent. */
export function sanitizeTranscript(input: string, maxLen = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .trim()
    .slice(0, maxLen);
}

export interface Stoppable {
  stop: () => void;
}

/**
 * Gapless playback clock (DOM-free, unit-testable).
 *
 * Official AssemblyAI browser-integration pattern (voice-agent-api/
 * browser-integration, lite client): each reply.audio chunk is decoded to
 * PCM16 24kHz and scheduled on the AudioContext clock with
 *   playbackTime = max(playbackTime, now); src.start(playbackTime);
 *   playbackTime += buffer.duration;
 * On reply.done interrupted the schedule resets to now so stale audio never
 * plays. Chaining via onended + immediate start() leaves event-loop gaps
 * between chunks — with ~50ms agent chunks the gaps are audible as choppy
 * stutter ("g'g'g"). This class owns that clock so session.ts cannot regress
 * to gapful playback.
 */
export class PlaybackScheduler {
  private cursor = 0;
  private initialized = false;

  get playbackTime(): number {
    return this.cursor;
  }

  /** Next start time for a chunk arriving at currentTime. Never goes backwards. */
  nextStart(currentTime: number): number {
    if (!Number.isFinite(currentTime) || currentTime < 0) currentTime = 0;
    if (!this.initialized || !Number.isFinite(this.cursor)) {
      this.cursor = currentTime;
      this.initialized = true;
      return this.cursor;
    }
    if (this.cursor < currentTime) this.cursor = currentTime;
    return this.cursor;
  }

  /** Advance the cursor by a played buffer duration (seconds). */
  advance(durationSeconds: number): void {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return;
    if (!this.initialized) {
      this.cursor = 0;
      this.initialized = true;
    }
    this.cursor += durationSeconds;
  }

  /** Schedule one chunk: returns the AudioContext `when` for src.start(when). */
  schedule(currentTime: number, durationSeconds: number): number {
    const start = this.nextStart(currentTime);
    this.advance(durationSeconds);
    return start;
  }

  /** Flush on barge-in / reply.done interrupted: stale future starts are dropped. */
  reset(now: number): void {
    this.cursor = Number.isFinite(now) && now >= 0 ? now : 0;
    this.initialized = true;
  }
}

/**
 * Barge-in queue: drops queued agent audio and stops the current source
 * when a new user turn begins.
 */
export class PlaybackQueue {
  private queue: ArrayBuffer[] = [];
  private current: Stoppable | null = null;

  get queuedCount(): number {
    return this.queue.length;
  }

  get hasCurrent(): boolean {
    return this.current !== null;
  }

  setCurrent(source: Stoppable | null): void {
    this.current = source;
  }

  enqueue(buf: ArrayBuffer): void {
    this.queue.push(buf);
  }

  dequeue(): ArrayBuffer | undefined {
    return this.queue.shift();
  }

  clear(): void {
    this.queue = [];
  }

  clearOnBargeIn(): { dropped: number; stoppedCurrent: boolean } {
    const dropped = this.queue.length;
    this.queue = [];
    let stoppedCurrent = false;
    if (this.current) {
      try {
        this.current.stop();
      } catch {
        // never throw through the barge-in path
      }
      stoppedCurrent = true;
      this.current = null;
    }
    return { dropped, stoppedCurrent };
  }
}
