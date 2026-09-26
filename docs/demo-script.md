# VoxDrill — 3-Minute Live Demo Script

Rehearsed against the E2E goldens. Every spoken line below is a fixture line from
`e2e/fixtures/audio/` — the exact utterances the automated suite asserts — so the
demo cannot drift from the tests. Time budget: 180 seconds total.

Deployed URL (M5): https://voxtra.onrender.com/ (live 2026-09-26; warm `/healthz` one minute before showtime — free-tier cold starts. Until the fix commit redeploys, fallback is `http://localhost:3001` after `npm run build --workspaces && npm run start --workspace=server`).

> Do not demo from https://web-eta-bay-67.vercel.app/ (retired 2026-09-26 — static frontend only, no API).

## Time budget (why this split)

- 0:00–0:20 Intro (20s) — the judge understands the product before anyone speaks.
- 0:20–1:50 Warehouse golden, 5 voice turns (90s) — the full trust story on the
  primary scenario: speak, watch the world change, finish at 58/58.
- 1:50–2:20 Forklift bad-decision → recovery (30s) — the differentiator beat.
  Done with text-intent buttons on a fresh Forklift session: deterministic, no
  STT risk, same engine path as voice.
- 2:20–2:40 Equipment single turn (20s) — proves the third scenario is live
  without spending a second golden path.
- 2:40–3:00 Report beat (20s) — the score explained from the log.

## Pre-demo checklist

1. `npm run predemo` green on the demo commit (server 133 + smoke + E2E 5/5).
2. Browser at the deployed URL (or `http://localhost:3001`); warm it first
   (`/healthz` → 200) so no cold start eats the intro.
3. Chromium or Edge, mic permission pre-granted, tab in focus, volume up.
4. Headphones in if the room has speakers (avoid feedback into the mic).
5. Know where `#intents button` (text-intent fallback) is before you start.

## Beat 1 — Intro (0:00–0:20)

Say: "VoxDrill is voice training where your words change the simulation — and the
score is computed, not hallucinated."

Show: `#/` selection screen — VoxDrill tagline "Speak your decisions", three
scenario cards (Warehouse, Forklift, Equipment, all with Start CTAs), the
Speak → Scenario reacts → Evidence recorded → After-action report strip.

## Beat 2 — Warehouse golden (0:20–1:50)

Click *Start drill* on the Warehouse card → `#/drill`. Click *Start drill
session*, then *Start drill (voice)*. Situation reads "Unidentified spill",
progress "0 of 5 required actions completed", mic indicator Listening.

| # | Spoken line (exact) | Expected intent | Observable reaction | Score |
|---|---------------------|-----------------|---------------------|-------|
| 1 | "Okay. I'll isolate the area first." | `isolate_area` | Label → "Area isolated"; timeline Turn 1 (+10); progress "1 of 5"; agent speaks the cordon consequence | +10 |
| 2 | "I'll notify the supervisor now." | `notify_supervisor` | Label → "Isolated and supervisor notified"; timeline Turn 2 (+10); progress "2 of 5" | +10 |
| 3 | "I'll read the label from behind the cordon." | `inspect_label` | Label → "Ready for safe cleanup"; timeline Turn 3 (+8); progress "3 of 5" | +8 |
| 4 | "Documenting the incident." | `document_incident` | Label → "Incident documented"; timeline Turn 4 (+10); progress "4 of 5" | +10 |
| 5 | "I'll clean it up." | `clean_spill` | Label → "Spill safely resolved"; timeline Turn 5 (+20); progress "5 of 5"; terminal *View after-action report* CTA appears (no auto-navigation) | +20 |

Leave the report unopened — the report beat comes at the end. Note the running
score: 10 + 10 + 8 + 10 + 20 = 58.

## Beat 3 — Bad decision → recovery on Forklift (1:50–2:20)

Say: "Now watch what happens when the trainee gets it wrong."

Click home → *Start drill* on the Forklift card → *Start drill session*
(voice optional; use the text-intent buttons — same engine, zero STT risk).
Situation reads "Incident uncontrolled".

| # | Action (button or spoken) | Expected intent | Observable reaction | Score |
|---|---------------------------|-----------------|---------------------|-------|
| 1 | Click `move_victim` (or say "I'm going to move him out of the way.") | `move_victim` | Stays "Incident uncontrolled" — no state change; consequence: spinal-injury warning plus recovery hint; timeline Turn 1 (−12) | −12 |
| 2 | Click `reassess` (or say "Let me reassess.") | `reassess` | Still "Incident uncontrolled" but recovery recorded; timeline Turn 2 (+2); report will list this under Recovery | +2 |

Say: "Bad decision, system reacts, user recovers, system records the recovery.
That loop is the product."

## Beat 4 — Equipment is live (2:20–2:40)

Click home → *Start drill* on the Equipment card → *Start drill session* →
*Start drill (voice)*. Situation reads "Cell re-energized".

Speak (exact): "Hitting the emergency stop now."

Expect: intent `hit_estop`, label → "E-stop pressed", timeline Turn 1 (+15),
agent speaks the halt consequence. Say: "Third scenario, same engine, zero
special cases — one turn is enough to prove it."

## Beat 5 — Report (2:40–3:00)

Navigate back to the Warehouse drill (session preserved) and click *View
after-action report* → `#/report/:id`.

Point at: score header **58 / 58**; breakdown panel **Completed (5)** listing
isolate, notify, inspect, document, clean; click the 4th Completed entry
("Documenting the incident") and show timeline Turn 4 highlighting with the
full record (turn, intent, `ready_for_cleanup → documented`, +10).

Say: "Every point traces to a logged turn. That is the whole pitch."

## If it goes wrong (fallback section)

- **Mic denied.** The drill shows a plain-language error with a recovery action
  (`#drill-error`). Grant permission and click *Start drill (voice)* again, or
  drive the identical golden path with the `#intents` text buttons — narrate
  over it; the engine, timeline, and report are unchanged.
- **Agent stalls mid-drill (no turn lands within ~20s).** Do not repeat the
  line immediately — a delayed tool call records against the wrong turn. Wait
  for the reply to finish, then say the line once. If the socket dropped, click
  *Start drill (voice)* again: the engine session (and its evidence) survives
  under the same session id.
- **A turn is misclassified.** Keep going; the report beat still works
  (the score will differ from 58 — point at the evidence row and explain what
  the engine heard). If the drill is unsalvageable, abandon it and do the full
  golden path on text buttons while narrating.
- **Full outage (no token, no voice).** Pre-recorded backup: narrate the table
  in Beat 2 over a text-button run. The report renders identically.
- **Cold start on the deployed URL.** Warm `/healthz` one minute before
  showtime; the E2E allows a 60s navigation timeout for this reason.

## Measured wall-clock footnote (2026-09-23, Task 12)

`npm run predemo` EXIT=0, wall-clock **235s**: server 133/133 + live token
smoke (session.ready) + E2E **5/5** (Warehouse 5 turns 58/58, Forklift 5 turns
57/57, Equipment 5 turns 65/65, both invalid-paths; E2E leg 3.7m). The E2E leg
is NOT the demo's pace: it plays three full WAV tracks with 90s anti-replay
tails plus 12s settle windows. The human demo above stays inside 180s because
it runs one voice golden (Warehouse, ~90s at live turn-detection pace), the
Forklift beat on text-intent buttons (~30s, same engine, zero STT latency), a
single Equipment voice turn (~20s), and a 15s report beat. No beat budget was
changed and no scenario was trimmed — the 180s split stands.
