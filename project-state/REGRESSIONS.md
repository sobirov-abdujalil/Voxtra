# REGRESSIONS.md — test/eval failures

## 2026-09-20 quality gate — all resolved

1. Missing `@vitest/coverage-v8` (test script used `--coverage`). Fixed: added dep.
2. `rootDir` conflicts (`src` vs `tests/`, `vite.config.ts`). Fixed: removed `rootDir`; added `tsconfig.build.json` (src-only) for emit.
3. `loader.ts` wrong relative import (`./scenario/types.js`). Fixed: `./types.js`.
4. ESLint `no-undef` on TS types + default `.js`-only file matching. Fixed: `--ext .ts`, disabled `no-undef`/`no-unused-vars` base rules for TS (tsc + plugin cover them).
5. `npm audit --audit-level=high` failed (1 high + 2 critical in vite/vitest dev tooling). Fixed: vitest 2→4.1.11, coverage-v8 →4.1.11, vite 5→6.4.3. Result: 0 vulnerabilities. Residual: 4 moderate dev-only advisories (below gate), documented via `npm audit` output.

No open failures.
