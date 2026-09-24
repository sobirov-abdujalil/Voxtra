# VoxDrill — Release Decision (2026-09-24, Task 14)

## Diagnosis summary

The Task 13 Forklift recurrence (golden 0/2, 8-turn and 9-turn runs at 59/57
with "early-optional + replay" signatures) is **not a product-code
regression**. The Task 9 fix is intact at runtime, the 90s fixture tails were
intact on disk, the scenario definition is unchanged, and **every heard
utterance in every Task 13/14 run mapped to its correct intent with correct
engine scoring**. The primary cause is **environmental/service-side**:
audio-level turn skipping and reordering under machine load and
turn-detection latency, rotating across specs. A secondary, confirmed
**harness** contribution exists: when a degraded window pushes a spec past
its fixture length, Chromium loops the capture file and replayed lines become
spurious turns. Both are fixed/mitigated below; neither required a product-code
change, so none was made.

## Part A — Was the Task 9 fix ever applied, and is it still present?

**INTACT.** `GET /api/voice/agent-config?scenarioId=forklift-incident` against
a live local server on 2026-09-24 returns the fix verbatim
(`server/src/voice/tools.ts` lines 145–160, unchanged since Task 9):

- Fragment no-fire: *"A fragment, trailing clause, or short acknowledgement
  (for example, 'Right, do not move him.') is NOT a new action: make no tool
  call at all for a fragment turn."*
- Immediate-fire: *"Fire the tool call the moment the trainee finishes a
  complete utterance. Never hold a completed action for a later turn."*
- Each-step-once: *"Fire each required step once: if tool.result says a step
  is already done, move on and never repeat it."*
- Optional-only-on-performance: *"Optional steps (brief_operator,
  check_witnesses, confirm_certification) fire only when the trainee has
  clearly stated they are performing that step in this turn; do not fire on
  mention, acknowledgement, or implication."*
- Keep-still disambiguation plus the full per-intent tool guide (positive
  trigger + do-NOT-use guard per intent) — all present; Warehouse prompt +
  schema byte-stable (pinned by `server/tests/forklift-mapping.test.ts`).

No task after Task 9 touched `tools.ts` prompt/guide strings
(`git log` shows only the Task 14 safety-net commit on top). **No prompt or
schema drift.**

## Part B — Is the harness producing phantom turns?

**Mostly no, with one confirmed cliff.** Measured 2026-09-24 (Python `wave`):

- `forklift-drill.wav` **153.0s** (6s lead + 5 single-sentence lines + 4×10s
  gaps + **90s tail — intact**), `drill-full.wav` 126.5s, `equipment-drill.wav`
  151.0s. Per-line fixtures are single sentences (no mid-utterance periods).
- `e2e/playwright.config.ts`: `workers: 1`, `fullyParallel: false` (serial),
  300s test timeout, 240s per-spec poll loop + 12s settle. No parallel
  starvation.
- Task 13's 8/9-turn failures occurred **mid-drill** (turns 2–5), not
  post-completion — the tail-replay mechanism cannot explain them. **Harness
  acquitted for Task 13.**
- Task 14 run 3 (9m01s wall-clock, degraded window) **confirmed the cliff**:
  the warehouse spec outlasted its 126.5s file and played all 5 lines twice
  (10 turns, 61/58, exact double-pass), and the forklift spec caught a
  post-completion replay of line 05 (turns 1–5 a perfect golden, turn 6 a +0
  replay). Fixture length is a cliff, not a guarantee, under severe slowdown.

## Part C — Is the environment degraded?

**Yes — and it correlates with the failures.**

- Machine samples 2026-09-24: CPU 44–57% (early, Chrome 2GB+ RSS ×3,
  Roblox + SNAPOS64 + OpenCode active), disk 184GB free (fine), ICMP ping to
  `agents.assemblyai.com` failed with local socket-resource exhaustion while
  TCP :443 connects succeeded at 110–390ms (jittery first attempt).
- Wall-clock: Task 13 runs 6m47s/9m51s and Task 14 run 3 9m01s vs calm-window
  runs of 4m04s (Task 14 run 1) and the Task 9 greens (155s/160s) — **2–3x
  inflation for identical work**.
- Preflight reads FIT at 14–50% CPU on this box (thresholds deliberately
  lenient: CPU 85%, TCP latency 3000ms), so moderate load passes the gate and
  the residual remains possible — the gate catches clearly-unfit machines, it
  does not bless a red run as product truth.

## Part D — Root cause statement

**Primary (high confidence): environmental/service-side turn-delivery
disorder.** Raw turn logs prove it: Task 13 run 1 heard fixture lines in
order 01, 03, 04, 01, 02, 03, 04, 05 (line 02 skipped in position, line 01
replayed mid-drill); Task 14 run 4 equipment heard 01, 03, 04, 05, 01, 02
(line 02 skipped, drill stalled at 6 turns). Every heard utterance mapped
correctly — the agent never disobeyed the prompt on audio it actually
received; audio arrived skipped, duplicated, or late (run 3 warehouse turn 2:
a delayed call recorded against the wrong turn, the exact mode the prompt
warns against). This rotates across specs (forklift → equipment →
warehouse), the signature of load/latency, not of scenario logic.
**Product bug: none. Harness artifact: the replay cliff, confirmed only in
the degraded run-3 window. Environmental: the rest.**

## Fix summary

- `e2e/preflight.ts` (new): pure `evaluatePreflight` threshold logic
  (CPU 85% / TCP must-connect / latency 3000ms / disk 5GB — lenient by
  design) + live sampler (CPU, TCP ×3, disk) + `npm run preflight` CLI.
  `PREFLIGHT_FORCE_FAIL=1` demonstrates the abort path.
- `e2e/global-setup.ts` (new, wired in `playwright.config.ts`): aborts the
  run with `E2E PREFLIGHT ABORT` on an unfit machine; no-op without
  `ASSEMBLYAI_API_KEY` so keyless CI stays green.
- `server/tests/preflight.test.ts` (new, 8 tests): threshold boundaries,
  unknown-dimensions-pass, multi-failure listing. No fake tests.
- Fixture tails 90s → **150s** on all three tracks
  (`drill-full.wav` 186.5s, `forklift-drill.wav` 213.0s,
  `equipment-drill.wav` 211.0s; all below the 240s poll deadline),
  regenerated with the documented scripts, numbers updated in
  `docs/test-plan.md`. Per-line audio untouched; no assertion changed.
- Retries deliberately **not** added: a retry-green is indistinguishable
  from a pass without log archaeology and doubles an already 4–9min run
  (recorded in `docs/decisions.md`).
- Docs corrections: stale `~49s` forklift duration in STATE.md fixed to the
  measured value.

## Final pass rate (post-fix runs, all reported, none cherry-picked)

| Run | Fixtures | Result | Wall-clock | Notes |
|-----|----------|--------|------------|-------|
| 1 | 90s tails | **5/5 green** | 4m04s | Forklift 5×57/57, all goldens + invalid-paths |
| 2 | 90s tails | 4/5 | 6m30s | Equipment 8-turn skip/reorder; forklift green |
| 3 | 90s tails | 2/5 | 9m01s | Degraded window; warehouse double-pass + forklift post-replay (replay cliff confirmed) |
| 4 | **150s tails** | 4/5 | 6m50s | Forklift 5×57/57 green; equipment 6-turn stall (line-02 skip) |

Full runs green: **1/4**. E2E legs: **15/20 (75%)**. Forklift golden
post-diagnosis: green in runs 1, 2, 4 (run 3 was a perfect 5-turn golden plus
one post-completion replay). Deterministic gates in every run: build 0,
typecheck 0, lint 0, server **141/141** (133 + 8 new preflight), web 34/34,
audit 0. Residual-nondeterminism tripwire: firing (equipment/warehouse
rotating), **classified environmental/service-side**, not product.

## Go / no-go

- **Release tag v1.0.0: NO-GO.** Criterion (both full runs green, or ≥90%
  legs with environmental residual) is not met: 1/4 full-green, 75% legs.
  Presenting this tree as release-ready would be dishonest. **Condition to
  flip:** `npm run submission-check` green on September 29 (calm machine,
  extended fixtures) — then cut
  `git tag -a v1.0.0 -m "VoxDrill submission candidate — verified 2026-09-29"`,
  write `RELEASE.md`, commit. No tag, no RELEASE.md, no release commit today.
- **Submission path: Path B (pre-recorded localhost video, primary).**
  No deployed URL exists, so Path A is unavailable regardless of the tag
  decision. Recording procedure: record against localhost per
  `docs/demo-recording.md`, run `npm run preflight` first (abort = re-take
  later, not a product failure), run the demo script three times, keep the
  best take, upload unlisted (verify hosting per rules), reference it in the
  form. The demo video is the primary artifact; a deployed URL is optional.

## Residuals carried to September 29

1. Live E2E remains load-sensitive (75% legs this task). Mitigations in
   place: preflight abort gate + 150s tails + tripwire logging. Re-run
   `submission-check` Sept 29 evening; log any flake with its turn log.
2. Deploy gate still open (no URL): M5 deployment (14) + M6 (15) unclaimed;
   PROJECT COMPLETION stays **74%**.
