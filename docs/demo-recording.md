# VoxDrill — Demo Recording Package

Recording against `http://localhost:3001` is a legitimate submission artifact:
the drill, engine, and report are identical locally and deployed — only the
origin differs. Record now; swap in the deployed-URL outro card if the gate
closes before September 29.

Deployed URL (M5): <!-- DEPLOYED_URL --> (gate open 2026-09-23 — no public URL
provided this turn; record the localhost take and re-record only the outro if
the URL lands).

Tooling state on this machine (verified 2026-09-23, nothing installed by the
agent): `ffmpeg` present (N-126303), OBS Studio NOT found under
`C:\Program Files\OBS Studio` (an `OBS Virtual Camera` dshow entry remains,
suggesting a past install), Windows Game Bar present
(`Microsoft.XboxGamingOverlay` 7.326.8061.0).

## 1. Recording environment checklist

Complete every line before the first recorded take:

- [ ] Browser: Chromium (Edge or Chrome) at 100% zoom, single tab, bookmarks
      bar hidden, notifications silenced.
- [ ] Microphone: the same device used in testing; permission pre-granted for
      the demo origin; input level checked in OS sound settings; noise floor
      acceptable. Observed devices on this machine (via
      `ffmpeg -list_devices true -f dshow -i dummy`): `External Microphone
      (Realtek(R) Audio)`, `Microphone (Realtek(R) Audio)` — confirm which one
      is live before recording.
- [ ] Audio output: system volume set so agent speech is captured in the
      recording without clipping.
- [ ] Display: 1920x1080, notification center / Focus assist on (alarms only),
      auto-update paused, screensaver disabled.
- [ ] Network: wired connection preferred; on Wi-Fi, confirm signal strength
      before recording (the voice loop is a live AssemblyAI round-trip).
- [ ] Preflight: `npm run preflight` → FIT before the first take (Task-14
      gate: CPU/TCP/disk check; an UNFIT reading means re-take later, not a
      product failure — close background load and retry).
- [ ] Terminal: a second window ready with `npm run predemo` and the server
      start command (`npm run build --workspaces` then
      `npm run start --workspace=server`) so a re-take is fast.

## 2. Capture tooling

Primary recommendation: OBS Studio — scene = browser window capture + system
audio + mic on separate tracks. Why one line: separate tracks make a flaky
beat re-recordable without touching the rest of the take, and the output is a
deterministic local file. Install path (user runs it, not the agent):
`winget install OBSProject.OBSStudio`, then add Sources: Window Capture
(browser) + Audio Output Capture + Audio Input Capture (the mic from the
checklist above).

Fallback: Windows Game Bar (`Win+G` → Start recording, `Win+Alt+R`). Present
on this machine. Limitation: single mixed track and less control over
sources — adequate for a 180-second demo, but a bad mic level cannot be fixed
in post.

Last resort: browser screen-recording extensions. Risk: mic-capture
reliability varies by extension and permission model — prefer OBS or Game Bar.

`ffmpeg` option (installed — verified 2026-09-23): screen via `gdigrab` plus
mic via `dshow`. Replace `MIC-NAME` with the confirmed device from the
checklist above:

```powershell
ffmpeg -f gdigrab -framerate 30 -i desktop `
  -f dshow -i audio="External Microphone (Realtek(R) Audio)" `
  -c:v libx264 -preset veryfast -pix_fmt yuv420p `
  -c:a aac -b:a 160k voxdrill-demo-take1.mp4
```

System-audio loopback under `dshow` is device-dependent; if the agent's voice
is missing from the capture, record speaker output via OBS/Game Bar instead.

Decision 2026-09-24 (Task 15 capture test): `ffmpeg -list_devices` on this
machine enumerates NO loopback device (no Stereo Mix / virtual cable — only
the two Realtek mics), so the `ffmpeg` command above captures mic only, never
the agent's voice. The real take MUST use Game Bar (mixed track, present) or
OBS (separate tracks, needs user install) — ffmpeg is screen+mic rehearsal
tooling only. 10s screen+mic clip verified today (1920x1080, 10.000000s,
mic floor −80.8 dB in a silent room = device live, room quiet; clip deleted).

## 3. Timed shooting script (shot list, total 180s)

The five Warehouse voice lines and the Equipment line below are byte-identical
to the E2E fixture WAV contents (`e2e/fixtures/audio/generate.ps1`,
`equipment/generate.ps1`); narration lines match `docs/demo-script.md`
verbatim, and the Forklift beat uses text-intent buttons (same engine path,
zero STT risk) — so the demo cannot drift from what the tests assert.
Beat budgets mirror `docs/demo-script.md`.

| Shot | Time | Dur | Spoken line (exact) | On-screen action | Expected reaction | If it works, say | If not, say + do |
|------|------|-----|---------------------|------------------|-------------------|------------------|------------------|
| 0 title | 0:00–0:05 | 5s | (card, no speech) | Show title card: "VoxDrill — Speak your decisions" + one-liner | — | — | — |
| 1 intro | 0:05–0:20 | 15s | "VoxDrill is voice training where your words change the simulation — and the score is computed, not hallucinated." | `#/` selection screen: tagline, three scenario cards, Speak → reacts → evidence → report strip. No clicks. | Cards legible | (continue) | If page fails to load: "Local server hiccup — one moment." Restart server, re-shoot shot 1 only. |
| 2a warehouse 1–2 | 0:20–0:55 | 35s | "Okay. I'll isolate the area first." … "I'll notify the supervisor now." | Click Warehouse Start → Start drill session → Start drill (voice). Speak line 1, wait for reply, speak line 2. | Label → "Area isolated" → "Isolated and supervisor notified"; timeline Turns 1–2 (+10, +10); progress "2 of 5" | "Two decisions, two state changes, twenty points." | If a turn misclassifies: keep going (report beat explains from evidence). If unsalvageable: Option A cut-and-retake (section 4). |
| 2b warehouse 3–5 | 0:55–1:50 | 55s | "I'll read the label from behind the cordon." … "Documenting the incident." … "I'll clean it up." | Nothing (hands off mic). Speak each line once, waiting for the reply to finish. | Timeline Turns 3–5 (+8, +10, +20); label → "Spill safely resolved"; progress "5 of 5"; *View after-action report* CTA appears | "Fifty-eight out of fifty-eight — running total on screen." | If the agent stalls >20s: do NOT repeat the line (delayed tool call lands on the wrong turn). Wait, then say the line once. Socket dropped → click *Start drill (voice)* again (session evidence survives). |
| 3 forklift bad→recovery | 1:50–2:20 | 30s | "Now watch what happens when the trainee gets it wrong." | Home → Forklift Start → Start drill session. Click `move_victim` button (or say "I'm going to move him out of the way."), then click `reassess` (or say "Let me reassess."). | Turn 1: stays "Incident uncontrolled", spinal-injury warning + recovery hint (−12). Turn 2: recovery recorded (+2). | "Bad decision, system reacts, user recovers, system records the recovery. That loop is the product." | Text buttons use the same engine path as voice with zero STT risk — if voice flaked in shot 2, do this beat on buttons and narrate. |
| 4 equipment single turn | 2:20–2:40 | 20s | "Hitting the emergency stop now." | Home → Equipment Start → Start drill session → Start drill (voice). Speak the line. | Intent `hit_estop`, label → "E-stop pressed", timeline Turn 1 (+15), agent speaks the halt | "Third scenario, same engine, zero special cases — one turn proves it." | If the turn flakes: cut-and-retake this 20s beat standalone (cheapest re-shoot in the script). |
| 5 report | 2:40–2:55 | 15s | "Every point traces to a logged turn. That is the whole pitch." | Back to Warehouse drill → *View after-action report*. Point at **58 / 58**, Completed (5); click 4th entry ("Documenting the incident"), show Turn 4 highlight (`ready_for_cleanup → documented`, +10). | Report renders from the evidence log alone | (closing line above) | If score differs from 58 (misclassified turn): point at the evidence row and explain what the engine heard — the trust story survives a wrong turn. |
| 6 outro | 2:55–3:00 | 5s | (card, no speech) | Outro card: deployed URL if available, otherwise repo URL | — | — | — |

Total: 5 + 15 + 35 + 55 + 30 + 20 + 15 + 5 = 180s.

Best-of-three-takes note: record the full demo straight through (takes 1–3).
If any single beat fails, re-record that beat as a standalone clip and splice
it in post. Document every cut (which shot, which take, why) in the take log
below so the edit is auditable, not hidden.

Take log (fill while recording):

- Take 1: __ date/time, result, cuts needed __
- Take 2: __ date/time, result, cuts needed __
- Take 3: __ date/time, result, cuts needed __

## 4. Fallback-recording procedure (live turn flakes mid-take)

Failure mode observed (see `project-state/REGRESSIONS.md` 2026-09-22/23):
residual service-side nondeterminism — setup/stall signatures (token-mint
fetch failure, mic requesting→error, mid-drill audio stall, tail replay),
rotating across specs. Every completed turn in every logged run carried the
intended intent; the engine never misbehaved. The tripwire
(`e2e/voice-loop-*.spec.ts` per scenario, `docs/test-plan.md`) detects it:
exactly-5-turns / exact-intents asserts fail while unit suites stay green.

- Option A — Cut-and-retake: stop, restart the drill, re-record the failed
  beat as a standalone clip, splice in post. Document the cut in the take log.
- Option B — Warm-up take: before recording, run the full drill once as an
  unrecorded rehearsal, then record the second run. The first run pays the
  token-mint + WS-handshake cost; the second run is the one to record.
- Option C — Pre-recorded reaction insert: if the same beat flakes twice,
  insert a still-frame caption ("Live voice — moment of reaction") and
  continue. Do not fake a reaction that did not occur; caption the cut
  honestly.

Pre-demo warm-up routine (explicit): one full unrecorded rehearsal run of all
three scenarios (Warehouse golden → Forklift bad→recovery → Equipment single
turn), then start the real recording. Rehearsal is not recorded.

## 5. Pre-demo verification

- [ ] `npm run predemo` green on the demo commit. Measured 2026-09-23:
      EXIT=0, wall-clock 235s (server 133 + live token smoke + E2E 5/5:
      Warehouse 5 turns 58/58, Forklift 5 turns 57/57, Equipment 5 turns
      65/65, both invalid-paths). If the tripwire fires, do not record —
      investigate first (`project-state/REGRESSIONS.md`).
- [ ] Warm the page first (`/healthz` → 200) so no cold start eats the intro.
- [ ] Confirm the recording browser, mic, and page match the rehearsal
      (same device, same origin, same scenario order).

## 6. Rehearsal procedure (before every recorded take)

1. Run the full drill once per scenario as a rehearsal. Do not record it.
2. If any rehearsal run flakes, run the tripwire (`npm run predemo`) and
   inspect the failure mode via `project-state/REGRESSIONS.md`. Only start
   recording after a clean rehearsal.
3. Warm-up rationale: the first run of a session pays the token-mint and
   WS-handshake cost; the second run is the one to record.

## 7. Rehearsal notes (2026-09-24, environment validation only — no final video)

- Capture: `ffmpeg -f gdigrab` 10 s desktop-only clip produced, ffprobe
  duration exactly 10.000000, playable; artifact deleted (not committed).
  Screen path proven on this machine; mic-inclusive `dshow` command from
  section 2 not exercised today (silent test by design — no voice needed).
- Tooling: `ffmpeg` N-126303 present; `cloudflared` absent; OBS Studio absent
  (Game Bar `Microsoft.XboxGamingOverlay` 7.326.8061.0 present). Nothing installed.
- Shot-list static walkthrough: all 5 Warehouse spoken lines byte-match
  `e2e/fixtures/audio/generate.ps1`; the Equipment line ("Hitting the
  emergency stop now.") byte-matches `equipment/generate.ps1`; Forklift beat
  lines match `docs/demo-script.md`. DOM hooks confirmed in `web/src`:
  `#intents` buttons (`main.ts` `buildIntentButtons`), `#drill-error`,
  `#report-score` + `#report-bonus` (`report.ts`), `#select-start-warehouse` /
  `#select-forklift` / `#select-equipment` all enabled (specs assert enabled).
- Tripwire context today: `npm run predemo` 4/5 then 3/5 (forklift golden
  0/2, equipment 1/2 with a 1-turn stall) — so the Forklift beat MUST stay on
  text-intent buttons (zero STT risk) and the Equipment beat should be
  rehearsed once unrecorded before the take (Option B warm-up). No discrepancy
  requiring a doc fix beyond this note; no app bug found (no code changed).

This is a lightweight resilience measure, not a code change — no engine,
scenario, prompt, tool-schema, E2E-spec, or production-code edit is part of
this package.
