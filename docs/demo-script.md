# Voxtra — Demo Script (foundation draft)

> Not yet rehearsed. Do not claim demo-ready until a live end-to-end run passes.

## Setup (5 min before)

1. `npm install`, `npm run build`, `npm test` green.
2. Server on :3001 with `.env` containing `ASSEMBLYAI_API_KEY` (never shown).
3. Web on :5173. Chrome/Edge with mic permission. Headphones recommended for non-browser fallback.

## The run (3 min)

1. **Hook (20s).** "Voice training where your words change the simulation — and the score is
   computed, not hallucinated."
2. **Start drill (20s).** Click *Start drill session*. State: `unidentified_spill`.
3. **Good decision (30s).** Say "I'm cordoning off the area." → consequence shows isolation (+10).
4. **Bad decision (40s).** Say "I'll just wipe it up." → exposure consequence (−15) + recovery hint.
5. **Recover (30s).** Isolate → notify → inspect → clean → `resolved`.
6. **Report (20s).** *Load report*: evidence log → score. "Every point traces to a logged turn."

## Fallbacks

- Mic fails → text intent buttons drive the same engine.
- Voice socket fails → narrate over the text-fallback run.
- Full outage → pre-recorded run + seeded session (to be recorded once live slice works).
