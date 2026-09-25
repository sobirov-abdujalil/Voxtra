# VoxDrill — Submission Checklist

Deadline: **September 30, 2026**. Latest safe submission date: **September 29, 2026**
(keeps one buffer day for a failed deploy, a flaky live run, or a form correction).

## Submission form draft (copy-paste ready — Task 12 rehearsal)

Every field the hackathon form is likely to ask for, drafted for copy-paste on
September 29. Uncertain items are marked "verify against hackathon rules" —
nothing here is claimed as a rule certainty.

- Project name: VoxDrill
- Tagline (≤120 chars, 104): Voice-first trainer where spoken decisions change
  a live simulation — scored by code, not hallucination.
- Full description (opening three sentences of `docs/pitch.md`): VoxDrill is a
  voice-first trainer for high-stakes workplace calls. You speak your decisions
  into a live emergency scenario; the simulation reacts to each decision; and
  you finish with an after-action report where every point traces to a logged
  turn. Three scenarios ship: Warehouse Chemical Spill, Forklift Incident,
  Equipment Malfunction.
- Deployed URL: <!-- DEPLOYED_URL --> (gate open 2026-09-23 — no public URL
  provided this turn; paste the real `https://...` on go-live).
- Repository URL: https://github.com/sobirov-abdujalil/Voxtra (pushed 2026-09-25 on branch main; make the
  repo public or shared with judges per the hackathon rules — verify
  against hackathon rules).
- Demo video URL: <!-- VIDEO_URL --> (intended destination: YouTube unlisted
  or Loom, recorded against localhost per `docs/demo-recording.md` — verify
  against hackathon rules for required hosting/upload path).
- AssemblyAI usage description: VoxDrill drives the drill through the
  AssemblyAI Voice Agent API with real-time speech streaming (PCM16 in and
  out), neural turn detection with barge-in, tool calling through a single
  `submit_action` tool whose intent enum is exactly the scenario's intent
  list, and inline session updates (per-scenario prompt, greeting, and tool
  schema served from our server). Auth is server-minted short-lived tokens;
  the permanent key never reaches the browser. The LLM interprets speech into
  a structured intent and nothing more — state, transitions, scoring, and
  completion are computed by deterministic server-side code. Deliberately not
  claimed: keyterm prompting and client-side session resumption (not wired).
- Team / author: _(TBD — user fills at submit time)_.
- Categories / tracks: AssemblyAI Voice Agent track (verify against hackathon
  rules; alternative: general / education-simulation track if one exists).
- Additional materials: `docs/pitch.md` (one-page summary), `README.md`
  (judge-legible run/test/scoring summary), `docs/test-plan.md` (live
  verification plan incl. the per-scenario tripwire).

## Submission-day procedure

Order of operations on September 29:

1. `npm run predemo` green on the submission commit; record EXIT + turn counts.
2. Confirm the deployed URL loads `/healthz` → 200 `{ status: 'ok', ... }`.
3. Copy the deployed URL into every field that references it (form + README +
   `docs/deployment.md` + `docs/demo-script.md` + `docs/demo-recording.md`).
4. Paste the demo video URL (see `docs/demo-recording.md` take log).
5. Review the form once end-to-end before clicking Submit.

Cutoff: submit **September 29 evening local time**; September 30 is the
absolute latest. Timezone: verify against hackathon rules (not documented in
the repo — do not assume).

If the deployed URL is broken at submission time: submit with the repo URL and
the demo video, and note the deployed-URL issue in the submission's "known
limitations" field if one exists. The localhost-recorded video plus the green
`npm run predemo` log are the insurance policy.

Deploy gate: no public URL was provided this turn, so every deployment-gated row
stays OPEN. Nothing below is claimed as done unless verified by a passing command.

| Item | Status | Action | Owner |
|------|--------|--------|-------|
| Public HTTPS URL live | OPEN | Follow `docs/deployment.md` steps 1–5 (GitHub repo + push, Render service, `ASSEMBLYAI_API_KEY` as secret, deploy); record URL in `docs/deployment.md` + `docs/demo-script.md` + README | user |
| Repo public or shared with judges (per hackathon rules) | OPEN | Confirm the rules; make the pushed repo public or grant judge access | user |
| README.md present and judge-legible | DONE 2026-09-23 | Deployed-URL marker (`<!-- DEPLOYED_URL -->`) filled by Task 12 | agent (Task 12) |
| Demo video recorded (if required) | UNCONFIRMED | Check the hackathon rules: if a video is required, record the `docs/demo-script.md` run (3 min) and put the link here: _(no link yet)_ | user |
| All three scenarios work from the deployed URL | BLOCKED on URL | `BASE_URL=<url> API_URL=<url> npm run e2e` — expect Warehouse 5 turns 58/58, Forklift 5 turns 57/57, Equipment 5 turns 65/65, plus both invalid-paths | agent (Task 12) |
| `npm run predemo` green on the deployment commit | DONE locally (Task 10, twice); OPEN on deploy commit | Re-run `npm run predemo` after the deploy commit and record EXIT + turn counts in STATE.md | agent (Task 12) |
| No secret in Git history, deploy logs, or client bundle | DONE locally; OPEN on deploy | `grep -R "ASSEMBLYAI_API_KEY" web/dist/` → expect zero hits; `git status --short` → `.env` untracked; E2E no-leak asserts green; Render build logs reviewed for key material (dashboard only, never pasted in chat) | agent + user |
| Firefox/Safari fallback documented and honest | DONE | `docs/architecture.md` + `docs/test-plan.md`: best-effort resample path, on-screen notice, Chromium is the demo browser; no support claim | — |
| Residual-nondeterminism tripwire documented, pre-submission re-run planned | DONE (documented); re-run PLANNED | Tripwire: `e2e/voice-loop-*.spec.ts` per scenario (`docs/test-plan.md`, `project-state/REGRESSIONS.md`). Task-14 state: 15/20 legs (75%), 1/4 full-green, residual environmental/service-side (`docs/release-decision.md` — tag NO-GO, Path B). Mitigations: `npm run preflight` gate + 150s tails. Re-run `npm run predemo` on **September 29** and log any flake with its turn log; do not weaken assertions | agent (Task 14) |
| Submission form fields drafted | DRAFTED (below) | Fill team + links at submit time | user |
| LICENSE decision | OPEN | No LICENSE file is committed. If the rules require one, add MIT (or preferred) and log the choice in `docs/decisions.md` | user |

## Earlier draft (superseded by the copy-paste draft above, kept for traceability)

- Project name: VoxDrill (repo/project name Voxtra).
- One-line description: Voice-first simulation trainer where spoken decisions
  change a deterministic scenario and produce an evidence-based after-action report.
- Links: repo _(URL TBD — user)_, live demo _(deployed URL TBD)_,
  demo video _(link TBD if required)_.
- Team: _(TBD — user)_.
- Track/category: AssemblyAI Voice Agent API usage — real-time speech, neural
  turn detection with barge-in, tool calling (`submit_action`), inline session
  updates, server-minted short-lived tokens.

## Remaining markers (exact strings, Task 12 fills)

- `<!-- DEPLOYED_URL -->` in `README.md`.
- `_(not yet deployed — fill in on go-live)_` in `docs/deployment.md`
  (`Current DEPLOYED_URL`) and `docs/demo-script.md` (Deployed URL line).
