# Voxtra — Architecture

Status: foundation (verified Sep 2026 against official AssemblyAI docs).

## System overview

```
Browser mic (getUserMedia)
  → POST /api/voice/token (our server; short-lived material only)
  → wss://agents.assemblyai.com/v1/ws?token=<temp> (AssemblyAI Voice Agent)
  → transcript events → intent enum → POST /api/sessions/:id/turn
  → deterministic scenario engine (server/src/scenario/)
  → consequence + state → browser renders → next turn
  → GET /api/sessions/:id/report (evidence-based after-action report)
```

## Repos / workspaces

- `server/` — Express + TypeScript API, deterministic engine, AssemblyAI token minting. Node 24, npm.
- `web/` — Vite + TypeScript client. Renders server state; holds no secrets and no authoritative logic.
- `scenarios/` — declarative JSON scenario definitions (first: `warehouse-chemical-spill.json`).
- `server/tests/` — Vitest suites (engine, API, no-secret-leakage).
- `.opencode/` — OpenCode-native agents + skills adapted from ECC.

## AssemblyAI Voice Agent design (verified, official docs as source of truth)

References: https://www.assemblyai.com/docs/voice-agents/voice-agent-api,
https://www.assemblyai.com/docs/api-reference/voice-agent-api/generate-voice-agent-token,
https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration.

1. **Auth.** Server calls `GET https://agents.assemblyai.com/v1/token?expires_in_seconds=300`
   with header `Authorization: Bearer <ASSEMBLYAI_API_KEY>` → `{ token, expires_in_seconds }`.
   Tokens are one-time use, single session. Our endpoint `POST /api/voice/token` returns only
   `{ token, expires_in_seconds }`. The raw key never leaves the server.
2. **Browser connect.** `wss://agents.assemblyai.com/v1/ws?token=<token>` (query param, since
   browsers cannot set WS headers). First message MUST be `session.update` with either a stored
   `agent_id` (prompt/voice/tools loaded server-side) or inline `system_prompt`/`greeting`/`output`
   — the two modes are mutually exclusive.
3. **Audio.** Client streams PCM16 mic audio; receives PCM16 agent audio. Browser
   `getUserMedia({ echoCancellation: true, noiseSuppression: false })` gives free echo cancellation.
4. **Events.** Partial + final transcripts, agent audio, tool calls, lifecycle events
   (`session.ready`, `reply.done` with `interrupted` status on barge-in, `session.error`).
   Turn detection and interruption are built in.
5. **Tool calling.** Custom functions via JSON Schema. Our tools map ONLY to
   `POST /api/sessions/:id/turn` with allowlisted intent enums — the engine adjudicates.
6. **Resilience.** Session resumption within ~30s on socket drop; client-side timer for
   `max_session_duration_seconds`; graceful end via `session.end` before close.
7. **Deterministic boundary.** Voice layer interprets language → intent. It never decides state,
   score, or completion. Unknown/garbled speech → `unknown` intent → engine rejects safely.

## Scenario engine

- Pure `applyAction(definition, state, intent) → { ok, state, consequence, scoreDelta, completed }`.
- No I/O, network, clock, or randomness inside transitions. Same input → same output.
- Every turn appends `{ turn, intent, from, to, scoreDelta }` to the evidence log.
- `completed` computed from state + `completionCriteria` (state `resolved` + required flags).
- Report (`buildReport`) renders from the log. See `.opencode/skills/scenario-engine/SKILL.md`.

## Security

- `ASSEMBLYAI_API_KEY` in server `.env` only. Never in `web/`, responses, logs, or git.
- `zod` validation on POST bodies; `400 INVALID_INTENT` on unknown intents.
- Rate limits on `/api/voice/token` + `/api/sessions*`; 32kb body cap; `helmet`; CORS allowlist.
- `npm audit --audit-level=high` gate. See `AGENTS.md` §5.

## What is NOT verified yet

- Stored-agent provisioning (`POST /v1/agents`) for our account — needs a live key + decision on
  agent vs inline config (see `project-state/BLOCKERS.md`).
- End-to-end voice latency in target browsers — needs a live browser run (mocked for now).
