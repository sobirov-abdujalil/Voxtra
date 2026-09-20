# Voxtra — Test Plan

## Targets

- 80%+ coverage on touched modules. No placeholder tests.

## Suites

1. **Engine** (`server/tests/engine.test.ts`): golden path, invalid/critical actions, unknown
   intents, determinism/purity, scoring + evidence chain, recovery paths, completion criteria.
2. **API** (`server/tests/api.test.ts`): health, scenario listing, session create/turn/report,
   validation errors (`INVALID_INTENT`, `BAD_REQUEST`, `NOT_FOUND`), no-secret-leakage
   (responses never contain the key; token mint mocked at fetch boundary).
3. **Security**: `npm audit --audit-level=high`; secret-pattern scan of `web/` + diffs.
4. **Browser** (next task): Playwright smoke with mocked network — load, start session,
   mock intent, consequence render, report render.
5. **Evals** (next task): phrase→intent mapping quality (`tests/evals/`), pass@k on voice paths,
   results in `project-state/REGRESSIONS.md`.

## Rules

- Deterministic engine tests: no network, no LLM, no real AssemblyAI calls.
- Every bug fix ships with a regression test written first.
- Gate order: build → typecheck → lint → tests → security scan.
