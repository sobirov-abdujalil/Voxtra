import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { loadConfig } from './config.js';

// Load C:\Voxtra\.env by path (not cwd): npm --workspace runs with cwd=server/,
// which would otherwise miss the repo-root .env and leave voice unconfigured.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: path.join(repoRoot, '.env') });

const config = loadConfig();

// Fail fast in production when the voice key is missing: a deploy without the
// platform secret must crash loudly, never serve a silently voiceless app.
if (process.env.NODE_ENV === 'production' && !config.assemblyApiKey) {
  // eslint-disable-next-line no-console
  console.error('FATAL: ASSEMBLYAI_API_KEY is missing in production (set the platform secret, never commit it).');
  process.exit(1);
}

// Single-origin prod: serve the built web bundle (<repo>/web/dist) when present.
// Local dev (no dist, or SERVE_STATIC=0) keeps API-only mode behind the Vite proxy.
const webDist = path.join(repoRoot, 'web', 'dist');
const staticDir = process.env.SERVE_STATIC === '0' || !fs.existsSync(webDist) ? undefined : webDist;
const app = createApp(config, { staticDir });

app.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Voxtra server listening on :${config.port}${staticDir ? ' (serving web/dist)' : ''}`);
});
