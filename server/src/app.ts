import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { z } from 'zod';
import type { ServerConfig } from './config.js';
import { mintVoiceToken } from './integrations/assemblyai.js';
import { applyAction, buildReport } from './scenario/engine.js';
import { loadScenarios } from './scenario/loader.js';
import { SessionStore } from './services/sessions.js';

const TurnBody = z.object({
  intent: z.string().min(1).max(64),
});

function sanitizeForLog(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 64);
}

export function createApp(config: ServerConfig): express.Express {
  const app = express();
  const scenarios = loadScenarios();
  const sessions = new SessionStore();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '32kb' }));

  const strictLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
  app.use('/api/voice/token', strictLimiter);
  app.use('/api/sessions', strictLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'up', scenarios: [...scenarios.keys()] } });
  });

  app.get('/api/scenarios', (_req, res) => {
    res.json({
      ok: true,
      data: [...scenarios.values()].map((d) => ({
        id: d.metadata.id,
        title: d.metadata.title,
        version: d.metadata.version,
        description: d.metadata.description,
        intents: d.intents,
        criticalActions: d.criticalActions,
      })),
    });
  });

  app.get('/api/scenarios/:id', (req, res) => {
    const def = scenarios.get(req.params.id);
    if (!def) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Scenario not found' } });
      return;
    }
    res.json({ ok: true, data: def });
  });

  app.post('/api/sessions', (req, res) => {
    const Body = z.object({ scenarioId: z.string().min(1).max(128) });
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'scenarioId required' } });
      return;
    }
    const def = scenarios.get(parsed.data.scenarioId);
    if (!def) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Scenario not found' } });
      return;
    }
    const session = sessions.create(def);
    res.status(201).json({ ok: true, data: { sessionId: session.id, state: session.state } });
  });

  app.get('/api/sessions/:id', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }
    res.json({ ok: true, data: { sessionId: session.id, state: session.state } });
  });

  app.post('/api/sessions/:id/turn', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }
    const def = scenarios.get(session.scenarioId);
    if (!def) {
      res.status(500).json({ ok: false, error: { code: 'SCENARIO_MISSING', message: 'Scenario missing' } });
      return;
    }
    const parsed = TurnBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'intent required' } });
      return;
    }
    const result = applyAction(def, session.state, parsed.data.intent);
    session.state = result.state;
    sessions.update(session);
    if (!result.ok) {
      res.status(400).json({
        ok: false,
        error: result.error,
        data: { consequence: result.consequence, state: result.state },
      });
      return;
    }
    res.json({
      ok: true,
      data: {
        consequence: result.consequence,
        scoreDelta: result.scoreDelta,
        completed: result.completed,
        state: result.state,
      },
    });
  });

  app.get('/api/sessions/:id/report', (req, res) => {
    const session = sessions.get(req.params.id);
    if (!session) {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Session not found' } });
      return;
    }
    const def = scenarios.get(session.scenarioId);
    if (!def) {
      res.status(500).json({ ok: false, error: { code: 'SCENARIO_MISSING', message: 'Scenario missing' } });
      return;
    }
    res.json({ ok: true, data: buildReport(session.state, def) });
  });

  // Short-lived voice session material. The raw AssemblyAI key NEVER leaves the server
  // and is NEVER included in the response.
  app.post('/api/voice/token', async (_req, res) => {
    if (!config.assemblyApiKey) {
      res.status(503).json({
        ok: false,
        error: { code: 'VOICE_UNCONFIGURED', message: 'Voice agent not configured on server' },
      });
      return;
    }
    try {
      const token = await mintVoiceToken(config.assemblyApiKey, config.assemblyTokenUrl, 300);
      res.json({ ok: true, data: { token: token.token, expires_in_seconds: token.expires_in_seconds } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`voice token mint failed: ${sanitizeForLog((err as Error).message)}`);
      res.status(502).json({ ok: false, error: { code: 'VOICE_TOKEN_FAILED', message: 'Could not mint voice token' } });
    }
  });

  // Fallback error handler: never leak internals or secrets.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Unexpected error' } });
  });

  return app;
}
