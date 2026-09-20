# Voxtra — VoxDrill voice simulation trainer (foundation)

Real-time voice simulation trainer: spoken decisions → AssemblyAI voice agent →
deterministic scenario engine → consequences → evidence-based after-action report.

## Quickstart

```bash
npm install
npm run build
npm test
```

```bash
# server (:3001) — needs .env with ASSEMBLYAI_API_KEY for live voice token minting
Copy-Item .env.example .env   # then fill values locally; never commit .env
npm run dev:server

# web (:5173, proxies /api to :3001)
npm run dev:web
```

## Layout

- `server/` — Express API + deterministic scenario engine + AssemblyAI token minting
- `web/` — Vite + TypeScript client (no secrets, no authoritative logic)
- `scenarios/` — JSON scenario definitions (first: Warehouse Chemical Spill)
- `server/tests/` — Vitest suites (engine, API, no-secret-leakage)
- `docs/` — product, architecture, decisions, roadmap, demo-script, test-plan, competition
- `project-state/` — STATE, CURRENT_TASK, COMPLETED, BLOCKERS, REGRESSIONS
- `.opencode/` — OpenCode-native agents + skills (adapted from ECC reference in `_sources/`)

## Rules

See `AGENTS.md`. Key invariants: the AssemblyAI key stays server-side; the deterministic
engine owns state/scoring/completion; nothing is "done" without a verified command.
