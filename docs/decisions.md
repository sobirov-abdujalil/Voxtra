# Voxtra — Decisions

| Date | Context | Decision | Consequence |
|------|---------|----------|-------------|
| 2026-09-20 | Stack selection | TypeScript monorepo: Express API (`server/`), Vite vanilla-TS client (`web/`), Vitest, npm workspaces, Node 24 | Simple, stable, no framework churn; thin client, deterministic server |
| 2026-09-20 | ECC reference | Adapt (don't copy): 8 agents + 7 skills rewritten OpenCode-native; 3 new project skills (voice-agent, scenario-engine, hackathon-product); drop Claude-specific tool/model declarations, hooks, MCP configs, plugins | Lean harness that actually works with OpenCode |
| 2026-09-20 | Voice integration | AssemblyAI Voice Agent API per official docs: server mints one-time token (`GET /v1/token`), browser connects via `?token=` + `session.update` first | Raw key stays server-side; verified design in `docs/architecture.md` |
| 2026-09-20 | Engine authority | Deterministic `applyAction` owns state/scoring/completion; LLM maps speech → intent enum only | Trustworthy scores; testable without network/LLM |
| 2026-09-20 | Scope | Foundation + setup only; product polish deferred to `docs/roadmap.md` | Future work proceeds one task at a time |
