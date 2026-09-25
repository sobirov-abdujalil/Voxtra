# CURRENT_TASK.md — the one active task

- [x] Foundation + setup mission (2026-09-20): harness, AGENTS.md, env, scaffold, engine,
      docs, AssemblyAI research, tests, git, quality gate.
- [x] Live voice slice (2026-09-20): inline agent config, POST /api/voice/token hardening +
      agent-config endpoint, submit_action tool wiring, AudioWorklet PCM16 streaming + playback
      with barge-in, transcript→/turn→tool.result loop, full evidence shape, UI wiring,
      19 new tests (42/42 green), docs + STATE updated to 32%.
- [x] Voice-loop validation gate (2026-09-20): live token smoke (real session.ready) +
      SAPI WAV fixtures + Playwright E2E (4-turn golden path, score 48, live-verified) +
      7 live-found bugs fixed with unit+E2E regression cover (54/54 green) + Firefox/Safari
      decision A + `npm run predemo` passing twice; STATE stays 32% (verification, not scope).
- [x] After-action report (2026-09-20): score-48 investigation (structural gap → document_incident),
      engine v0.2.0 (documented state, 5-turn golden 58/58, denominator 58, maxScore 93, breakdown),
      report endpoint extended, web report view (`#/report/:id` with replay), drill CTA handoff,
      E2E extended to drill→report, docs + STATE updated to 50%.
- [x] M3 UI polish close-out (2026-09-22): selection screen at `#/` (tagline, 3 cards with
      Warehouse-only CTA, how-it-works, mic guidance), drill-view polish (human labels,
      progress, drill timeline, mic indicator, barge-in cue, terminal report CTA, error
      surface), continuity polish (shared tokens, report IA unchanged), 14 new web tests
      (20/20) + E2E selection/polish asserts, predemo twice, docs + STATE updated to 58%.
- [ ] M5 deployment (IN PROGRESS 2026-09-22): platform chosen (Render, justified in
      docs/decisions.md); prod code done (same-origin `web/dist` serving + SPA
      fallback, `GET /healthz`, token counters + access logs with no /metrics,
      fail-fast on missing key, `render.yaml` + `.node-version` + root `start`,
      `BASE_URL`/`API_URL` E2E with deployed HTTPS/healthz/token guards,
      8 new `server/tests/deploy.test.ts` regressions); local gates green
      (typecheck/lint/69 server/20 web/build/audit/bundle no-leak, prod server
      serves web/dist). BLOCKED on user identity: no remote, no CLI, no account
      — manual first-deploy steps in docs/deployment.md + BLOCKERS.md. After the
      user deploys: `curl /healthz` + `BASE_URL=<url> npm run e2e` (5 turns 58/58),
      then record URL in docs/deployment.md + docs/demo-script.md and recompute STATE.
- [x] M4 Forklift Incident second scenario (2026-09-22): deterministic forklift JSON
      (57/57 golden, 113 ceiling, self-loop penalties + recovery, no engine fork),
      data-driven engine generalization (per-def intents/failureStates/recoveryIntents,
      multi-file loader), per-scenario sessions + agent-config, enabled Forklift card +
      dynamic drill/voice/report, SAPI fixtures + forklift-drill.wav, golden + invalid-path
      E2E, 94 server + 25 web tests green, docs + STATE updated to 63%.
- [x] M4 Forklift live-voice mapping fix (2026-09-22): root-caused the 10-turn 59/57
      failure (H1 turn-splitting + H2 tool ambiguity + H3 optional eagerness + H4 display,
      each evidenced from live logs); Forklift prompt turn discipline + per-intent tool
      guide (Warehouse byte-identical, pinned); report option-A headline contract
      (headlineScore/bonusPoints, `#report-bonus` line); fixture hardening (single-sentence
      lines, 10s gaps, 90s tails); no client coalescing (investigated, rejected with reason);
      15 new tests (11 server + 4 web) with fail-then-pass proof; `npm run e2e` green
      (Warehouse 5 turns 58/58 + Forklift 5 turns 57/57 + invalid-path) and `npm run predemo`
      green twice (155s, 160s); docs + STATE updated to 63%. No third scenario added.
- [x] M4 Equipment Malfunction third scenario (2026-09-23, M4 COMPLETE): deterministic
      equipment JSON (65/65 golden, 121 ceiling, self-loop penalties + recovery, zero
      engine changes — third proof the contract is data-driven), additive agent-config
      branch (Task 9 skeleton + equipment guide/greeting; Warehouse byte-stable, Forklift
      byte-identical, both pinned), Equipment card enabled + wired with no IA change,
      dynamic drill/report confirmed by inspection, SAPI fixtures + equipment-drill.wav
      (~151s, same 10s-gap/90s-tail hardening), golden + invalid-path E2E (3 consecutive
      greens + full 5/5 suite: Warehouse 58/58, Forklift 57/57, Equipment 65/65),
      133 server + 34 web tests green, predemo twice, docs + STATE updated to 78%.
- [x] Submission package (2026-09-23, no deploy credit): reconciled PROJECT
      COMPLETION (Task 10's 78% → honest 68%; ledger in STATE.md; Foundation row
      + scale note in roadmap; decision logged); judge-facing README.md with
      `<!-- DEPLOYED_URL -->` placeholder; executable 3-minute docs/demo-script.md
      (exact fixture lines, per-beat intents/reactions/scores, Forklift
      bad→recovery beat, report beat, fallbacks, pre-demo checklist);
      docs/submission-checklist.md (status/action/owner per item, Sept 30
      deadline, Sept 29 safe date, tripwire re-run planned); docs/pitch.md
      (one-page judge summary, only wired AssemblyAI capabilities claimed).
      No URL provided this turn: deploy gate still open, placeholders intact,
      M5/M6 unclaimed. No engine/scenario/E2E/prompt/schema change.
- [x] Demo recording package + submission rehearsal (2026-09-23, M5 prep
      partial +6 → 74%): new `docs/demo-recording.md` (env checklist, ffmpeg/
      Game Bar tooling state verified on-machine, 180s shot list with
      fixture-exact lines, A/B/C fallback procedure, warm-up routine,
      rehearsal procedure); submission form draft + submission-day procedure
      in `docs/submission-checklist.md` (Sept 29 target, broken-URL fallback);
      measured predemo footnote in `docs/demo-script.md` (EXIT=0, 235s, E2E
      5/5 — Warehouse 58/58, Forklift 57/57, Equipment 65/65). No URL this
      turn: deploy gate open, placeholders intact, M5 deployment (14) + M6
      (15) unclaimed. Docs + project-state only; gates green (build,
      typecheck, lint, server 133, web 34).
- [ ] NEXT: M5 deployment (BLOCKED on user identity — no remote/CLI/account; manual
  first-deploy steps in docs/deployment.md + BLOCKERS.md). After the user deploys:
  `curl /healthz` + `BASE_URL=<url> npm run e2e` twice (all three goldens +
  invalid-paths, no-leak), then fill URL in README + deployment + demo-script +
  submission-checklist + demo-recording and recompute STATE (M5 deployment 14).
  Recording package is ready now: localhost take per `docs/demo-recording.md`;
  re-record only the outro if the URL lands before September 29.
- [x] Submission lock-in attempt (2026-09-24, NO TAG — verification red):  full pass captured to `release/verification-2026-09-24.txt` (deterministic
  gates green: build/typecheck/lint 0, server 133/133, web 34/34, audit 0,
  secret + bundle scans clean, smoke ×2; predemo EXIT 1 twice — 4/5 then 3/5,
  forklift golden 0/2, equipment 1/2, legs 7/10). Per constraints no v1.0.0
  tag, no RELEASE.md, no release commit. New `docs/submit-now.md` (Path A/B,
  pre-filled fields, submission-check command); rehearsal notes §7 in
  `docs/demo-recording.md` (ffmpeg 10 s clip OK + deleted; OBS/cloudflared
  absent); `.gitignore` covers `release/verification-*.txt`. No URL this
  turn: M5 deployment (14) + M6 (15) unclaimed, 74% unchanged. Docs +
  project-state + release summary only; no code changed.
- [x] Forklift-recurrence diagnosis + hardening (2026-09-24, Task 14, tag
  NO-GO — Path B): safety-net commit 8c37bb7 first (no tag/push); evidence
  diagnosis (prompt fix intact at runtime, tails intact, scenario unchanged,
  every heard utterance mapped correctly → primary cause
  environmental/service-side turn-skip/reorder, secondary confirmed replay
  cliff in degraded run 3); mitigations (`e2e/preflight.ts` + global-setup
  abort gate + 8 unit tests, tails 90s→150s with regenerated WAVs, retries
  refused); predemo 4x post-fix (5/5 4m04s, 4/5 6m30s, 2/5 9m01s, 4/5 6m50s —
  forklift golden 3/4 greens; legs 15/20); `docs/release-decision.md` written
  (tag NO-GO, Path B, Sept-29 flip condition); submit-now/checklist/
  demo-recording/BLOCKERS/REGRESSIONS/STATE/decisions updated. No URL: M5
  (14) + M6 (15) unclaimed, 74% unchanged. No engine/scenario/prompt change.
- [ ] NEXT (active): recording session — user records the localhost demo video per `docs/recording-runbook.md` with the server up at http://localhost:3001/ (preflight FIT first, best of three takes, Game Bar start/stop, outro card `github.com/sobirov-abdujalil/Voxtra`). Reply with the file path for verification, then the uploaded URL. Deploy gate still needs the user (BLOCKERS.md).
- [ ] NEXT: September 29 evening — `npm run submission-check` on a calm
  machine (tag flips to go only on green → v1.0.0 + RELEASE.md + commit);
  record the localhost demo video per `docs/demo-recording.md` (preflight
  FIT first, best of three takes). Deploy gate still needs the user (BLOCKERS.md).
- [x] Recording-session prep (2026-09-24, Task 15 — runbook ready, video
  OPEN): preflight FIT (8.4% CPU) + warm-up predemo GREEN 5/5 (4.2m E2E leg);
  10s capture clip verified then deleted (no loopback device → Game Bar/OBS
  decision in demo-recording.md §2); app standing on http://localhost:3001/
  (/healthz 200); new self-contained `docs/recording-runbook.md`; STATE /
  BLOCKERS / REGRESSIONS updated; gates green (141/141, 34/34, audit 0).
  The take itself needs the user's voice — video URL placeholders intact,
  M5 (14) + M6 (15) unclaimed, 74% unchanged.
