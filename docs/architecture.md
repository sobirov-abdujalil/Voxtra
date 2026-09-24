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
- `scenarios/` — declarative JSON scenario definitions (`warehouse-chemical-spill.json`,
  `forklift-incident.json`, `equipment-malfunction.json`, loaded by id via `server/src/scenario/loader.ts`).
- `server/tests/` — Vitest suites (engine, API, no-secret-leakage).
- `.opencode/` — OpenCode-native agents + skills adapted from ECC.

## Technology choices (why)

- **Browser: Vite + vanilla TypeScript (not Next.js).** The client is deliberately thin: it
  renders server-provided state and streams audio. No SSR, routing, or server components are
  needed, so Next.js would add framework churn without benefit. Vite gives instant dev
  startup and a static build; vanilla TS (no React) keeps the skeleton dependency-free
  until UI complexity justifies a framework (M3 decision point).
- **Backend: Node + Express (not Fastify).** The API is a small JSON surface
  (health/scenarios/sessions/turn/report/voice-token) plus one outbound token-mint call.
  Express is the most ubiquitous, stable choice; throughput is not a differentiator at
  hackathon scale. Fastify's speed matters only under load we will not have.
- **Tests: Vitest.** Native ESM + TypeScript support, same toolchain as Vite, fast watch
  mode. `zod` for POST-body validation with allowlisted intent enums.

## AssemblyAI Voice Agent design (verified, official docs as source of truth)

References: https://www.assemblyai.com/docs/voice-agents/voice-agent-api,
https://www.assemblyai.com/docs/api-reference/voice-agent-api/generate-voice-agent-token,
https://www.assemblyai.com/docs/voice-agents/voice-agent-api/browser-integration.

1. **Auth.** Server calls `GET https://agents.assemblyai.com/v1/token?expires_in_seconds=300`
    with header `Authorization: Bearer <ASSEMBLYAI_API_KEY>` → `{ token, expires_in_seconds }`.
    Tokens are one-time use, single session. Our endpoint `POST /api/voice/token` (empty JSON
    body `{}`, strict validation, 400 on unexpected bodies, existing 30/min rate limit) returns only
    `{ token, expires_in_seconds, wsUrl }`. The raw key never leaves the server and is never logged.
2. **Browser connect.** `wss://agents.assemblyai.com/v1/ws?token=<token>` (query param, since
    browsers cannot set WS headers). First message MUST be `session.update` with the INLINE config
  (decision 2026-09-20: inline over stored `agent_id`; canonical builder in
     `server/src/voice/tools.ts`, served per-scenario via `GET /api/voice/agent-config?scenarioId=<id>`
     (defaults to Warehouse), sent by
      `web/src/voice/session.ts`). Inline config carries the `submit_action` tool whose intent enum
      is exactly that session's scenario `def.intents` (Warehouse 8, Forklift 14, Equipment 14), plus `input.turn_detection.interrupt_response: true`
     for barge-in (a top-level `session.interrupt_response` is rejected live with
     `invalid_format` — found by the 2026-09-20 live smoke), `output.voice: 'alba'`
     (must be a documented voice id; 'ivy' is not one), and a system prompt with a
     single-fire discipline (exactly one call per trainee utterance, never while silent).
     Forklift additionally carries turn discipline (2026-09-22 mapping fix):
     complete-actionable-turn vs fragment/acknowledgement (no tool call at all for
     a fragment turn, fire immediately on complete utterances — delaying a call
     records it against the wrong turn, observed live), each required step once
     (tool.result "already done" means move on), optional intents only on clear
     performance (never on mention/acknowledgement/implication), and the
     keep-still→call_emergency disambiguation ("do not move him" is part of the
     emergency call, never preserve_scene). The Forklift tool schema attaches a
      per-intent guide (positive trigger + do-NOT-use guard per intent) to the
      intent enum description; the Warehouse schema keeps its exact historic shape
      (regression-pinned, no intent description) so its mapping is untouched.
      Equipment reuses the same two mechanisms with its own content (2026-09-23):
      the Task 9 prompt skeleton (fragment no-fire, immediate-fire, each-step-once,
      optional-only-on-performance) with Equipment text — "stop it" is hit_estop,
      "cut the power / lock it out" is isolate_power, checking the person is
      verify_technician (not evacuate_area), filing the report is document_incident
      (not brief_team), going in yourself is enter_cell (unsafe) — plus an
      Equipment-only per-intent tool guide guarding the same confusions. The
      Forklift prompt and guide are byte-identical to the Task 9 fix; the
      Equipment branch is purely additive in `server/src/voice/tools.ts`.
3. **Audio.** Client streams PCM16 mic audio; receives PCM16 agent audio. Browser
    `getUserMedia({ echoCancellation: true, noiseSuppression: false })` gives free echo cancellation.
    Capture runs in `web/public/pcm-worklet.js` (`voxtra-pcm-capture`): mono downmix, linear resample
    to 24kHz when the context rate differs (Firefox/Safari path; Chromium requests 24kHz directly via
    `new AudioContext({ sampleRate: 24000 })`), fixed 480-sample (20ms) PCM16 frames posted as
    transferable ArrayBuffers, sent as `input.audio` base64 only after `session.ready`. Agent audio
    (base64 PCM16 24kHz) is decoded via `pcm16ToFloat` into `AudioBuffer`s and played through the same
    context; any new user turn triggers `PlaybackQueue.clearOnBargeIn()` (drop queue + stop source).
4. **Events.** User partials (`transcript.user.delta`) + finals (`transcript.user` — note: no
     "final" in the name; substring heuristics miss it), agent audio (`reply.audio`, base64 in
     `data`), agent captions (`transcript.agent(.delta)`), tool calls (`tool.call`, `arguments`
     is a dict), turn markers (`reply.started`, `input.speech.started`, `reply.done` with
     `status: completed|interrupted`), lifecycle (`session.ready`, `session.updated`,
     `session.ended`, `session.error`).
     Turn detection and interruption are built in. Orchestration lives in `web/src/voice/session.ts`
     (`startVoiceDrill`, user-gesture gated): waits for `session.ready` before streaming, renders
     transcripts via `textContent` only (after `sanitizeTranscript`; agent captions render-only,
     `lastFinal` comes exclusively from user finals), holds `tool.result` until `reply.done` is
     the latest event (`web/src/voice/tool-gate.ts`; interrupted replies drop stale results —
     sending earlier makes the agent refire the tool), and shuts down with `session.end`
     before WS close + worklet disconnect + mic release. No silent catch blocks — every WS/mic/decode
     error surfaces to the UI and a log line.
5. **Tool calling.** Custom functions via JSON Schema. Our tools map ONLY to
     `POST /api/sessions/:id/turn` with allowlisted intent enums — the engine adjudicates.
     `tool.call(submit_action)` → browser POSTs `{ intent, userTranscript, toolCallId }` → engine
     applies → browser replies `tool.result` (`{ call_id, result, is_error? }` — no `ok` field)
     once `reply.done` is latest, and renders state + evidence.
     Duplicate `toolCallId`s per drill session are rejected with `409 DUPLICATE_TURN`.
6. **Resilience.** Session resumption within ~30s on socket drop; client-side timer for
   `max_session_duration_seconds`; graceful end via `session.end` before close.
7. **Deterministic boundary.** Voice layer interprets language → intent. It never decides state,
   score, or completion. Unknown/garbled speech → `unknown` intent → engine rejects safely.

## Scenario engine (M4: three scenarios, one engine, 2026-09-23)

- Pure `applyAction(definition, state, intent) → { ok, state, consequence, scoreDelta, completed }`.
- No I/O, network, clock, or randomness inside transitions. Same input → same output.
- Intent allowlist is per-scenario (`def.intents.includes(intent)` → `INVALID_INTENT`
  otherwise); the historic global `INTENTS` remains only as the Warehouse default.
- Failure states and recovery are data-driven: `def.failureStates` (Warehouse absent →
  `{'exposed','abandoned'}`; Forklift `[]` because invalid actions are self-loop penalties
  with no state change) feeds denominator/maxScore exclusion, and
  `def.recoveryIntents` (`['reassess','correct_course']` on Forklift) feeds
  `breakdown.recovery` alongside failure-state exits. No per-scenario branch in the engine.
- `POST /api/sessions` accepts `{ scenarioId }` and defaults to Warehouse when omitted;
  `GET /api/voice/agent-config?scenarioId=<id>` returns that scenario's tool enum +
  system prompt/greeting (Warehouse prompt byte-stable).
- Warehouse: 5-turn golden 58/58, denominator 58, maxScore 93. Forklift: 5-turn golden
  57/57 (12+11+9+10+15), denominator 57, maxScore 113 (each positive self-loop once).
  Equipment: 5-turn golden 65/65 (15+15+10+10+15), denominator 65, maxScore 121
  (each positive self-loop once). Unlike Warehouse (document → clean), filing the report closes the Forklift and
  Equipment drills, so the
  `documented` flag lands on the `resolved` transition with no separate documented state.

- Pure `applyAction(definition, state, intent) → { ok, state, consequence, scoreDelta, completed }`.
- No I/O, network, clock, or randomness inside transitions. Same input → same output.
- Every turn appends `{ turn, intent, from, to, scoreDelta, rule, result }` (engine, deterministic);
  the API layer enriches the appended entry with `{ userTranscript (sanitized), timestamp (ISO) }`
  for the full evidence shape `{ turn, userTranscript, intent, from, to, rule, result, scoreDelta, timestamp }`.
- `completed` computed from state + `completionCriteria` (state `resolved` + required flags
  `isolated, notified, inspected, documented, cleaned`).
- States include `documented` (via `document_incident` +10 from `ready_for_cleanup`;
  `clean_spill` +20 from `documented` to `resolved`; `document_incident` +10 from
  `resolved` covers clean-then-document ordering). Critical actions are the five safe
  required intents (`isolate_area, notify_supervisor, inspect_label, document_incident, clean_spill`).
- Report (`buildReport`) renders from the log alone: headline `score`, explicit
  `denominator` (58 = strict-progress max 10+10+8+10+20, no self-loop stays), `maxScore`
  (93 = all positive self-loop bonuses taken once), one-sentence `summary`, and a
   `breakdown` (completed/missed/invalid/recovery/penalties, each entry referencing a turn).
   Headline contract (2026-09-22 H4 fix, option A): `headlineScore` (raw total minus
   bonus excess) + `bonusPoints` (max(0, score − denominator); 0 on clean goldens);
   `score` stays the raw deterministic total. The web report view renders
   `#report-score` as `headlineScore / denominator` (numerator never above
   denominator) plus a separate `#report-bonus` line (`+N bonus points`, only when
   N > 0), so extra credit stays visible without competing with the headline.
   Summaries never emit a fraction with numerator > denominator (e.g. a 59-point
   Forklift run reads `57/57 (+2 bonus)`).
   The web report view (`web/src/report.ts`, hash route `#/report/:id`) renders the score
   header, breakdown panels, and evidence timeline with decision replay (breakdown click
   highlights timeline rows; timeline click expands the full record), using textContent only.
   See `.opencode/skills/scenario-engine/SKILL.md`.

## Web routing convention (M3, 2026-09-22)

Hash routes in the single Vite app (no router dependency; `parseHashRoute` in
`web/src/drill-ui.ts` is the single parser):

- `#/` (or empty hash) — **scenario selection screen**: product tagline, three
  scenario cards (Warehouse Chemical Spill + Forklift Incident + Equipment
  Malfunction, all active with their Start CTAs since M4 completed 2026-09-23;
  no "Coming soon" badge remains), `#how-it-works` strip (Speak → Scenario reacts → Evidence
  recorded → After-action report), `#mic-guidance` footer (Chromium recommended).
- `#/drill` — **drill view** for the selected scenario (`selectedScenarioId`,
  default Warehouse; `#select-forklift` / `#select-equipment` switch def, intent buttons, labels,
  required flags, title, and voice agent-config): session/voice controls, single mic indicator
  (`#mic-state` keeps the session machine value `idle|requesting|live|denied|
  stopped|error` for tests; `#mic-label` shows the human label from the same
  `onMicState` callback — one source of truth), human scenario label
  (`#scenario-label`, ids mapped via the scenario definition's `states[].label`
  with a snake_case-humanize fallback, never raw), progress indicator
  (`#progress-indicator`, "N of 5 required actions completed" from
  `state.flags` × `completionCriteria.requiredFlags`), live transcript
  (partial italic vs final list, auto-scroll inside `#transcript-final-wrap`
  only), drill-time timeline (`#drill-timeline-list`, one row per evidence
  entry: turn, intent chip, human from→to, signed delta), barge-in cue
  (`#barge-cue`, visible exactly when mic-state is `live`), error surface
  (`#drill-error` role=alert + `#drill-error-dismiss` recovery action; every
  voice/API failure shows a plain-language message there, never silent), and
  the terminal `#open-report` CTA (shown only when completed, no
  auto-navigation). `#state` still renders raw JSON for debugging/E2E.
- `#/report/:id` — **after-action report** (Task 4 information architecture
  unchanged: score header, breakdown, timeline, replay).

Top nav: `#nav-home` → `#/`, `#nav-drill` → `#/drill`, `#nav-report` → current
session report (enabled only after a session exists), `#back-to-drill` →
`#/drill`. Styling is a single `<style>` block in `web/index.html` using shared
design tokens (type scale, 4px spacing scale, one color palette) across all
three views — no CSS framework, no new dependency. Motion is suppressed under
`prefers-reduced-motion`; `:focus-visible` outlines mark all CTAs. No `muted`
mic state exists (the session machine has no mute control), so the indicator
maps the six real states only.

## Security

- `ASSEMBLYAI_API_KEY` in server `.env` only. Never in `web/`, responses, logs, or git.
- `zod` validation on POST bodies; `400 INVALID_INTENT` on unknown intents.
- Rate limits on `/api/voice/token` + `/api/sessions*`; 32kb body cap; `helmet`; CORS allowlist.
- `npm audit --audit-level=high` gate. See `AGENTS.md` §5.

## Deployment (M5, 2026-09-22 — code ready, no URL yet)

- Single Render web service, same origin: `node server/dist/index.js` serves
  `web/dist` (`express.static`, no new dep) + `/api/*`. SPA fallback serves
  `index.html` for non-API GETs so `#/` hash routes work on refresh;
  unknown `/api/*` stays JSON `404 NOT_FOUND`.
- `GET /healthz` → `{ status: 'ok', commit }` (Render health check, no secrets).
  No public `/metrics` by design; in-memory token counters + access logs
  (method/path/status/latency, token success/failure only) surface via platform logs.
- Binds `process.env.PORT`; `NODE_ENV=production` with no key exits non-zero.
  Node 24 pinned (root + server `engines`, `.node-version`, `render.yaml`).
- Browser stays same-origin (`/api/*` relative, `wsUrl` from agent-config);
  outbound voice WS goes browser → AssemblyAI directly, never through our proxy.
- Deployed E2E: `BASE_URL=<https-url> npm run e2e` (no local `webServer`;
  HTTPS + `/healthz` + same-origin token guards run first). See `docs/deployment.md`.

## What is NOT verified yet

- End-to-end voice latency in target browsers — the golden-path drill now runs live in
  Chromium (see `docs/test-plan.md` automated E2E, 2026-09-20: 5 turns, score 58/58, resolved).
  Firefox/Safari resample path is implemented but UNVERIFIED (no test hardware; decision A in
  `docs/decisions.md`: best-effort + on-screen notice; Chromium is the demo browser).
- Real-human-mic drill with the production key — manual steps in `docs/test-plan.md`, needs user hardware.
