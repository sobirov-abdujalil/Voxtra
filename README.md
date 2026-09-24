# VoxDrill (Voxtra)

VoxDrill is a voice-first simulation trainer for high-stakes workplace decisions. You speak your decisions out loud; a simulated emergency reacts to each one; and when the drill ends you get an after-action report where every point traces back to a logged decision. Scores are computed by deterministic code, not hallucinated by the language model.

## Live demo

<!-- DEPLOYED_URL -->

Local run instructions are below. The deployed public URL will replace this marker on go-live (health check at `<url>/healthz`).

## What makes it different

- **Branching reality.** Spoken decisions mutate a deterministic state machine (isolate the area and the scene changes; clean up early and you get exposed), not a chat transcript.
- **Deterministic engine.** State, transitions, scoring, and completion live in pure server-side TypeScript. The same input always produces the same output.
- **Explainable scores.** Every turn appends an evidence record (turn, intent, from-state, to-state, score delta). The report renders from that log alone.
- **Recovery, not dead ends.** Every unsafe action produces an explicit penalty plus a recovery hint, and self-correction is recorded and scored.

## How it uses the AssemblyAI Voice Agent API

- **Real-time speech.** The browser streams mic audio as PCM16 frames and plays agent audio back (`web/public/pcm-worklet.js`, `web/src/voice/session.ts`).
- **Neural turn detection with barge-in.** The session enables `input.turn_detection.interrupt_response`, and any new user turn drops the queued agent audio immediately (`PlaybackQueue.clearOnBargeIn()`).
- **Tool calling for intent classification.** The agent calls a single `submit_action` tool whose intent enum is exactly the active scenario's intent list. The browser POSTs it to `/api/sessions/:id/turn`, the engine adjudicates, and the consequence returns via `tool.result` (sent only after `reply.done`, so the agent never double-fires).
- **Session updates.** The first WebSocket message is an inline `session.update` (system prompt, greeting, voice, tools) built server-side per scenario and served at `GET /api/voice/agent-config?scenarioId=<id>`. Canonical builder: `server/src/voice/tools.ts`.
- **Server-side auth.** The browser never holds the AssemblyAI key. It receives only a short-lived, single-session token from `POST /api/voice/token` (`server/src/app.ts`); the raw key stays in the server `.env`.

Deliberately not used: stored agents (inline config keeps the tool enum next to the engine enum), keyterm prompting, and client-side session resumption (a dropped socket is surfaced with a recovery action; engine state survives under the same session id).

## The three scenarios

- **Warehouse Chemical Spill** — unidentified spill; safe sequence is isolate, notify, identify, document, then clean. Clean five-turn path scores 58/58.
- **Forklift Incident** — pedestrian struck; safe sequence is secure the scene, call 911 without moving the victim, notify, preserve evidence, file the report. Clean five-turn path scores 57/57.
- **Equipment Malfunction** — robotic arm re-energized with a technician in the cell; safe sequence is e-stop, lockout, evacuate, verify the technician, file the report. Clean five-turn path scores 65/65.

## How to run locally

Prerequisites: Node 24, npm, Chromium or Edge (recommended), a microphone.

```bash
npm install
npm run build --workspaces
Copy-Item .env.example .env   # then set ASSEMBLYAI_API_KEY= in .env (never commit it)
npm run start --workspace=server
```

Open http://localhost:3001 (the server serves the built web app single-origin).
For development instead: `npm run dev:server` plus `npm run dev:web`, then open http://localhost:5173.

Executable 3-minute demo: `docs/demo-script.md`. One-page summary: `docs/pitch.md`.

## How to run the tests

```bash
npm test --workspace=server   # 133 tests: engine, API, voice, no-secret-leakage
npm test --workspace=web      # 34 tests: report, drill UI, selection (jsdom)
npm run e2e                   # Playwright live voice goldens (needs ASSEMBLYAI_API_KEY; skips cleanly without)
npm run predemo               # unit + live token smoke + E2E, the pre-demo gate
npm audit --audit-level=high  # must report 0 vulnerabilities
```

## Architecture summary

The browser is thin: it captures audio, renders server-provided state, and owns no scoring logic. The Express server owns the deterministic scenario engine (`server/src/scenario/`), per-scenario definitions (`scenarios/*.json`), and AssemblyAI token minting. The voice layer interprets speech into an intent enum and nothing more; the engine decides every consequence and every point. Full design: `docs/architecture.md`.

## License

No LICENSE file is committed yet. Add one before submission if the hackathon rules require it (tracked in `docs/submission-checklist.md`).
