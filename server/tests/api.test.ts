import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import type { ServerConfig } from '../src/config.js';

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

describe('API: health and scenarios', () => {
  it('GET /api/health returns status and scenario list', async () => {
    const res = await request(createApp(baseConfig)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.scenarios).toContain('warehouse-chemical-spill');
  });

  it('GET /api/scenarios lists definitions without secrets', async () => {
    const res = await request(createApp(baseConfig)).get('/api/scenarios');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toMatch(/ASSEMBLYAI|sk-/i);
  });
});

describe('API: session turn loop', () => {
  it('creates a session and runs a valid turn', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    expect(created.status).toBe(201);
    const sessionId = created.body.data.sessionId as string;

    const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'isolate_area' });
    expect(turn.status).toBe(200);
    expect(turn.body.data.state.current).toBe('area_isolated');
    expect(turn.body.data.scoreDelta).toBe(10);
  });

  it('rejects unknown intent with 400 INVALID_INTENT', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'teleport' });
    expect(turn.status).toBe(400);
    expect(turn.body.error.code).toBe('INVALID_INTENT');
  });

  it('rejects missing intent with 400', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    const turn = await request(app).post(`/api/sessions/${sessionId}/turn`).send({});
    expect(turn.status).toBe(400);
  });

  it('returns 404 for unknown session', async () => {
    const res = await request(createApp(baseConfig)).post('/api/sessions/nope/turn').send({ intent: 'isolate_area' });
    expect(res.status).toBe(404);
  });

  it('report renders from the evidence log', async () => {
    const app = createApp(baseConfig);
    const created = await request(app).post('/api/sessions').send({ scenarioId: 'warehouse-chemical-spill' });
    const sessionId = created.body.data.sessionId as string;
    await request(app).post(`/api/sessions/${sessionId}/turn`).send({ intent: 'isolate_area' });
    const report = await request(app).get(`/api/sessions/${sessionId}/report`);
    expect(report.status).toBe(200);
    expect(report.body.data.score).toBe(10);
    expect(report.body.data.evidence).toHaveLength(1);
  });
});

describe('API: no secret leakage', () => {
  it('never exposes the AssemblyAI key in any response', async () => {
    const app = createApp({ ...baseConfig, assemblyApiKey: 'test-key-redacted-value' });
    const paths = ['/api/health', '/api/scenarios'];
    for (const p of paths) {
      const res = await request(app).get(p);
      expect(JSON.stringify(res.body)).not.toContain('test-key-redacted-value');
    }
  });

  it('POST /api/voice/token without server key returns 503, not the key', async () => {
    const res = await request(createApp(baseConfig)).post('/api/voice/token');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toMatch(/ASSEMBLYAI/i);
  });

  it('POST /api/voice/token proxies mint without leaking key (mocked fetch)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'temp-123', expires_in_seconds: 300 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const res = await request(createApp({ ...baseConfig, assemblyApiKey: 'server-secret' })).post('/api/voice/token');
      expect(res.status).toBe(200);
      expect(res.body.data.token).toBe('temp-123');
      expect(JSON.stringify(res.body)).not.toContain('server-secret');
      expect(fetchMock).toHaveBeenCalledOnce();
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toContain('agents.assemblyai.com/v1/token');
      expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer server-secret');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
