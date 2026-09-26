# VoxDrill — Deployment (Render)

> Status 2026-09-26: LIVE at https://voxtra.onrender.com/ (single web service).
> Remaining: full deployed E2E twice Green after the CSP fix redeploys, then M5 credit.
> The deploy itself was unblocked 2026-09-25/26 (user-provided URLs: repo + Render service).
> This doc is the exact runbook — `DEPLOYED_URL=https://voxtra.onrender.com/`.

## Platform and why

Render (free tier), per `docs/decisions.md` 2026-09-22:

- Long-lived Node 24 process with outbound WebSocket to
  `wss://agents.assemblyai.com` (no serverless timeout).
- Public HTTPS by default — mandatory, because `getUserMedia` requires a
  secure context (HTTP would silently fail at the mic step).
- Env-var secret injection for `ASSEMBLYAI_API_KEY` (dashboard secret,
  never in git/Dockerfile/logs).
- Automatic TLS, Git-based redeploys, `GET /healthz` health check.

## What the production build does

- `npm run build --workspaces` builds `server/` (`tsc`) + `web/` (`vite`).
- `npm run start --workspace=server` (`node server/dist/index.js`) serves
  both from one origin: `web/dist` via `express.static` + the `/api/*` API.
  Same origin means the token endpoint is same-origin (no CORS surface);
  the browser uses relative `/api/*` and the `wsUrl` from
  `GET /api/voice/agent-config`.
- Server binds `process.env.PORT` (Render injects it), `NODE_ENV=production`
  disables dev-only behavior, and the server exits non-zero at boot when
  `ASSEMBLYAI_API_KEY` is missing in production.
- `GET /healthz` → `{ status: 'ok', commit: <GIT_COMMIT|unknown> }` (200,
  no sensitive data). No public `/metrics` by design (see decisions).
  Logs carry method/path/status/latency + token-mint success/failure only.

## First deploy (exact steps)

Prerequisites (user): GitHub account + Render account (sign in with GitHub,
free tier, no card). Install + auth `gh` once, or do the git steps in the
dashboard manually. Never paste secrets into chat.

1. Create a **private** GitHub repo (dashboard, or with `gh`):
   `gh repo create voxdrill --private --source=. --remote=origin`
2. Push the current branch (no force, no history rewrite, `.env` stays
   untracked):
   `git remote add origin <repo-url>` (if step 1 was manual)
   `git push -u origin main`
3. In Render: New → Web Service → connect the repo.
   Build command: `npm install && npm run build --workspaces`
   Start command: `npm run start --workspace=server`
   Health check path: `/healthz`
   (These are also in `render.yaml` — Render picks them up.)
4. In Render → Environment: add secret `ASSEMBLYAI_API_KEY` = your
   AssemblyAI key (secret type, never plain text). Confirm it shows as a
   secret, not in build logs. Optional: `CORS_ORIGIN=https://<service>.onrender.com`,
   `GIT_COMMIT=<sha>`.
5. Deploy. Capture the log (redact anything sensitive) and the URL:
   `DEPLOYED_URL=https://<service>.onrender.com` (HTTPS only — never publish HTTP).
6. Verify (definition of done — all from a shell with the key in `.env`):
   `curl -sS <DEPLOYED_URL>/healthz` → 200 `{ status: 'ok', ... }`
   `BASE_URL=<DEPLOYED_URL> npm run e2e` → golden path 5 turns, 58/58,
   no key in traffic, mic live over HTTPS via fake devices.
   `grep -R "ASSEMBLYAI_API_KEY" web/dist/` → nothing.
7. Record the exact URL here and in `docs/demo-script.md`.

Current `DEPLOYED_URL`: https://voxtra.onrender.com/ (live 2026-09-26 — single Render web service, API + web same origin; verified `/healthz` 200 JSON, `/api/*` JSON, `POST /api/voice/token` 200).

> Vercel retired (Option A, 2026-09-26): https://web-eta-bay-67.vercel.app/ served the static frontend only (no Express API; `/api/*` → Vercel 404). Vercel cannot host this backend (serverless, no persistent process, no same-origin static+API). Render is the sole deployment platform — do not submit the Vercel URL.

## Redeploy after a change

Git-based: `git push origin main` → Render rebuilds and restarts.
Idempotent: redeploying the same commit must yield a working URL — verify
with `curl <DEPLOYED_URL>/healthz` + a quick `BASE_URL=<URL> npm run e2e`
after any infra change.

## Rollback

Render → service → Deploys → pick the previous successful deploy → Rollback.
Then `curl -sS <DEPLOYED_URL>/healthz` and confirm the report route loads.
If the bad deploy was a code regression, `git revert` the commit locally,
push, and let Render roll forward instead.

## Secret rotation (ASSEMBLYAI_API_KEY)

1. Revoke/create the key in the AssemblyAI dashboard.
2. Render → Environment → update `ASSEMBLYAI_API_KEY` → Save (restart/redeploy).
3. `curl -sS <DEPLOYED_URL>/healthz` → 200; run one live token probe:
   `POST <DEPLOYED_URL>/api/voice/token` with `{}` → 200 with a temp token.
4. Never commit, echo, or log the value. Old key must not appear in any log.

## Logs

Render → service → Logs: request lines (`METHOD path status ms`), token-mint
success/failure (no tokens/keys/bodies). `sessionId` correlation comes from
the app-level evidence/report flow.

## Known limitations (free tier)

- Cold starts: first request after sleep can take 30–60s. E2E uses a 60s
  navigation timeout and 30s action timeout for this reason.
- Sleep on inactivity: the demo should warm the URL (`/healthz`) a minute
  before showtime.
- Concurrent connections: hackathon scale only; no load claims.
- Chromium is the demo browser (Firefox/Safari resample path is
  best-effort per `docs/decisions.md`).
