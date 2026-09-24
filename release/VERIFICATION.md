# VoxDrill — Final Verification Summary (2026-09-24)

Raw output: `release/verification-2026-09-24.txt` (local only, git-ignored —
two live predemo runs; this file is the committed summary).
Prior day: `release/verification-2026-09-23.txt` + its summary section below.

## Deterministic gates — ALL GREEN (standalone + inside both predemos)

| Gate | Result 2026-09-24 |
|------|-------------------|
| `npm run build --workspaces` | EXIT 0 (server tsc + web vite) |
| `npm run typecheck --workspaces` | EXIT 0 |
| `npm run lint --workspaces` | EXIT 0, 0 warnings |
| `npm test --workspace=server` | **133/133** (11 files) |
| `npm test --workspace=web` | **34/34** (7 files) |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| Secret scan `git log --all -p -- server/ web/ e2e/` for key/Bearer patterns | empty = clean |
| Bundle scan `ASSEMBLYAI_API_KEY` in `web/dist/` | zero hits = clean |
| Live token smoke (`smoke:live`) | session.ready observed in both predemo runs |

(The `401 token mint failed` line in the log is the negative-path unit test
asserting auth-failure handling — expected, not a defect.)

## Live E2E tripwire — FIRING (both runs, rotating modes)

Two full `npm run predemo` runs on the unchanged tree:

- Run 1: EXIT 1, 6m47s, **4/5**. Warehouse 58/58 green, Equipment 65/65 green,
  both invalid-paths green. Forklift golden: 8 turns, 59/57 — early
  notify_supervisor (+2) and preserve_scene (+0) self-loops plus a secure_scene
  replay (+0); the `call_emergency` turn itself mapped correctly at turn 5.
  Optional-eagerness + replay signature.
- Run 2: EXIT 1, 9m51s, **3/5**. Warehouse 58/58 green (5 turns, intended
  intents in order), both invalid-paths green. Forklift golden: 9 turns,
  59/57 — early notify/preserve/document self-loops (+2/+0/+0) plus replays.
  Equipment golden: stalled at 1 turn (15/65, `hit_estop` only) — mid-drill
  audio stall, no further turns closed. Stall signature.

Every completed turn in both runs carried a plausible intent and the engine
scored every turn correctly (penalties, self-loops, no-transitions all
deterministic). Zero mapping errors on completed turns, zero product-logic
defects. This is the documented residual service-side nondeterminism
(`project-state/REGRESSIONS.md`, `docs/test-plan.md` tripwire), not a
regression. No app fix made (freeze task — code untouched).

## Pass-rate numbers

- 2026-09-24 E2E legs: **7/10 (70%)** — warehouse golden 2/2, equipment
  golden 1/2, forklift golden 0/2, invalid-paths 4/4.
- 2026-09-24 full `predemo` runs: **0/2 green**.
- Recent window (Sept 23: 2/5 full-green per REGRESSIONS.md; Sept 24: 0/2):
  2/7 full runs green. Verdict: below live-demo acceptability. The
  pre-recorded demo is the PRIMARY plan; no live URL may be relied on during
  the submission window (`docs/submit-now.md` Path B).

## Rehearsal (2026-09-24, no final video recorded)

- `ffmpeg` gdigrab screen capture: 10 s clip produced, ffprobe duration
  exactly 10.000000, playable; artifact deleted. dshow mic names from
  `docs/demo-recording.md` stand (not re-enumerated today).
- `cloudflared`: not installed. OBS Studio: not installed (Game Bar present
  7.326.8061.0). Nothing installed by the agent.
- Shot-list walkthrough (static, no recording): all 5 Warehouse lines and the
  Equipment line byte-match the SAPI fixture sources (`generate.ps1`);
  `#intents`, `#drill-error`, `#report-score`, `#report-bonus`, and the three
  selection CTAs confirmed in `web/src`; Forklift beat uses text-intent
  buttons (same engine path as voice, zero STT risk — the correct call given
  today's tripwire). No app fix required; discrepancies logged as rehearsal
  notes in `docs/demo-recording.md`.

## Freeze notes — NO TAG CUT 2026-09-24

- Per task constraints (failed verification pass ⇒ no release tag), **no
  `v1.0.0` tag, no `RELEASE.md`, no release commit** was created today.
  The tree is deterministically green but not predemo-green, so presenting it
  as "release-ready" would be dishonest. Re-freeze only on a green
  `npm run submission-check`.
- `_sources/` (ECC reference dump) left untracked deliberately — not product
  code, not part of the submission.
- `release/verification-*.txt` git-ignored (large live logs); this summary is
  the committed record.
- Reproduce everything any time with `npm run submission-check` (single
  command, non-zero exit on any failure; ~10–17 min wall-clock with live E2E).
  Composition verified 2026-09-24; full-green pending the tripwire.

## Prior day (2026-09-23, for traceability)

Deterministic gates green (build/typecheck/lint 0; server 133/133; web
34/34; audit 0; secret + bundle scans clean; smoke PASS). Two predemos EXIT 1
(396s 4/5, 408s 4/5 — forklift golden flaked both times, 4 turns 14/57 stall
then 8 turns 25/57 replay-storm). E2E legs 8/10 (80%), predemo 0/2.
Same verdict: pre-recorded demo primary, Path B.
