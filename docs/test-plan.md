# Voxtra — Test Plan

## Targets

- 80%+ coverage on touched modules. No placeholder tests.

## Suites

1. **Engine** (`server/tests/engine.test.ts`, 17 tests): five-turn golden path
   (isolate 10 + notify 10 + inspect 8 + document 10 + clean 20 = 58, resolved),
   clean-before-document ordering, invalid/critical actions, unknown intents,
   determinism/purity, scoring + evidence chain, denominator (58) + maxScore (93),
   document transition/rule/delta, breakdown (invalid/penalty/recovery turns),
   recovery paths, completion criteria (now requiring `documented`).
    Forklift (`server/tests/forklift.test.ts`, 15 tests): five-turn golden
    (secure 12 + call 11 + notify 9 + preserve 10 + document 15 = 57, resolved),
    every invalid self-loop penalty with no transition, unknown + cross-scenario
    intents rejected, recovery intents recorded, denominator (57) + maxScore (113),
    determinism, Warehouse regression (58/58 unchanged); loader asserts both
    scenarios load independently with distinct intents.
    Equipment (`server/tests/equipment.test.ts`, 17 tests, 2026-09-23): five-turn golden
    (estop 15 + isolate 15 + evacuate 10 + verify 10 + document 15 = 65, resolved),
    every invalid self-loop penalty with no transition (enter_cell −15 highest),
    unknown + cross-scenario intents rejected both directions, recovery intents
    recorded, denominator (65) + maxScore (121), determinism, Warehouse (58/58)
    + Forklift (57/57, 113) regression; loader asserts all three scenarios load
    independently with distinct intents. Zero engine changes.
2. **API** (`server/tests/api.test.ts`, 13 tests): health, scenario listing, session
   create/turn/report, report breakdown for completed/invalid/penalty drills
   (denominator 58, summary, full evidence), validation errors (`INVALID_INTENT`,
   `BAD_REQUEST`, `NOT_FOUND`), no-secret-leakage (responses never contain the key;
   token mint mocked at fetch boundary).
     Forklift API (`server/tests/forklift-api.test.ts`, 10 tests): forklift session
     golden (57/57, five completed, zero missed/invalid), session-create default to
     Warehouse, invalid-then-recovery path, Warehouse regression, per-scenario
     agent-config enums (Warehouse-only vs Forklift-only, default Warehouse,
     enum equals def intents), `parseToolCall` allowlist + prompt/greeting per scenario.
     Equipment API (`server/tests/equipment-api.test.ts`, 11 tests, 2026-09-23):
     equipment session golden (65/65, five completed, zero missed/invalid, headline
     65 + zero bonus), invalid-then-recovery path (enter_cell −15, reassess),
     Warehouse + Forklift golden regression in the same suite, per-scenario
     agent-config enums for all three (exact match to def intents, no
     cross-contamination), equipment intent guide guards (estop-vs-isolate,
     evacuate-vs-enter, verify-vs-evacuate, document-vs-brief, optional-only),
     equipment prompt skeleton (fragment no-fire, immediate fire, each-step-once,
     optional-only-on-performance), Warehouse no-description + Forklift guide
     stability.
     Forklift mapping (`server/tests/forklift-mapping.test.ts`, 11 tests, 2026-09-22):
    prompt turn discipline (fragment no-fire + immediate fire, optional-only-on-performance,
    preserve_scene disambiguation, each-step-once), Warehouse prompt + tool description
    byte-stability pins, Forklift per-intent guide via unit + agent-config route,
    report headline invariant (bonus run caps at 57/57 +2, clean goldens unchanged on
    both scenarios, penalized run never inflates).
3. **Security**: `npm audit --audit-level=high`; secret-pattern scan of `web/` + diffs.
4. **Browser report UI** (`web/tests/report.test.ts`, 6 tests, jsdom): denominator renders,
   breakdown entries link to the correct turn, clicking a breakdown entry highlights the
   correct timeline row, transcripts render as text (no HTML injection), timeline rows
   expand in place, negative deltas are distinct.
     Forklift DOM (`web/tests/forklift.test.ts`, 5 tests): forklift state labels from
     scenario data, progress from forklift flags, timeline rows with signed deltas,
     report 57/57 with five completed + five timeline rows, penalty rows distinct.
     Equipment DOM (`web/tests/equipment.test.ts`, 5 tests, 2026-09-23): equipment
     state labels from scenario data, progress from equipment flags, timeline rows
     with signed deltas, report 65/65 with five completed + five timeline rows,
     penalty rows distinct.
     Report headline (`web/tests/report-score.test.ts`, 4 tests, 2026-09-22): bonus run
     caps at 57 / 57 with a separate `+2 bonus` line, clean golden shows no bonus line,
     defensive cap when the server omits the new fields, penalized run never inflates.
    Selection (`web/tests/selection.test.ts`): all three scenarios enabled with
    Start CTAs and no Coming-soon badge (M4 complete 2026-09-23).
5. **Evals** (next task): phrase→intent mapping quality (`tests/evals/`), pass@k on voice paths,
   results in `project-state/REGRESSIONS.md`.
6. **Voice loop** (`server/tests/voice.test.ts`, 20 tests): PCM16 round-trip, downsample frame counts,
   sanitizer, barge-in queue, tool schema + parse/reject paths, token shape/no-leak/400/502,
   simulated tool.call → /turn evidence shape, duplicate-submit 409.
   Browser playback regression (`web/tests/audio-playback.test.ts`, 5 tests, 2026-09-26):
   480-sample/960-byte decode at 24kHz, gapless scheduler contiguity (20ms chunks slot
   with no gap/overlap), late-arrival slots at now, reset on barge-in/interrupted,
   static wiring (gapless schedule + 24kHz buffers + echoCancellation:true /
   noiseSuppression:false, no `currentSrc` chaining). Guards the g-g-g fix.
7. **Screenshots** (`docs/screenshots/` + README, 2026-09-26): selection / drill
   (2 turns) / report (5/5) at 1920×1080 + 390×844, captured from single-origin
   `http://localhost:3001/` via text intents (no voice needed for layout). No
   horizontal scroll, no console errors, all frozen selectors preserved.

## Manual live voice drill (Chromium; needs mic + real key)

Server `npm run dev --workspace=server`, web `npm run dev --workspace=web` (proxy `/api` → :3001).

1. Open the web app, click **Start drill session** (creates `POST /api/sessions`), then **Start drill
   (voice)** (user gesture → mic permission → `POST /api/voice/token` → WS `?token=` →
   `session.update` first → wait for `session.ready` → mic streams `input.audio`).
2. Speak: **"I'll clean it up."** → expect partial + final transcript lines, a `submit_action`
   tool call with `intent: clean_spill`, turn `unidentified_spill → exposed`, `scoreDelta: -15`,
   an evidence record `{ turn, userTranscript, intent, from, to, rule, result, scoreDelta, timestamp }`,
   and the agent speaking the exposure consequence. (Note: there is no `invalid_action` intent —
   unsafe shortcuts are real transitions with penalties; unknown speech maps to nothing and the
   engine rejects with `INVALID_INTENT`.)
3. Speak: **"Okay — I'll isolate the area first."** → expect `submit_action(isolate_area)`,
   transition toward `area_isolated`, `scoreDelta` per JSON, and a second evidence record.
4. Interrupt the agent mid-sentence (start speaking) → expect agent audio to stop immediately
   (barge-in: queue dropped, current source stopped) and the new turn to begin.
5. Click **Stop voice** → expect `session.end` sent, worklet stopped, mic released, status `ended`.

Browser matrix: Chromium (primary, native 24kHz path) — run fully, including the automated
E2E below. Firefox/Safari (worklet resample path) — decision A (`docs/decisions.md`):
best-effort, unverified; the app shows an on-screen resample notice on non-24kHz contexts and
falls back to text intents on capture failure. Trying them live is allowed, claiming support
is not. Chromium (Chrome/Edge) is the demo browser.

## Automated live voice-loop E2E (Chromium + fake media + real AssemblyAI)

Harness: `e2e/voice-loop.spec.ts` + `e2e/playwright.config.ts` (Playwright, `@playwright/test`).
Launches Chromium with `--use-fake-ui-for-media-stream`,
`--use-fake-device-for-media-stream`, and
`--use-file-for-fake-audio-capture=e2e/fixtures/audio/drill-full.wav`, starts the app
(server :3001 + web :5173 via `webServer`), clicks Start drill session + Start drill (voice),
waits for `session.ready` (`#mic-state` → live), then the ~44s drill track plays the golden path:

1. "Okay. I'll isolate the area first." → `submit_action(isolate_area)`,
   `unidentified_spill → area_isolated`, +10.
2. "I'll notify the supervisor now." → `submit_action(notify_supervisor)`,
   `area_isolated → coordinated`, +10.
3. "I'll read the label from behind the cordon." → `submit_action(inspect_label)`,
   `coordinated → ready_for_cleanup`, +8.
4. "Documenting the incident." → `submit_action(document_incident)`,
   `ready_for_cleanup → documented`, +10.
5. "I'll clean it up." → `submit_action(clean_spill)`,
   `documented → resolved`, +20 (completed, score 58/58).

Asserts: exactly 5 evidence records with the full
`{ turn, userTranscript, intent, from, to, rule, result, scoreDelta, timestamp }` shape
(STT-verbatim userTranscripts, including "document"), DOM finals + resolved state rendered,
drill-view `#open-report` CTA visible (no auto-navigation), report route `#/report/:id`
renders `#report-score` 58 / 58, five breakdown-completed entries, five timeline rows,
breakdown click highlights the matching timeline row, timeline click expands the detail,
clean `session.end` shutdown, zero page errors and zero WS/mic/playback error lines in the
console, and the permanent key value in no browser request URL, response body, DOM, or JS global.

Forklift golden path (`e2e/voice-loop-forklift.spec.ts`, same harness with a per-file
`launchOptions` override to `e2e/fixtures/audio/forklift/forklift-drill.wav`): starts from
the enabled Forklift card, 5 turns secure(12) + call(11) + notify(9) + preserve(10) +
document(15) = 57/57 with transitions
`scene_secured → help_summoned → supervisor_notified → scene_preserved → resolved`,
the same evidence/DOM/report/no-leak categories as Warehouse, plus a report-breakdown
assert (five completed, zero missed, zero invalid). Invalid path (API-driven, no audio
flakiness): `move_victim` records a −12 penalty with no state change, then `reassess`
records recovery (breakdown penalties + recovery). `e2e/playwright.config.ts`
`testMatch: /voice-loop.*\.spec\.ts/` runs all three specs; without a key all skip cleanly.

Equipment golden path (`e2e/voice-loop-equipment.spec.ts`, same harness with a per-file
`launchOptions` override to `e2e/fixtures/audio/equipment/equipment-drill.wav`, 2026-09-23):
starts from the enabled Equipment card, 5 turns estop(15) + isolate(15) + evacuate(10) +
verify(10) + document(15) = 65/65 with transitions
`estopped → isolated → evacuated → verified → resolved`,
the same evidence/DOM/report/no-leak categories as the first two, plus a report-breakdown
assert (five completed, zero missed, zero invalid). Invalid path (API-driven, no audio
flakiness): `enter_cell` records a −15 penalty with no state change, then `reassess`
records recovery (breakdown penalties + recovery). The three voice-loop specs are the
residual-nondeterminism tripwire for their scenario: any future live flake goes in
`project-state/REGRESSIONS.md` with its turn log.

Headless by default; debug with `npx playwright test -c e2e/playwright.config.ts --headed`.
Skips cleanly without `ASSEMBLYAI_API_KEY` (CI stays green); the pre-demo command runs it live.

## Deployed E2E (M5, 2026-09-22 — code ready, no URL yet)

Same spec against the public host (single-origin, no local `webServer`):

`BASE_URL=<https-url> npm run e2e` (`API_URL` defaults to `BASE_URL`;
override only for split origins). Before the drill the spec asserts:
HTTPS `BASE_URL`, `GET /healthz` → 200 `{ status: 'ok', commit }`, and
`POST /api/voice/token` → 200 temp token with no permanent key in the body.
Then the identical golden path runs (5 turns, 58/58, evidence shape, report
UI, no-leak, clean stop) with a 60s navigation timeout for cold starts.
See `docs/deployment.md` for the go-live checklist.

## Judge walkthrough (manual, M3 close-out)

Server `npm run dev --workspace=server`, web `npm run dev --workspace=web` (proxy `/api` → :3001).
Chromium with mic permission; also re-checkable with the text intent buttons.

1. Open the app root (`#/`). Within seconds: product name VoxDrill, the one-line
   explanation, three scenario cards (all active with Start CTAs since M4 completed),
   and the How-it-works strip are legible.
2. Confirm all three scenario cards (Warehouse, Forklift, Equipment) are enabled with
   their Start drill CTAs and no "Coming soon" badge remains.
3. Click *Start drill* on the Warehouse card → `#/drill`. Confirm the mic indicator
   (Idle), the situation label ("Unidentified spill", never the raw id), the progress
   indicator ("0 of 5 required actions completed"), the live transcript pane, and the
   empty drill timeline ("No turns yet…").
4. Click *Start drill session*, then *Start drill (voice)*. Confirm the mic indicator
   moves to Requesting permission → Listening and the "You can speak anytime" cue appears.
5. Deny the microphone permission once (fresh profile or revoked permission) and confirm
   a plain-language error with a single recovery action appears (`#drill-error`), plus a
   status message — no silent failure, no stack trace.
6. Complete the drill (voice or text intents: isolate → notify → inspect → document →
   clean). Confirm each turn appends a timeline row (turn, intent chip, from→to, signed
   delta), the label and progress advance, and completion presents a single prominent
   *View after-action report* CTA that does NOT auto-navigate.
7. Open the report (`#/report/:id`). Confirm the same visual language and the unchanged
   information architecture (score header, breakdown, timeline, replay).
8. Narrow the viewport to a mobile width (~375px): selection cards stack, drill columns
   collapse to one, no horizontal break, transcript scrolls inside its pane.
9. Enable `prefers-reduced-motion` (OS setting or DevTools emulation): confirm motion is
   suppressed (no transitions/animations).
10. Confirm the bundle and captured Playwright traffic still contain no permanent key
    (automated: the E2E no-leak asserts + `no-leak-scan` of `web/dist/assets/*`).

## WAV fixture generation (reproducible, Windows SAPI, no third-party deps)

- Per-line fixtures: `powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/generate.ps1`
  (16-bit PCM mono 22050 Hz; Zira voice, rate -1; lines listed in the script).
- Chained drill track: `python3 e2e/fixtures/audio/build-drill.py`
  (6s lead silence for the greeting + 4s gaps between utterances for turn detection +
  150s trailing silence → `drill-full.wav`, 186.5s measured 2026-09-24, now including 04-document-incident).
- Forklift fixtures: `powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/forklift/generate.ps1`
  (5 single-sentence lines — 2026-09-22: two-sentence phrasing split turns at the
  mid-utterance period, so each line is one sentence: secure/call/notify/preserve/document)
  then `python3 e2e/fixtures/audio/forklift/build-forklift.py`
  (10s gaps so the 14-intent agent's reply finishes and each turn closes in order;
  150s tail so Chromium's file-replay never pollutes the measured window →
  `e2e/fixtures/audio/forklift/forklift-drill.wav`, 213.0s measured 2026-09-24).
  Warehouse tail likewise extended to 150s (`drill-full.wav`, 186.5s; gaps stay 4s).
  Tail history: 90s (2026-09-22) → 150s (2026-09-24, after run 3 outlasted the
  126.5s/153s files and replayed: warehouse double-pass, forklift
  post-completion turn — see `project-state/REGRESSIONS.md`). Tails stay below
  the 240s per-spec E2E poll deadline.
- Equipment fixtures: `powershell -ExecutionPolicy Bypass -File e2e/fixtures/audio/equipment/generate.ps1`
  (5 single-sentence lines: estop/isolate/evacuate/verify/document)
  then `python3 e2e/fixtures/audio/equipment/build-equipment.py`
  (6s lead + 10s gaps + 150s tail → `e2e/fixtures/audio/equipment/equipment-drill.wav`, 211.0s measured
  2026-09-24, same hardening as the Forklift track).
- The WAVs are committed test fixtures (not secrets).

## Pre-demo command (run from C:\Voxtra before the demo; repeatable, exits non-zero on failure)

`npm run predemo` = unit + integration (`npm test --workspace=server`) → live token smoke
(`npm run smoke:live --workspace=server`; `SKIP_LIVE=1` skips the AssemblyAI leg) →
Playwright E2E (`npm run e2e`). Safe to run repeatedly (ephemeral ports, fresh sessions).

## Rules

- Deterministic engine tests: no network, no LLM, no real AssemblyAI calls.
- Every bug fix ships with a regression test written first.
- Gate order: build → typecheck → lint → tests → security scan.
