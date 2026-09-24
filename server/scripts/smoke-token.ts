/**
 * Live token smoke: exercises POST /api/voice/token against REAL AssemblyAI.
 *
 * - Starts the real Express app on an ephemeral port (loads .env via dotenv).
 * - POSTs {} to /api/voice/token, asserts { token, expires_in_seconds, wsUrl }.
 * - Asserts the response never contains the permanent API key value.
 * - Opens a REAL WebSocket to wsUrl + '?token=' + token, sends the canonical
 *   session.update from server/src/voice/tools.ts (same payload the browser
 *   sends first), waits for session.ready (15s bound), then sends session.end.
 * - Prints the observed event-type sequence. Never logs the key or the token
 *   (token length only).
 *
 * Skippable: SKIP_LIVE=1 exits 0 without network (for CI without a key).
 * Exit codes: 0 pass / 1 failure / 2 missing key.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { buildSessionUpdate } from '../src/voice/tools.js';
import type { AddressInfo } from 'node:net';

// Load the repo-root .env by path (not cwd): `npm run smoke:live --workspace=server`
// runs with cwd=server/, which would otherwise miss C:\Voxtra\.env.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const READY_TIMEOUT_MS = 15_000;

function mask(value: string): string {
  return `<${value.length} chars>`;
}

async function main(): Promise<void> {
  if (process.env.SKIP_LIVE === '1') {
    console.log('smoke-token: SKIP_LIVE=1, skipping live AssemblyAI check');
    return;
  }
  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    console.error('smoke-token: FAIL missing ASSEMBLYAI_API_KEY (create C:\\Voxtra\\.env with ASSEMBLYAI_API_KEY=<key>)');
    process.exitCode = 2;
    return;
  }

  const config = loadConfig();
  const app = createApp(config);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  const seen: string[] = [];
  const note = (t: string): void => {
    seen.push(t);
    console.log(`smoke-token: ws event: ${t}`);
  };

  let failed = false;
  let ws: WebSocket | null = null;
  try {
    const res = await fetch(`${base}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (res.status !== 200) throw new Error(`token endpoint HTTP ${res.status}`);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { token: string; expires_in_seconds: number; wsUrl: string };
    };
    if (!body.ok || !body.data) throw new Error('token endpoint body not ok');
    const { token, expires_in_seconds: expires, wsUrl } = body.data;
    if (typeof token !== 'string' || token.length === 0) throw new Error('token missing');
    if (!Number.isInteger(expires) || expires < 1 || expires > 600) {
      throw new Error(`expires_in_seconds out of range: ${expires}`);
    }
    if (typeof wsUrl !== 'string' || !wsUrl.includes('agents.assemblyai.com')) {
      throw new Error(`unexpected wsUrl: ${wsUrl}`);
    }
    if (JSON.stringify(body).includes(apiKey)) throw new Error('response leaks permanent key');
    console.log(`smoke-token: token minted (token=${mask(token)} expires_in_seconds=${expires} wsUrl=${wsUrl})`);

    const sessionUpdate = buildSessionUpdate();
    const ready = await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for session.ready (15s)')), READY_TIMEOUT_MS);
      ws = new WebSocket(`${wsUrl}?token=${encodeURIComponent(token)}`);
      ws.addEventListener('open', () => {
        note('open');
        ws?.send(JSON.stringify(sessionUpdate));
        note('session.update sent');
      });
      ws.addEventListener('message', (ev) => {
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        } catch {
          note('unparseable message');
          return;
        }
        const type = typeof msg['type'] === 'string' ? (msg['type'] as string) : 'unknown';
        note(type);
        if (type === 'session.ready') {
          clearTimeout(timer);
          resolve();
        } else if (type === 'session.error') {
          clearTimeout(timer);
          reject(new Error(`session.error: ${JSON.stringify(msg).slice(0, 300)}`));
        }
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('websocket error before session.ready'));
      });
      ws.addEventListener('close', () => {
        note('close');
      });
    });

    console.log('smoke-token: session.ready observed');
    try {
      ws?.send(JSON.stringify({ type: 'session.end' }));
      note('session.end sent');
    } catch {
      note('session.end send failed');
    }
    await new Promise((r) => setTimeout(r, 1000));
    console.log(`smoke-token: PASS events=[${seen.join(', ')}]`);
    void ready;
  } catch (err) {
    failed = true;
    console.error(`smoke-token: FAIL ${(err as Error).message}`);
    console.error(`smoke-token: events so far=[${seen.join(', ')}]`);
  } finally {
    try {
      ws?.close();
    } catch {
      // ignore close errors during teardown
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (failed) process.exitCode = 1;
}

void main();
