# Real-mic check (under 5 min) — do before recording

**Do not record the demo video until all four tests pass.**

## Setup (1 min)

1. Chrome (the demo browser) → https://voxtra.onrender.com/.
2. F12 → Console tab, keep visible. No red errors after load.

## Test A — Agent greeting

1. Warehouse Chemical Spill → Start Drill. Grant mic permission.
2. Mic pill reads live. Greeting is smooth speech, no stutter/repeats.
3. No connect-src / WebSocket errors in console. Pass / Fail: __

## Test B — One full turn

1. Say: "I'll isolate the area first."
2. Transcript matches; intent chip `isolate_area`; state label advances.
3. Consequence plays smoothly, no stutter. Pass / Fail: __

## Test C — Barge-in

1. While the agent speaks, talk over it: "Wait — stop."
2. Agent audio stops immediately; the new turn is captured. Pass / Fail: __

## Test D — Three consecutive turns

1. Complete the drill through three turns.
2. All three agent responses smooth, no glitch on any. Pass / Fail: __

## Report back

- All pass: reply "real-mic check passed" + exact lines spoken + observed responses.
- Any fail: reply with test letter + exact audio symptom + console output. Do not record.
