# STATE.md — Voxtra current status (honest, updated 2026-09-24)

PROJECT COMPLETION: 74% (no change — Task 14 is diagnosis + hardening, no milestone weight; M5 deployment + M6 unclaimed — no URL)

## Completion ledger

Reconciliation 2026-09-23: Task 10 reported 78% with the derivation
`3 + 25 + 15 + 15 + 10 = 78`, but that sum is 68, not 78. Ledger trace:
Task 5 = 58, Task 8 = 61 (+3 M4 partial), Task 9 = 63 (+2 M4),
Task 10 = 68 (+5 M4 complete). The 78 was an arithmetic error, never
supported by the ledger. The honest current figure is 68%.

- Base (harness/scaffold/architecture): 3
- M1 core voice loop + Warehouse scenario: 25
- M2 evidence system + scoring: 15
- M3 UI polish + after-action report: 15
- M4 second + third scenarios: 10
- M5 deployment + demo script + submission prep: 20 total, split 2026-09-23
  (Task 12) into submission-prep 6 CLAIMED (demo script Task 11 + recording
  package + submission-form draft + submission-day procedure + measured
  predemo wall-clock footnote) and deployment 14 UNCLAIMED (public URL +
  deployed E2E twice + no-leak scans + marker fill). Reasoning: the deployed
  verification is the larger risk-bearing share; prep is documentation only.
- M6 submission QA + final submission: 15 (unclaimed — requires the actual submission)
- Current: 74%

Milestone weights match `docs/roadmap.md` (M1 25 / M2 15 / M3 15 / M4 10 /
M5 20 / M6 15); the 3 base points are pre-milestone foundation credit recorded
as a separate Foundation row in the roadmap (see the 2026-09-23 entry in
`docs/decisions.md`). No weights were changed to make the arithmetic work.
(M5 deploy-prep 2026-09-22 adds NO completion credit yet: prod code is done and locally
verified but no public URL exists and the deployed E2E has not run — claiming M5
credit now would inflate. On go-live with `BASE_URL=<url> npm run e2e` green
(Warehouse 58/58 + Forklift 57/57 + Equipment 65/65), credit M5 partial per `docs/roadmap.md` and recompute here.)

## Status: TASK 15 DEMO-RECORDING PREP 2026-09-24 — runbook ready, video awaits user's voice

- Machine FIT: `npm run preflight` → `cpu=8.4% tcp=3/3 latency=355ms disk=188.0GB => FIT` (calm window, unlike Task 14's 44–57% degraded runs).
- Warm-up `npm run predemo` → EXIT 0, GREEN 5/5, E2E leg 4.2m (forklift 57/57 golden incl. STT variants "11 right now", "Photographing the scene and keeping everyone clear" mapped correctly; warehouse 58/58; equipment + invalid-paths green). First full-green since Task 14 run 1 — consistent with the environmental classification (calm machine = green).
- Capture test: 10s `ffmpeg gdigrab + dshow` clip → 1920x1080 h264 10.000000s + AAC stereo; mic floor −80.8 dB in a silent room (device live, room quiet); clip deleted. Decision recorded in `docs/demo-recording.md` §2: NO dshow loopback device exists on this box, so ffmpeg captures mic only — the real take MUST use Game Bar (present, mixed track) or OBS (needs user install).
- App standing on http://localhost:3001/ (`GET /healthz` → 200 `{"status":"ok","commit":"unknown"}`); left running for the recording session.
- New `docs/recording-runbook.md`: one-sheet, self-contained, beat-by-beat with exact lines / actions / expected reactions / per-beat fallback, title+outro cards (outro = "Repository: <pending>", no tunnel URL), Game Bar start/stop, best-of-three keep rule, post-recording ffprobe/volumedetect checks, A/B/C + never-fake honesty rules.
- Video NOT yet recorded — requires the user's voice; no agent can supply it. Placeholders intact (`<!-- VIDEO_URL -->` in submit-now/submission-checklist). M5 deployment (14) + M6 (15) unclaimed; PROJECT COMPLETION stays 74%.
- Gates: build/typecheck/lint 0; server 141/141; web 34/34; audit 0.

## Status: TASK 14 FORKLIFT DIAGNOSIS 2026-09-24 — NOT a product regression; tag NO-GO, Path B

- Safety net first: commit 8c37bb7 (Tasks 2–13 tree, no tag, no push, no
  remote; `_sources/` left untracked; scans clean). Then diagnosis.
- Diagnosis (`docs/release-decision.md`, evidence-backed A–D): Task 9 prompt
  fix INTACT at runtime (quoted from live agent-config); fixture tails
  intact on disk (153.0/126.5/151.0s); scenario JSON unchanged; every heard
  utterance in all runs mapped correctly. Primary cause =
  environmental/service-side turn-skip/reorder under load (heard orders
  01,03,04,01,02…; wall-clock 2–3x inflated; CPU 44–57%, ICMP resource
  exhaustion). Secondary confirmed harness cliff: run 3 (9m01s) outlasted
  the fixtures → warehouse 10-turn double-pass + forklift perfect-5-plus-
  post-replay. No product-code change made (none warranted).
- Fixes: `e2e/preflight.ts` + `global-setup.ts` abort gate (`npm run
  preflight`; thresholds CPU 85%/TCP/3000ms/5GB; no-op without key) with
  `server/tests/preflight.test.ts` (8 tests; manual FIT EXIT 0 + forced
  abort EXIT 1); tails 90s→150s on all tracks (186.5/213.0/211.0s, under the
  240s poll deadline) via documented scripts; retries refused (decisions.md).
- Post-fix runs: run 1 5/5 green 4m04s; run 2 4/5 6m30s (equipment 8-turn);
  run 3 2/5 9m01s (degraded, cliff confirmed); run 4 4/5 6m50s (new tails;
  forklift 57/57 3rd green, warehouse green, equipment 6-turn line-02 skip).
  Full-green 1/4, legs 15/20 (75%). Deterministic gates green every run
  (build/typecheck/lint 0; server 141/141; web 34/34; audit 0).
- Release decision: tag NO-GO (criterion: both runs green or ≥90% legs —
  1/4, 75%), Path B (localhost video primary). Flip condition: green
  `submission-check` Sept 29. No v1.0.0 tag, no RELEASE.md, no release
  commit. Raw logs `release/verification-2026-09-24-task14-run{1..4}.txt`
  (git-ignored). M5 (14) + M6 (15) unclaimed; 74% unchanged (no inflation).

## Status: SUBMISSION LOCK-IN ATTEMPTED 2026-09-24 — NO TAG (tripwire red); M5 DEPLOY STILL BLOCKED

- Lock-in result: deterministic gates ALL GREEN (build/typecheck/lint 0;
  server 133/133; web 34/34; audit 0 vulns; history + bundle secret scans
  clean; smoke session.ready twice) but `npm run predemo` EXIT 1 twice
  (6m47s 4/5, 9m51s 3/5 — forklift golden 0/2, equipment 1/2 with a 1-turn
  stall; warehouse 2/2, invalid-paths 4/4). E2E legs 7/10 (70%), full runs
  0/2 — below live-demo acceptability. Per task constraints no `v1.0.0` tag,
  no `RELEASE.md`, no release commit. Raw log
  `release/verification-2026-09-24.txt` (git-ignored) + summary
  `release/VERIFICATION.md`. No code changed.
- New `docs/submit-now.md` (one page, Path A with URL / Path B without, all
  form fields pre-filled, `npm run submission-check` as the submission-day
  command). `docs/demo-recording.md` gained rehearsal notes §7 (ffmpeg 10 s
  clip 10.000000 playable + deleted; cloudflared/OBS absent, Game Bar
  present; shot-list statically walkable; Forklift stays on text buttons).
  `submission-check` script (pre-existing in root `package.json`) composition
  verified; full-green pending the tripwire. `.gitignore` now covers
  `release/verification-*.txt` (+ `*.mp4` safety).
- No URL provided this turn: M5 deployment (14) + M6 (15) unclaimed;
  PROJECT COMPLETION stays 74% (no inflation, no release credit).
- Prior status (2026-09-23) below is unchanged history.

## Status: M4 COMPLETE — all three scenarios live-verified, predemo twice green; M5 DEPLOY STILL BLOCKED (2026-09-23)

- Forklift Incident (`scenarios/forklift-incident.json` v0.1.0): deterministic state machine
  with 6 states (initial → scene_secured → help_summoned → supervisor_notified →
  scene_preserved → resolved), 14 intents, 5 critical actions
  (secure_scene 12 + call_emergency 11 + notify_supervisor 9 + preserve_scene 10 +
  document_incident 15 = 57), 4 invalid self-loop penalties
  (move_victim −12, restart_forklift −10, clear_aisle −8, handle_alone −6, no transition),
  2 recovery self-loops (reassess +2/+3, correct_course +2, counted via `recoveryIntents`),
  3 optional safe bonuses (brief_operator up to +4, check_witnesses up to +3,
  confirm_certification up to +2). Denominator 57 = strict-progress max;
  maxScore 113 = all positive self-loops taken once. Golden five-turn path scores 57/57.
  Unlike Warehouse, filing the report closes the drill (`documented` flag on the resolved
  transition, no separate documented state — justified in decisions + scoring notes).
- Engine reuse with zero redesign: `applyAction` unchanged in shape, now data-driven
  (`def.intents` allowlist, `def.failureStates` defaulting to Warehouse's exposed/abandoned,
  `def.recoveryIntents` for self-loop recovery); `loadScenarios` reads every
  `scenarios/*.json` by id; Warehouse behavior byte-identical (58/58, 93, same tests green).
- Sessions + voice per scenario: `POST /api/sessions` defaults to Warehouse when omitted;
  `GET /api/voice/agent-config?scenarioId=<id>` returns that scenario's tool enum +
  prompt/greeting (Warehouse prompt byte-stable, Forklift distinct); `parseToolCall`
  accepts a per-scenario allowlist; browser drill view switches def/intents/labels/flags/
  title/voice config on card selection; report IA unchanged and renders Forklift 57/57.
- Selection screen: all three cards enabled with the same treatment
  (`#select-start-warehouse`, `#select-forklift`, `#select-equipment` actionable, no badge).
  Existing DOM contracts preserved (selection spec updated deliberately to all-enabled).
- Equipment Malfunction (`scenarios/equipment-malfunction.json` v0.1.0, 2026-09-23): deterministic
  state machine with 6 states (initial → estopped → isolated → evacuated →
  verified → resolved), 14 intents, 5 critical actions
  (hit_estop 15 + isolate_power 15 + evacuate_area 10 + verify_technician 10 +
  document_incident 15 = 65), 4 invalid self-loop penalties
  (enter_cell −15, reset_fault −10, continue_work −8, ignore_alarm −6, no transition),
  2 recovery self-loops (reassess +2/+3, correct_course +2, counted via `recoveryIntents`),
  3 optional safe bonuses (brief_team up to +4, notify_maintenance up to +3,
  check_certifications up to +2). Denominator 65 = strict-progress max;
  maxScore 121 = all positive self-loops taken once. Golden five-turn path scores 65/65.
  Like Forklift, filing the report closes the drill (`documented` flag on the resolved
  transition, no separate documented state). Zero engine changes.
- Agent config covers all three: `GET /api/voice/agent-config?scenarioId=equipment-malfunction`
  returns the Equipment prompt (Task 9 skeleton: fragment no-fire, immediate-fire,
  each-step-once, optional-only-on-performance), greeting, and tool schema with the
  Equipment per-intent guide — no new code branch (additive scenario-id branch in
  `server/src/voice/tools.ts` + `buildGreeting`). Warehouse prompt + schema byte-stable,
  Forklift prompt + guide untouched (both pinned by tests).
- Fixtures: `e2e/fixtures/audio/equipment/` (5 SAPI single-sentence per-line WAVs +
  `equipment-drill.wav` 211.0s measured 2026-09-24 via `build-equipment.py`: 6s lead, 10s gaps, 150s tail);
  generation commands in `docs/test-plan.md`.
- E2E: `e2e/voice-loop-equipment.spec.ts` (live golden 65/65 with the same categories as
  Warehouse/Forklift + report-breakdown assert, plus deterministic API invalid-path:
  enter_cell −15 no-transition then reassess recovery); `playwright.config.ts`
  `testMatch: /voice-loop.*\.spec\.ts/` runs all three; all specs skip cleanly without a key.
- Fixtures: `e2e/fixtures/audio/forklift/` (5 SAPI per-line WAVs + `forklift-drill.wav`
  213.0s measured 2026-09-24 via `build-forklift.py`: 6s lead + 10s gaps + 150s tail —
  tail extended from 90s after Task 14 run 3 outlasted the 153s file); generation commands in `docs/test-plan.md`.
- E2E: `e2e/voice-loop-forklift.spec.ts` (live golden 57/57 with the same categories as
  Warehouse + report-breakdown assert, plus deterministic API invalid-path:
  move_victim −12 no-transition then reassess recovery); `playwright.config.ts`
  `testMatch: /voice-loop.*\.spec\.ts/` runs both; Warehouse spec updated deliberately
  (Forklift now enabled). Live runs need `ASSEMBLYAI_API_KEY`; without a key both skip.
- Env: Node 24.19.0, npm 11.17.0, Python 3.14.7, git (no remote; nothing pushed).
  `.env` has `ASSEMBLYAI_API_KEY` (user-created, value never printed). `.env.example` committed.

## Verification (2026-09-23 Equipment third scenario, all commands run from C:\Voxtra)

- `npm run build --workspaces` — server (tsc) + web (vite) emit. PASS
- `npm run typecheck --workspaces` — clean. PASS
- `npm run lint --workspaces` — clean, 0 warnings. PASS
- `npm test --workspace=server` — 133/133 pass (105 prior untouched + 28 new
  equipment: engine golden/invalid/recovery/denominator-65/maxScore-121/cross-rejection/
  warehouse+forklift regression, API golden/invalid-path/three-scenario agent-config/
  prompt skeleton), coverage gate intact. PASS (one new-test regex fix during
  development, no product code — see REGRESSIONS.md)
- `npm test --workspace=web` — 34/34 pass (29 prior untouched + 5 new equipment
  labels/progress/timeline/report; selection spec updated deliberately to all-enabled). PASS
- `npm audit --audit-level=high` — 0 vulnerabilities. PASS
- Bundle/grep check: `ASSEMBLYAI_API_KEY` absent from `web/dist/assets/*`; no secret in diffs. PASS
- Engine: NO changes (`git diff server/src/scenario/engine.ts` empty) — third scenario
  required zero engine work; loader picks up `scenarios/*.json` by id. Warehouse prompt
  + tool schema byte-identical (pinned tests green); Forklift prompt + guide untouched
  (pinned tests green).
- Live voice E2E: equipment golden PASS THREE consecutive runs (5 turns, intended intents
  in order, `estopped → isolated → evacuated → verified → resolved`, 65/65, no bonus line)
  + equipment API invalid-path PASS each run (enter_cell −15 no-transition, reassess
  recovery). Full `npm run e2e` green 5/5 (Warehouse 5 turns 58/58 unchanged + Forklift
  5 turns 57/57 unchanged + Equipment 5 turns 65/65 + both invalid-paths). All specs skip
  cleanly without `ASSEMBLYAI_API_KEY`.
- `npm run predemo` (unit → smoke → E2E) — GREEN TWICE (run 1: 5/5 green;
  run 5: EXIT=0, 230s, 133 tests + smoke + 5/5 E2E with all three goldens 58/58, 57/57,
  65/65). Honest variance: runs 2–4 each went 4/5 with a transient flake rotating across
  specs (warehouse tail-flake twice, one token-mint fetch failure + forklift stall, one
  equipment setup failure); every completed turn in every run had the intended intent.
  Full log in REGRESSIONS.md.
  Tripwire: the three `e2e/voice-loop-*.spec.ts` specs now cover all three scenarios
  for residual service-side nondeterminism (see REGRESSIONS.md + docs/test-plan.md).
- Git status: only intended files; no commit made (no remote; per AGENTS.md do not push).
  `.env` not listed (ignored); no secret in diffs. No deployment artifact touched
  (`git diff render.yaml .node-version` empty).

## Verification (2026-09-23 submission package — documentation only, no product change)

- `npm run build --workspaces` — clean (server tsc + web vite). PASS
- `npm run typecheck --workspaces` — clean. PASS
- `npm run lint --workspaces` — clean, 0 warnings. PASS
- `npm test --workspace=server` — 133/133 pass. PASS
- `npm test --workspace=web` — 34/34 pass. PASS
- `npm audit --audit-level=high` — 0 vulnerabilities. PASS
- `npm run e2e` (local sanity) — 5/5 green (Warehouse 5 turns 58/58 +
  Forklift 5 turns 57/57 + Equipment 5 turns 65/65 + both invalid-paths). PASS
- Bundle scan: zero `ASSEMBLYAI_API_KEY` hits under `web/dist/`. PASS
- Judge files (`README.md`, `docs/pitch.md`, `docs/submission-checklist.md`,
  `docs/demo-script.md`): zero TODO/FIXME/PLACEHOLDER; `<!-- DEPLOYED_URL -->`
  marker sits in `README.md` only (plus deployment-doc markers for Task 12). PASS
- Protected paths untouched this turn (engine, scenario JSONs, E2E specs,
  prompts, tool schemas): no edit made outside docs + project-state + README.

## Verification (2026-09-23 demo-recording + submission-rehearsal — documentation only)

- New `docs/demo-recording.md`: environment checklist, capture tooling
  (ffmpeg present N-126303 with live dshow mic names; OBS absent — install
  path documented, no install performed; Game Bar present), 180s shot list
  (5+15+35+55+30+20+15+5; Warehouse + Equipment lines byte-identical to
  fixture WAVs, narration verbatim from `docs/demo-script.md`), Options A/B/C
  fallback procedure, pre-demo verification, rehearsal procedure.
- `docs/submission-checklist.md`: copy-paste form draft at top (tagline 104
  chars; description = pitch opening three sentences; AssemblyAI usage names
  only wired capabilities; uncertain items marked verify-against-rules) +
  submission-day procedure (Sept 29 evening local target, broken-URL
  fallback). Old draft kept below as superseded-for-traceability.
- `docs/demo-script.md`: measured footnote — `npm run predemo` EXIT=0, 235s
  wall-clock (server 133 + smoke session.ready + E2E 5/5: Warehouse 58/58,
  Forklift 57/57, Equipment 65/65, both invalid-paths; E2E leg 3.7m). No beat
  changed, no scenario trimmed: E2E tails/settle windows are not demo pace.
- Gates: `npm run build --workspaces` clean; typecheck clean; lint clean
  (0 warnings); server 133/133; web 34/34.
- Placeholders intact (no URL this turn): `<!-- DEPLOYED_URL -->` in README,
  demo-recording, submission-checklist; `<!-- REPO_URL -->`,
  `<!-- VIDEO_URL -->` in submission-checklist only. Pre-existing `<url>` /
  `<DEPLOYED_URL>` command tokens in deployment/test-plan/BLOCKERS/STATE docs
  are runbook syntax, not markers.
- Protected paths untouched (engine, scenario JSONs, E2E specs, prompts, tool
  schemas, production code): this turn wrote docs + project-state only. Note:
  the working tree shows many pre-existing uncommitted modifications from
  prior tasks (only two commits exist, no remote) — this turn's own delta is
  the three docs files plus project-state.
- No secret created, printed, logged, or committed. No repo/Render/account
  created. M5 deployment credit (14) remains unclaimed; M6 (15) unclaimed.

## Next

Deploy is code-ready but NOT live (user action required — see BLOCKERS.md #5 and
`docs/deployment.md`). After the user creates the private repo + Render service
and sets the secret: `curl -sS <url>/healthz`, `BASE_URL=<url> npm run e2e`
(Warehouse 5 turns 58/58 + Forklift 5 turns 57/57 + Equipment 5 turns 65/65), key-leak scans,
then record the URL in `docs/deployment.md` + `docs/demo-script.md` and recompute
PROJECT COMPLETION (M5 partial). M4 is complete; the deploy/demo/submit stretch is next.
