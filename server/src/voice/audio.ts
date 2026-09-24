/**
 * Pure PCM16 audio helpers shared by the voice loop.
 * No DOM, no I/O, no network — fully unit-testable.
 * Browser worklet + playback code must use these exact algorithms.
 */

export const VOICE_SAMPLE_RATE = 24000;
/** 20ms frames at 24kHz. */
export const FRAME_SAMPLES = 480;

function clamp16(v: number): number {
  if (v > 1) return 1;
  if (v < -1) return -1;
  return v;
}

/** Float32 [-1,1] -> PCM16 mono little-endian ArrayBuffer (transferable). */
export function floatToPCM16(samples: Float32Array): ArrayBuffer {
  const buf = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < samples.length; i++) {
    const s = clamp16(samples[i] as number);
    view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
  }
  return buf;
}

/** PCM16 mono LE ArrayBuffer -> Float32 [-1,1]. */
export function pcm16ToFloat(buffer: ArrayBuffer): Float32Array {
  const view = new DataView(buffer);
  const out = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = (view.getInt16(i * 2, true) as number) / 0x8000;
  }
  return out;
}

/**
 * Downsample/mono-mix to 24kHz mono.
 * Chromium path: inputRate === 24000 returns a copy (no resampling).
 * Firefox/Safari path: linear interpolation resample inside the worklet.
 */
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

/** Expected output frame count for a known input length (for tests). */
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
