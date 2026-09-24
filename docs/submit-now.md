# VoxDrill — Submit Now (Sept 29 evening local time; hard deadline Sept 30)

Target: submit **Sept 29 evening**. Sept 30 is the buffer, not the plan.
Verify the timezone against hackathon rules before clicking Submit.

## Pre-submission check (both paths, ~10–17 min)

```powershell
npm run submission-check
```

Must be green: build + typecheck + lint + server 133 + web 34 + audit 0 +
`scan:leak` (no `ASSEMBLYAI_API_KEY` in `web/dist/`) + `npm run predemo`
(server 133 + smoke session.ready + E2E 5/5: Warehouse 58/58, Forklift 57/57,
Equipment 65/65, both invalid-paths). If predemo flakes, see fallback below —
do not weaken any assertion. Also: no secret in the demo video (mic audio
only; never show `.env` or Render dashboard secrets on screen).

Tripwire state 2026-09-24: E2E legs 7/10 (70%), full predemo 0/2 — below
live-demo acceptability. **The pre-recorded localhost video is the PRIMARY
artifact; do not rely on a live URL.** Re-run `submission-check` on Sept 29
and log any flake with its turn log in `project-state/REGRESSIONS.md`.

## Path A — deployed URL available

1. `curl -sS <DEPLOYED_URL>/healthz` → 200 `{ status: 'ok', ... }`.
2. `BASE_URL=<DEPLOYED_URL> npm run e2e` **twice** → 5/5 both times, no key
   in traffic; `grep -R ASSEMBLYAI_API_KEY web/dist/` → empty.
3. Replace `<!-- DEPLOYED_URL -->` with the URL in: submission form, `README.md`,
   `docs/deployment.md`, `docs/demo-script.md`, `docs/demo-recording.md`.
4. Paste `<!-- REPO_URL -->` (public repo, or judge-shared per rules) and
   `<!-- VIDEO_URL -->` (YouTube unlisted or Loom — verify hosting per rules).
5. Pre-submission check green → review form end-to-end → Submit.

## Path B — no deployed URL (current state 2026-09-24)

1. Pre-submission check green on localhost.
2. Submit with repo URL + demo video (localhost take per
   `docs/demo-recording.md`); in "known limitations" write: "No public
   deployment — demo recorded against localhost (`http://localhost:3001`,
   identical drill/engine/report); `npm run predemo` log green at submit."
3. Review form end-to-end → Submit. **If the URL breaks at submit time, fall
   back to Path B immediately — do not delay past Sept 29 evening.**

## Form fields (copy-paste; fill ALL-CAPS at submit time)

- Project name: VoxDrill
- Tagline: Voice-first trainer where spoken decisions change a live simulation
  — scored by code, not hallucination. (104 chars)
- Description: VoxDrill is a voice-first trainer for high-stakes workplace
  calls. You speak your decisions into a live emergency scenario; the
  simulation reacts to each decision; and you finish with an after-action
  report where every point traces to a logged turn. Three scenarios ship:
  Warehouse Chemical Spill, Forklift Incident, Equipment Malfunction.
- AssemblyAI usage: Voice Agent API — PCM16 streaming in/out, neural turn
  detection with barge-in, one `submit_action` tool (intent enum = scenario
  intent list), inline per-scenario session updates; server-minted
  short-lived tokens, key never in browser. LLM maps speech → intent only;
  state/score/completion are deterministic server code.
- Deployed URL: (A) the verified `https://...` / (B) "not deployed — see demo video"
- Repo URL: `<!-- REPO_URL -->` (make public or judge-shared per rules)
- Demo video URL: `<!-- VIDEO_URL -->`
- Team/author: _(user fills)_ · Track: AssemblyAI Voice Agent (verify per rules)
- LICENSE: none committed — add MIT only if rules require (see checklist).

Order on the day: predemo green → URLs pasted → video linked → full read-through → Submit.
