# BLOCKERS.md — items needing the user

Open gates 2026-09-26 (Render live at https://voxtra.onrender.com/, M5 deployment claimed → 88%; remaining: video + submission):
1. **Demo video (OPEN — runbook ready, recording is user's voice)** — Task 15
   prep complete 2026-09-24: machine FIT (preflight 8.4% CPU), warm-up predemo
   GREEN 5/5, capture path verified (Game Bar primary; ffmpeg mic-only),
   server standing on http://localhost:3001/, `docs/recording-runbook.md`
   printed and self-contained. The take itself needs the user's voice in a
   quiet 10 minutes — reply with the file path (or "prep only" to record
   later). No `<!-- VIDEO_URL -->` filled until a verified take is uploaded.
2. **Deployed E2E verification (CLOSED 2026-09-26 — 2/2 greens, M5 claimed)** —
   https://voxtra.onrender.com/ runs the fixed build (CSP header verified
   again this turn); Task-18 run 2 = 5/5 GREEN (3.9m) and this-task run = 5/5
   GREEN (3:58, all goldens exact + both invalid-paths + no-leak). Two-clean-
   greens rule satisfied → M5 deployment (14) CLAIMED, ledger 88%.
   (Vercel https://web-eta-bay-67.vercel.app/ retired — static only, never submit it.)
3. **Submission not yet made (OPEN)** — form draft in
   `docs/submission-checklist.md` + `docs/submit-now.md` (repo + deployed URLs
   filled 2026-09-26); submit Sept 29 evening local time per the submission-day
   procedure. Requires the video (gate 1) and the gate-2 greens (else Path B).
4. **Residual live-E2E nondeterminism (classified environmental, mitigated)** —
   15/20 legs (75%) this task; every heard utterance maps correctly, failures
   are turn-skip/reorder/replay under load. Mitigations: `npm run preflight`
   abort gate + 150s fixture tails. No user action except: keep Sept 29
   re-run on a calm machine; tag flips to go only on green.

None blocking the foundation or the after-action report. Upcoming items that genuinely need the user:
1. **AssemblyAI live verification** — CLOSED 2026-09-20: real `POST /api/voice/token` mints
   against `GET /v1/token`, real WS reaches `session.ready`, and the full 4-turn drill runs
   live in Chromium via the automated E2E (`npm run predemo`). Six live-found bugs fixed and
   regressed (see `project-state/REGRESSIONS.md`).
2. **Stored agent provisioning** (`POST /v1/agents`) — RESOLVED 2026-09-20: inline `session.update`
   config chosen over a stored `agent_id` (single primary scenario; faster iteration; see
   `docs/decisions.md`). No account action needed. Revisit only if a second scenario needs shared config.
3. **Real human mic drill** — the automated E2E covers synthetic audio end-to-end; a one-time
   human-mic run on the user's machine is still the only unverified leg. Manual protocol is in
   `docs/test-plan.md` (read the four drill lines aloud). Firefox/Safari resample path is
   best-effort + on-screen notice per `docs/decisions.md` (decision A); Chromium is the demo browser.
4. **Git remote** — CLOSED 2026-09-25: user created https://github.com/sobirov-abdujalil/Voxtra, pushed `main` (tracking `origin/main`, SHAs match), placeholder fills pushed. No tag.
5. **M5 deploy (OPEN, 2026-09-22)** — code is deploy-ready (same-origin build,
   `/healthz`, `render.yaml`, `BASE_URL` E2E, 133 server + 34 web tests green incl.
   all three scenarios) but no public URL exists: no GitHub remote, no `gh`/Render CLI, no platform
   account from this machine. User chose Render 2026-09-22. Manual steps in
   `docs/deployment.md`: (1) create private GitHub repo + `git push`
   (2) Render → connect repo (build `npm install && npm run build --workspaces`,
   start `npm run start --workspace=server`, health `/healthz`)
   (3) set `ASSEMBLYAI_API_KEY` as a Render secret (4) `curl /healthz` +
   `BASE_URL=<url> npm run e2e` (Warehouse 58/58, Forklift 57/57, Equipment 65/65).
    Do not paste secrets into chat. M4 is now complete (all three scenarios live-verified);
    deployment is the single largest remaining risk before the September 30 submission.
     2026-09-23 (submission package): no deployed URL was provided this turn, so the
     gate is still open — README carries a `<!-- DEPLOYED_URL -->` placeholder and
     `docs/submission-checklist.md` records every deployment-gated row as OPEN/BLOCKED.
     No fabricated deployment claim; M5 remains unclaimed.
     2026-09-23 (demo-recording + rehearsal): still no URL this turn — gate OPEN,
     M5 deployment (14) + M6 (15) unclaimed, PROJECT COMPLETION 74% (M5 prep +6
     claimed for the recording package + rehearsal + timing proof). Recording is
     NOT blocked: `docs/demo-recording.md` prescribes a localhost take now
     (legitimate artifact + insurance), outro re-record only if the URL lands.
     Tripwire state: green this turn (`npm run predemo` EXIT=0, 235s, E2E 5/5);
     re-run September 29 per the submission-day procedure.
 5. **Judge-walkthrough human legs (M3, 2026-09-22)** — the automated gates cover every DOM
  contract, but three walkthrough steps need human eyes/hands on real hardware: denying
  the mic permission once (error box + recovery), a 375px mobile pass, and a
  prefers-reduced-motion pass. All three are scripted in `docs/test-plan.md`.
- 2026-09-24: lock-in attempt could not cut `v1.0.0` (predemo 0/2, legs 7/10
  — tripwire red, not a regression). Fallback in force: pre-recorded
  localhost demo is PRIMARY (`docs/submit-now.md` Path B); re-run
  `npm run submission-check` Sept 29 and cut the tag only on green.
