import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { ServerConfig } from '../src/config.js';

const baseConfig: ServerConfig = {
  port: 3001,
  corsOrigin: 'http://localhost:5173',
  assemblyApiKey: undefined,
  assemblyTokenUrl: 'https://agents.assemblyai.com/v1/token',
};

describe('deploy: GET /healthz', () => {
  it('returns 200 with non-sensitive shape and default commit', async () => {
    const res = await request(createApp(baseConfig)).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.commit).toBe('string');
    expect(JSON.stringify(res.body)).not.toMatch(/ASSEMBLYAI|sk-/i);
  });

  it('reflects GIT_COMMIT without leaking secrets', async () => {
    const app = createApp({ ...baseConfig, assemblyApiKey: 'secret-value-xyz', gitCommit: 'abc1234' });
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', commit: 'abc1234' });
    expect(JSON.stringify(res.body)).not.toContain('secret-value-xyz');
  });
});

describe('deploy: API 404s stay JSON', () => {
  it('unknown /api path returns JSON NOT_FOUND, never HTML', async () => {
    const res = await request(createApp(baseConfig)).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('deploy: single-origin static serving', () => {
  it('serves index.html for non-API GETs and keeps /api JSON', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'voxtra-dist-'));
    fs.writeFileSync(path.join(dir, 'index.html'), '<html><body>VoxDrill</body></html>');
    try {
      const app = createApp(baseConfig, { staticDir: dir });
      const root = await request(app).get('/');
      expect(root.status).toBe(200);
      expect(root.text).toContain('VoxDrill');
      const api = await request(app).get('/api/health');
      expect(api.status).toBe(200);
      expect(api.body.ok).toBe(true);
      const missing = await request(app).get('/api/does-not-exist');
      expect(missing.status).toBe(404);
      expect(missing.body.ok).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('API-only mode (no staticDir) passes unknown non-API through', async () => {
    const res = await request(createApp(baseConfig)).get('/some-client-route');
    // No static dir: falls through to Express default 404 (not a crash).
    expect(res.status).toBe(404);
  });
});

describe('deploy: token observability without leakage', () => {
  it('counts token hits without exposing tokens or keys', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ token: 'temp-abc', expires_in_seconds: 300 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const app = createApp({ ...baseConfig, assemblyApiKey: 'server-secret' });
      const before = (app.locals.voiceMetrics as { tokenHits: number }).tokenHits;
      const res = await request(app).post('/api/voice/token').send({});
      expect(res.status).toBe(200);
      expect((app.locals.voiceMetrics as { tokenHits: number }).tokenHits).toBe(before + 1);
      expect((app.locals.voiceMetrics as { tokenSuccess: number }).tokenSuccess).toBe(1);
      expect(JSON.stringify(res.body)).not.toContain('server-secret');
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('deploy: config', () => {
  it('loadConfig honors PORT and GIT_COMMIT from env', () => {
    const cfg = loadConfig({ PORT: '8080', GIT_COMMIT: 'deadbee' } as NodeJS.ProcessEnv);
    expect(cfg.port).toBe(8080);
    expect(cfg.gitCommit).toBe('deadbee');
  });

  it('loadConfig defaults commit to unknown', () => {
    const cfg = loadConfig({} as NodeJS.ProcessEnv);
    expect(cfg.gitCommit).toBe('unknown');
  });
});
