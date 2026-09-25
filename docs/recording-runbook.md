# VoxDrill — Recording Runbook (one sheet, print this)

Companion to `docs/demo-recording.md`. Self-contained: follow top to bottom, no other doc needed while recording. Machine is FIT today (preflight 8.4% CPU, warm-up predemo GREEN 5/5, E2E leg 4.2m). Server is running: open **http://localhost:3001/#/** in Chromium, 100% zoom, single tab.

## Start / stop

- START: press `Win+Alt+R` (Game Bar, captures screen + system + mic, one mixed track). Confirm the recording widget appears.
- STOP: press `Win+Alt+R` again. Clip lands in `Videos\Captures`.
- Spare tool (only if Game Bar fails): OBS needs installing (`winget install OBSProject.OBSStudio`), ffmpeg on this box captures mic but NOT the agent's voice (no loopback device) — do not use ffmpeg for the real take.

## Beats (180s total — say the lines EXACTLY)

**0 — Title card (0:00–0:05, 5s).** No speech. Show a card: "VoxDrill — Speak your decisions. Scored by code, not hallucination." *Flake: n/a.*

**1 — Intro (0:05–0:20, 15s).** Say: "VoxDrill is voice training where your words change the simulation — and the score is computed, not hallucinated." Show: selection screen, three scenario cards, Speak → reacts → evidence → report strip. *Flake: page fails to load → say "Local server hiccup — one moment.", restart server, re-shoot this beat only.*

**2a — Warehouse turns 1–2 (0:20–0:55, 35s).** Click Warehouse Start → Start drill session → Start drill (voice). Say "Okay. I'll isolate the area first." — wait for the reply to finish — say "I'll notify the supervisor now." Expect: label → "Area isolated" → "Isolated and supervisor notified", timeline Turns 1–2 (+10, +10), "2 of 5". Then say: "Two decisions, two state changes, twenty points." *Flake: a turn misclassifies → keep going, the report beat explains from evidence.*

**2b — Warehouse turns 3–5 (0:55–1:50, 55s).** Hands off mic between lines; wait for each reply to finish. Say "I'll read the label from behind the cordon." … "Documenting the incident." … "I'll clean it up." Expect: Turns 3–5 (+8, +10, +20), label → "Spill safely resolved", "5 of 5", *View after-action report* appears. Then say: "Fifty-eight out of fifty-eight — running total on screen." *Flake: stall >20s → do NOT repeat the line (a delayed call lands on the wrong turn); wait, say it once. Socket dropped → click Start drill (voice) again, evidence survives.*

**3 — Forklift bad → recovery (1:50–2:20, 30s).** Say: "Now watch what happens when the trainee gets it wrong." Home → Forklift Start → Start drill session. Click the `move_victim` button, then click `reassess`. Expect: Turn 1 stays "Incident uncontrolled", spinal warning + hint (−12); Turn 2 recovery recorded (+2). Say: "Bad decision, system reacts, user recovers, system records the recovery. That loop is the product." *Flake: use the buttons — same engine path, zero voice risk. If voice flaked in beat 2, do this beat on buttons and narrate.*

**4 — Equipment one turn (2:20–2:40, 20s).** Home → Equipment Start → Start drill session → Start drill (voice). Say: "Hitting the emergency stop now." Expect: `hit_estop`, label → "E-stop pressed", Turn 1 (+15). Say: "Third scenario, same engine, zero special cases — one turn proves it." *Flake: cheapest re-shoot in the script — cut and retake this 20s beat standalone.*

**5 — Report (2:40–2:55, 15s).** Back to the Warehouse drill → *View after-action report*. Point at **58 / 58**, Completed (5); click the 4th entry ("Documenting the incident"), show Turn 4 (`ready_for_cleanup → documented`, +10). Say: "Every point traces to a logged turn. That is the whole pitch." *Flake: score differs from 58 → point at the evidence row and explain what the engine heard; the trust story survives a wrong turn.*

**6 — Outro card (2:55–3:00, 5s).** No speech. Show a card: "Repository: github.com/sobirov-abdujalil/Voxtra — demo recorded against localhost, identical drill/engine/report." Never show an ephemeral tunnel URL here. *Flake: n/a.*

## Takes (keep rule)

Record three full takes. Keep the take where every beat fired. If none is clean, keep the one with the most clean beats and splice failed beats from another take. Log every cut (shot, take, why) — the edit is auditable, not hidden.

## If the live loop flakes mid-take (A/B/C)

- **A — Cut-and-retake:** stop, restart the drill, re-record the failed beat standalone, splice in post.
- **B — Warm-up take:** run the full drill once unrecorded first (pays token-mint + handshake cost), record the second run.
- **C — Caption, never fake:** if a beat flakes twice, insert a still-frame caption ("Live voice — moment of reaction") and continue. Never fake a reaction that did not occur; caption every cut honestly.

## Post-recording (before upload)

1. Duration 180–240s: `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1 <file>`.
2. Streams + voices audible: `ffprobe -v error -show_streams -of json <file>` (1 video + audio) and `ffmpeg -i <file> -af volumedetect -f null -` (mean volume above ~−50 dB; silence = retake).
3. Last 5 seconds show the outro card, not a mid-sentence cut — check by eye.
4. Upload unlisted (YouTube unlisted or Loom — verify hosting against hackathon rules), title "VoxDrill — voice-first simulation trainer", description = tagline in `docs/submission-checklist.md` ("Voice-first trainer where spoken decisions change a live simulation — scored by code, not hallucination."), visibility unlisted. Reply to the agent with the file path first for verification, then the uploaded URL.
