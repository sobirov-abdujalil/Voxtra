# Voxtra — Roadmap

## Done (foundation, 2026-09-20)

- [x] OpenCode harness (8 agents, 10 skills), `AGENTS.md`
- [x] Monorepo scaffold (server/web/scenarios/tests), env template, gitignore
- [x] Deterministic engine + Warehouse Chemical Spill definition + tests
- [x] API skeleton (health/scenarios/sessions/turn/report/voice-token) + no-leak tests
- [x] Web skeleton (session UI, text-intent fallback, voice socket skeleton)
- [x] Docs + project-state; verified AssemblyAI integration design

## Next (one task at a time)

1. **Live voice slice**: provision stored agent (or inline config), complete AudioWorklet PCM16
   streaming + playback queue, wire final transcripts → intent → `/turn` → speak consequence.
2. **Intent mapping**: phrase→intent mapper with eval set (mocked), `unknown` fallback quality.
3. **Report UI**: evidence timeline + score breakdown rendering.
4. **E2E smoke**: Playwright mocked-network suite in CI.
5. **Session persistence**: durable store (file/SQLite) replacing in-memory map.
6. **Second scenario**: only after the first drills end-to-end live.

## Explicitly deferred

Extra scenarios, scoring UI polish, dashboards, landing pages, pitch assets, demo video.
