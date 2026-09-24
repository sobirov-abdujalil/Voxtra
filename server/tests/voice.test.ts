import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';
import {
  base64ToPCM16,
  downsampleTo24k,
  expectedFrameCount,
  floatToPCM16,
  pcm16ToBase64,
  pcm16ToFloat,
} from '../src/voice/audio.js';
import { PlaybackQueue } from '../src/voice/playback.js';
import { sanitizeTranscript } from '../src/voice/sanitize.js';
import {
  SUBMIT_ACTION_TOOL,
  buildSessionUpdate,
  buildToolResult,
  parseToolCall,
} from '../src/voice/tools.js';
import { INTENTS } from '../src/scenario/types.js';

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

describe('voice audio: PCM16 round-trip', () => {
  it('encodes and decodes a known sine sweep within quantization tolerance', () => {
    const samples = new Float32Array(96);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.sin((i / samples.length) * Math.PI * 4) * 0.8;
    const pcm = floatToPCM16(samples);
    expect(pcm.byteLength).toBe(samples.length * 2);
    const back = pcm16ToFloat(pcm);
    expect(back.length).toBe(samples.length);
    for (let i = 0; i < samples.length; i++) {
      expect(Math.abs((back[i] as number) - (samples[i] as number))).toBeLessThan(6e-5);
    }
  });

  it('base64 encode/decode round-trips PCM16 bytes exactly', () => {
    const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 0.123]);
    const pcm = floatToPCM16(samples);
    const b64 = pcm16ToBase64(pcm);
    const back = base64ToPCM16(b64);
    expect(new Uint8Array(back)).toEqual(new Uint8Array(pcm));
  });
});

describe('voice audio: downsampling', () => {
  it('produces the expected frame count for a known 48kHz input length', () => {
    const input = new Float32Array(4800); // 100ms at 48kHz
    const out = downsampleTo24k(input, 48000);
    expect(out.length).toBe(expectedFrameCount(4800, 48000));
    expect(out.length).toBe(2400);
  });

  it('Chromium 24kHz path returns an equal copy without resampling', () => {
    const input = new Float32Array([0.1, -0.2, 0.3]);
    const out = downsampleTo24k(input, 24000);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });
});

describe('voice: transcript sanitizer', () => {
  it('strips HTML tags and escapes entities', () => {
    expect(sanitizeTranscript('<script>alert(1)</script>hello <b>world</b>')).not.toContain('<script>');
    expect(sanitizeTranscript('<script>alert(1)</script>hello <b>world</b>')).toContain('hello');
    expect(sanitizeTranscript('a & b')).toContain('&amp;');
  });
});

describe('voice: barge-in helper', () => {
  it('drops queued buffers and stops the current source on a new user turn', () => {
    const q = new PlaybackQueue();
    q.enqueue(new ArrayBuffer(4));
    q.enqueue(new ArrayBuffer(4));
    q.enqueue(new ArrayBuffer(4));
    let stopped = 0;
    q.setCurrent({ stop: () => { stopped += 1; } });
    const res = q.clearOnBargeIn();
    expect(res).toEqual({ dropped: 3, stoppedCurrent: true });
    expect(stopped).toBe(1);
    expect(q.queuedCount).toBe(0);
    expect(q.hasCurrent).toBe(false);
  });

  it('is a no-op when nothing is queued or playing', () => {
    const q = new PlaybackQueue();
    expect(q.clearOnBargeIn()).toEqual({ dropped: 0, stoppedCurrent: false });
  });
});

describe('voice: submit_action tool schema', () => {
  it('reuses the engine intent enum exactly', () => {
    const intentProp = SUBMIT_ACTION_TOOL.parameters.properties.intent;
    expect([...intentProp.enum].sort()).toEqual([...INTENTS].sort());
  });

  it('session.update carries the tool and barge-in flag as the first WS message shape', () => {
    const update = buildSessionUpdate();
    expect(update.type).toBe('session.update');
    expect(update.session.tools[0].name).toBe('submit_action');
    // Live-verified (2026-09-20 smoke vs real AssemblyAI): barge-in lives at
    // session.input.turn_detection.interrupt_response; a top-level
    // session.interrupt_response is rejected with session.error invalid_format.
    expect(update.session.input.turn_detection.interrupt_response).toBe(true);
    expect(update.session).not.toHaveProperty('interrupt_response');
  });

  it('session.update uses a documented output voice', () => {
    // Live-verified: output.voice must be a voice from the official voices
    // list ('ivy' is not one and fails validation). See docs/voices.
    const update = buildSessionUpdate();
    expect(['alba', 'eve', 'george', 'jane', 'jean', 'mary', 'michael', 'anna', 'charles', 'paul', 'vera']).toContain(
      update.session.output.voice,
    );
  });

  it('parses a valid tool.call payload', () => {
    const parsed = parseToolCall({
      type: 'tool.call',
      call_id: 'call-1',
      name: 'submit_action',
      arguments: JSON.stringify({ intent: 'isolate_area', rationale: 'cordon first' }),
    });
    expect(parsed).toMatchObject({ callId: 'call-1', intent: 'isolate_area' });
  });

  it('rejects malformed tool calls, unknown tools, and unknown intents', () => {
    expect(parseToolCall(null)).toMatchObject({ error: 'MALFORMED_TOOL_CALL' });
    expect(parseToolCall({ type: 'tool.call', call_id: 'c', name: 'other_tool', arguments: '{}' })).toMatchObject({
      error: 'UNKNOWN_TOOL',
    });
    expect(
      parseToolCall({ type: 'tool.call', call_id: 'c', name: 'submit_action', arguments: JSON.stringify({ intent: 'teleport' }) }),
    ).toMatchObject({ error: 'UNKNOWN_INTENT' });
    expect(parseToolCall({ type: 'tool.call', name: 'submit_action' })).toMatchObject({ error: 'MALFORMED_TOOL_CALL' });
  });

  it('builds a bounded tool.result reply', () => {
    // Live-verified against the events reference: tool.result is
    // { type, call_id, result, is_error? } — there is no `ok` field.
    const r = buildToolResult('call-1', 'consequence text', true);
    expect(r).toMatchObject({ type: 'tool.result', call_id: 'call-1', result: 'consequence text' });
    expect(r).not.toHaveProperty('ok');
    expect(r).not.toHaveProperty('is_error');
    const failed = buildToolResult('call-2', 'no effect', false);
    expect(failed).toMatchObject({ type: 'tool.result', call_id: 'call-2', is_error: true });
    const long = buildToolResult('call-3', 'x'.repeat(5000), true);
    expect((long.result as string).length).toBeLessThanOrEqual(2000);
  });
});

describe('voice token endpoint', () => {
  it('returns a short-lived token shape with wsUrl and never echoes the permanent key', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ token: 'temp-abc', expires_in_seconds: 300 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await request(createApp({ ...baseConfig, assemblyApiKey: 'server-secret-value' }))
        .post('/api/voice/token')
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe('temp-abc');
      expect(res.body.data.expires_in_seconds).toBe(300);
      expect(res.body.data.wsUrl).toContain('agents.assemblyai.com');
      expect(JSON.stringify(res.body)).not.toContain('server-secret-value');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('returns non-2xx on missing key and rejects unexpected bodies', async () => {
    const missing = await request(createApp(baseConfig)).post('/api/voice/token').send({});
    expect(missing.status).toBe(503);
    const badBody = await request(createApp({ ...baseConfig, assemblyApiKey: 'k' }))
      .post('/api/voice/token')
      .send({ foo: 'bar' });
    expect(badBody.status).toBe(400);
  });

  it('maps an expired-token 401 from AssemblyAI to 502 without leaking the key', async () => {
    const fetchMock = vi.fn(async () => new Response('unauthorized', { status: 401 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await request(createApp({ ...baseConfig, assemblyApiKey: 'server-secret-value' }))
        .post('/api/voice/token')
        .send({});
      expect(res.status).toBe(502);
      expect(JSON.stringify(res.body)).not.toContain('server-secret-value');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('exposes the canonical agent config without secrets', async () => {
    const res = await request(createApp(baseConfig)).get('/api/voice/agent-config');
    expect(res.status).toBe(200);
    expect(res.body.data.sessionUpdate.session.tools[0].name).toBe('submit_action');
    // The public WS hostname is expected; the secret key name/value must never appear.
    expect(JSON.stringify(res.body)).toContain('agents.assemblyai.com');
    expect(JSON.stringify(res.body)).not.toMatch(/ASSEMBLYAI_API_KEY/i);
  });
});

describe('voice turn path via simulated tool.call', () => {
  it('submit_action(isolate_area) flows through /turn with from->to, rule, result, and full evidence', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;

    // Simulate what the browser does on tool.call for "Okay — I'll isolate the area first."
    const toolCall = parseToolCall({
      type: 'tool.call',
      call_id: 'call-isolate-1',
      name: 'submit_action',
      arguments: JSON.stringify({ intent: 'isolate_area', rationale: 'isolate first' }),
    });
    expect(toolCall).toMatchObject({ intent: 'isolate_area' });
    const { callId, intent } = toolCall as { callId: string; intent: string };

    const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({
      intent,
      userTranscript: "Okay — I'll isolate the area first.",
      toolCallId: callId,
    });
    expect(turn.status).toBe(200);
    expect(turn.body.data.state.current).toBe('area_isolated');
    expect(turn.body.data.evidence).toMatchObject({
      turn: 1,
      intent: 'isolate_area',
      from: 'unidentified_spill',
      to: 'area_isolated',
      scoreDelta: 10,
    });
    expect(turn.body.data.evidence.rule).toBe('unidentified_spill::isolate_area');
    expect(turn.body.data.evidence.result).toBe('applied');
    expect(typeof turn.body.data.evidence.timestamp).toBe('string');
    expect(turn.body.data.evidence.userTranscript).toContain('isolate the area');

    // "I'll clean it up." maps to clean_spill -> unsafe exposure path with penalty + evidence.
    const turn2 = await request(app).post(`/api/sessions/${sessionId}/turn`).send({
      intent: 'clean_spill',
      userTranscript: "I'll clean it up.",
      toolCallId: 'call-clean-1',
    });
    expect(turn2.status).toBe(200);
    expect(turn2.body.data.state.current).toBe('exposed');
    expect(turn2.body.data.scoreDelta).toBe(-10);
    expect(turn2.body.data.evidence.result).toBe('applied');
  });

  it('unknown intent from a tool call is rejected with 400 and evidence', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'teleport' });
    expect(turn.status).toBe(400);
    expect(turn.body.error.code).toBe('INVALID_INTENT');
    expect(turn.body.data.evidence.result).toBe('rejected');
  });

  it('duplicate submit for the same tool call is rejected with 409', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    const first = await request(app)
      .post(`/api/sessions/${sessionId}/turn`)
      .send({ intent: 'isolate_area', toolCallId: 'dup-call-1' });
    expect(first.status).toBe(200);
    const dup = await request(app)
      .post(`/api/sessions/${sessionId}/turn`)
      .send({ intent: 'isolate_area', toolCallId: 'dup-call-1' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('DUPLICATE_TURN');
  });
});
