---
name: coding-standards
description: Universal coding standards for TypeScript, JavaScript, React, and Node.js in Voxtra. Use when writing or reviewing any code.
---

# Coding Standards

Adapted from Everything Claude Code `coding-standards` for Voxtra + OpenCode.

## Principles

1. **Readability first** — code is read more than written. Clear names, consistent formatting.
2. **KISS** — simplest working solution; no premature optimization.
3. **DRY** — extract shared logic; no copy-paste.
4. **YAGNI** — don't build speculative features.

## TypeScript Rules

- `strict: true`. No `any` without justification; prefer `unknown` + narrowing.
- Descriptive names: `scenarioState`, `isSessionActive` — not `s`, `flag`, `x`.
- Small functions (<50 lines), nesting ≤4 levels.
- Handle errors explicitly; never swallow with empty `catch`.
- Validate all external input (API bodies, intent strings) with an allowlist or schema.

```typescript
// GOOD
const activeScenarioId: string = 'warehouse-chemical-spill';

// BAD
const x = 'warehouse-chemical-spill';
```

## Structure

- `server/src/` — Express API, scenario engine, AssemblyAI integration (server-side only).
- `web/src/` — Vite + TypeScript client. No secrets, no authoritative logic.
- `scenarios/` — declarative JSON scenario definitions.
- `tests/` — vitest suites mirroring source layout.

## Formatting & Lint

- Prettier-compatible style, 2-space indent, single quotes, semicolons (enforced by lint).
- Run `npm run lint` and `npx tsc --noEmit` before every commit.

## Security

- No hardcoded secrets. `process.env.*` server-side only.
- Never log secret values. Never return them in API responses.
