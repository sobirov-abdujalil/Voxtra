import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ServerConfig } from './config.js';
import { mintVoiceToken } from './integrations/assemblyai.js';
import { applyAction, buildReport } from './scenario/engine.js';
import { loadScenarios } from './scenario/loader.js';
import { SessionStore } from './services/sessions.js';
import { sanitizeTranscript } from './voice/sanitize.js';
import { VOICE_WS_URL, buildSessionUpdate, submitActionTool } from './voice/tools.js';

const TurnBody = z
  .object({
    intent: z.string().min(1).max(64),
    userTranscript: z.string().max(2000).optional(),
    toolCallId: z.string().min(1).max(128).optional(),
  })
  .strict();

const TokenBody = z.object({}).strict();

function sanitizeForLog(value: string): string {
  return value.replace(/[\r\n]/g, ' ').slice(0, 64);
}

export interface AppOptions {
  staticDir?: string;
  gitCommit?: string;
}

export interface VoiceMetrics {
  tokenHits: number;
  tokenSuccess: number;
  tokenFailure: number;
}

export function createApp(config: ServerConfig, options: AppOptions = {}): express.Express {
  const app = express();
  const scenarios = loadScenarios();
  const sessions = new SessionStore();
  // Idempotency guard: toolCallId -> seen per drill session (duplicate submit protection).
  const seenToolCalls = new Map<string, Set<string>>();
  const commit = options.gitCommit ?? config.gitCommit ?? process.env.GIT_COMMIT ?? 'unknown';
  // Deploy-time observability (in-memory only, never exposed publicly, never tokens/keys).
  const metrics: VoiceMetrics = { tokenHits: 0, tokenSuccess: 0, tokenFailure: 0 };
  app.locals.voiceMetrics = metrics;
  app.locals.commit = commit;

  // Helmet defaults set default-src 'self' with no connect-src, which would
  // make the browser refuse the cross-origin voice WebSocket. The page needs
  // same-origin /api/* ('self') plus exactly the AssemblyAI agent host —
  // allowlisted explicitly, never a wildcard.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'connect-src': ["'self'", 'wss://agents.assemblyai.com'],
        },
      },
    }),
  );
  app.use(cors({ origin: config.corsOrigin }));
  app.use(express.json({ limit: '32kb' }));

  // Minimal access log: method, path, status, latency only. Never bodies/tokens/keys.
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      // eslint-disable-next-line no-console
      console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
    });
    next();
  });

  const strictLimiter = rateLimit({ windowMs: 60_000, limit: 30 });
  app.use('/api/voice/token', strictLimiter);
  app.use('/api/sessions', strictLimiter);

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', commit });
  });

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
    const Body = z.object({ scenarioId: z.string().min(1).max(128).optional() });
    const parsed = Body.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'invalid body' } });
      return;
    }
    // Default to Warehouse so existing callers without a scenario id keep working.
    const scenarioId = parsed.data.scenarioId ?? 'warehouse-chemical-spill';
    const def = scenarios.get(scenarioId);
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
    // Duplicate-submit guard for voice tool calls sharing one turn.
    if (parsed.data.toolCallId) {
      let seen = seenToolCalls.get(session.id);
      if (!seen) {
        seen = new Set<string>();
        seenToolCalls.set(session.id, seen);
      }
      if (seen.has(parsed.data.toolCallId)) {
        res.status(409).json({
          ok: false,
          error: { code: 'DUPLICATE_TURN', message: 'tool call already submitted for this session' },
        });
        return;
      }
      seen.add(parsed.data.toolCallId);
    }
    const result = applyAction(def, session.state, parsed.data.intent);
    // Evidence continuity: enrich the engine-appended entry with the full shape.
    // Engine stays pure (rule/result only); wall-clock + transcript live here.
    const last = result.state.evidence[result.state.evidence.length - 1];
    if (last) {
      if (parsed.data.userTranscript !== undefined) {
        last.userTranscript = sanitizeTranscript(parsed.data.userTranscript);
      }
      last.timestamp = new Date().toISOString();
    }
    session.state = result.state;
    sessions.update(session);
    if (!result.ok) {
      res.status(400).json({
        ok: false,
        error: result.error,
        data: { consequence: result.consequence, state: result.state, evidence: last },
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
        evidence: last,
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

  // Canonical inline agent config (no secrets). The browser builds session.update
  // from this so the submit_action tool enum always matches the engine intent enum.
  // Per-scenario: ?scenarioId=<id> returns that scenario's enum (defaults to Warehouse).
  app.get('/api/voice/agent-config', (req, res) => {
    const raw = req.query.scenarioId;
    const scenarioId = typeof raw === 'string' && raw.length > 0 ? raw : 'warehouse-chemical-spill';
    const def = scenarios.get(scenarioId) ?? scenarios.get('warehouse-chemical-spill');
    const intents = def ? def.intents : [];
    const scenario = def ? { id: def.metadata.id, title: def.metadata.title } : undefined;
    res.json({
      ok: true,
      data: {
        wsUrl: VOICE_WS_URL,
        scenarioId: scenario?.id,
        sessionUpdate: buildSessionUpdate(intents, scenario),
        submitActionTool: submitActionTool(intents, scenario?.id),
      },
    });
  });

  // Short-lived voice session material. POST with an empty body (strict validation).
  // The raw AssemblyAI key NEVER leaves the server and is NEVER included in the response.
  // Never logs the permanent key or the temporary token.
  app.post('/api/voice/token', async (req, res) => {
    metrics.tokenHits += 1;
    const bodyParsed = TokenBody.safeParse(req.body ?? {});
    if (!bodyParsed.success) {
      metrics.tokenFailure += 1;
      res.status(400).json({ ok: false, error: { code: 'BAD_REQUEST', message: 'unexpected body' } });
      return;
    }
    if (!config.assemblyApiKey) {
      metrics.tokenFailure += 1;
      res.status(503).json({
        ok: false,
        error: { code: 'VOICE_UNCONFIGURED', message: 'Voice agent not configured on server' },
      });
      return;
    }
    try {
      const token = await mintVoiceToken(config.assemblyApiKey, config.assemblyTokenUrl, 300);
      metrics.tokenSuccess += 1;
      // eslint-disable-next-line no-console
      console.log('voice token mint succeeded');
      res.json({
        ok: true,
        data: { token: token.token, expires_in_seconds: token.expires_in_seconds, wsUrl: VOICE_WS_URL },
      });
    } catch (err) {
      metrics.tokenFailure += 1;
      // eslint-disable-next-line no-console
      console.error(`voice token mint failed: ${sanitizeForLog((err as Error).message)}`);
      res.status(502).json({ ok: false, error: { code: 'VOICE_TOKEN_FAILED', message: 'Could not mint voice token' } });
    }
  });

  // Single-origin production serving: when a built web/ bundle directory is
  // provided (Render Etc: <repo>/web/dist), serve it from the same origin so
  // the token endpoint stays same-origin (no CORS surface). No new dependency.
  const staticDir = options.staticDir && fs.existsSync(options.staticDir) ? options.staticDir : undefined;
  if (staticDir) {
    app.use(express.static(staticDir, { maxAge: '1h', index: false }));
  }

  // SPA fallback: unknown non-API GETs serve the web entry so #/... hash routes
  // work on refresh. Unknown /api paths stay JSON 404s (never HTML).
  app.use((req, res, next) => {
    if (req.method !== 'GET') {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
        return;
      }
      next();
      return;
    }
    if (req.path.startsWith('/api/') || req.path === '/healthz') {
      res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: 'Not found' } });
      return;
    }
    if (!staticDir) {
      next();
      return;
    }
    const entry = path.join(staticDir, 'index.html');
    res.sendFile(entry);
  });

  // Fallback error handler: never leak internals or secrets.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Unexpected error' } });
  });

  return app;
}
