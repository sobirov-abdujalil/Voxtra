# Voxtra — Roadmap

## Milestone weights (authoritative for PROJECT COMPLETION %)

Milestone weights M1–M6 sum to exactly 100%. Every task's completion percentage is
computed against these. Foundation credit (3 pts, pre-milestone harness/scaffold/
architecture work completed 2026-09-20) is tracked separately outside the milestone
100 — see the 2026-09-23 reconciliation entry in `docs/decisions.md`. PROJECT
COMPLETION reports raw points on this scale (claimed points to date; M5 + M6
unclaimed = 35 pts).

| Milestone | Dates (2026) | Scope | Weight |
|-----------|--------------|-------|--------|
| Foundation (pre-M1) | Sept 20 | Harness, monorepo scaffold, deterministic engine skeleton, verified AssemblyAI design | 3 pts (separate credit, completed) |
| M1 | Sept 20–22 | Core voice loop + Warehouse Spill scenario engine | 25% |
| M2 | Sept 23–24 | Evidence system + deterministic scoring | 15% |
| M3 | Sept 25–26 | UI polish + after-action report | 15% |
| M4 | Sept 27–28 | Second/third scenarios (Forklift Incident, Equipment Malfunction) | 10% |
| M5 | Sept 29 | Deployment + demo script + submission prep | 20% |
| M6 | Sept 30 | Submission QA + final submission | 15% |
| **Total** | | | **100% milestones + 3 pts foundation** |

## Done (foundation, 2026-09-20)

- [x] OpenCode harness (8 agents, 10 skills), `AGENTS.md`
- [x] Monorepo scaffold (server/web/scenarios/tests), env template, gitignore
- [x] Deterministic engine + Warehouse Chemical Spill definition + tests
- [x] API skeleton (health/scenarios/sessions/turn/report/voice-token) + no-leak tests
- [x] Web skeleton (session UI, text-intent fallback, voice socket skeleton)
- [x] Docs + project-state; verified AssemblyAI integration design
- [x] Live voice loop (M1, 2026-09-20): inline session config + `submit_action` tool,
      hardened token endpoint + agent-config endpoint, AudioWorklet PCM16 streaming/playback
      with barge-in, transcript→turn→tool.result wiring, full evidence shape, UI wiring
      (mic/transcript/state/consequence), 19 voice tests (42/42 green); real-mic drill pending user

## Next (one task at a time)

1. **Report UI**: evidence timeline + score breakdown rendering.
2. **Intent mapping**: phrase→intent mapper with eval set (mocked), `unknown` fallback quality.
3. **Report UI**: evidence timeline + score breakdown rendering.
4. **E2E smoke**: Playwright mocked-network suite in CI.
5. **Session persistence**: durable store (file/SQLite) replacing in-memory map.
6. **Second scenario**: only after the first drills end-to-end live.

## Explicitly deferred

Extra scenarios, scoring UI polish, dashboards, landing pages, pitch assets, demo video.
