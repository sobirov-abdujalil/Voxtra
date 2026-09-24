/**
 * Voxtra PCM capture worklet (plain JS, served from /pcm-worklet.js).
 * - Receives mic Float32 mono at the context rate (Chromium: 24kHz native;
 *   Firefox/Safari: context rate e.g. 44.1/48kHz, resampled below).
 * - Resamples to 24kHz mono via linear interpolation when needed.
 * - Emits fixed-size 480-sample (20ms @24kHz) PCM16 frames as transferable ArrayBuffers.
 */
class PcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this._pending = new Float32Array(0);
    this._inRate = sampleRate;
    this._outRate = 24000;
    this._frame = 480;
  }

  _append(arr) {
    const merged = new Float32Array(this._pending.length + arr.length);
    merged.set(this._pending, 0);
    merged.set(arr, this._pending.length);
    this._pending = merged;
  }

  _resample(input) {
    if (this._inRate === this._outRate) return Float32Array.from(input);
    const outLen = Math.floor((input.length * this._outRate) / this._inRate);
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = (i * this._inRate) / this._outRate;
      const i0 = Math.floor(pos);
      const i1 = Math.min(i0 + 1, input.length - 1);
      const frac = pos - i0;
      out[i] = input[i0] * (1 - frac) + input[i1] * frac;
    }
    return out;
  }

  _toPCM16(samples) {
    const buf = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buf);
    for (let i = 0; i < samples.length; i++) {
      let s = samples[i];
      if (s > 1) s = 1;
      if (s < -1) s = -1;
      view.setInt16(i * 2, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
    }
    return buf;
  }

  process(inputs) {
    try {
      const ch = inputs && inputs[0];
      if (ch && ch.length > 0) {
        // Downmix to mono: average all channels.
        const len = ch[0].length;
        const mono = new Float32Array(len);
        for (let c = 0; c < ch.length; c++) {
          const data = ch[c];
          for (let i = 0; i < len; i++) mono[i] += data[i] / ch.length;
        }
        const resampled = this._resample(mono);
        this._append(resampled);
        while (this._pending.length >= this._frame) {
          const frame = this._pending.slice(0, this._frame);
          this._pending = this._pending.slice(this._frame);
          const pcm = this._toPCM16(frame);
          this.port.postMessage({ type: 'pcm-frame', buffer: pcm }, [pcm]);
        }
      }
    } catch (err) {
      this.port.postMessage({ type: 'capture-error', message: String((err && err.message) || err) });
    }
    return true;
  }
}

registerProcessor('voxtra-pcm-capture', PcmCapture);
