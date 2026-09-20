---
name: tdd-workflow
description: Enforces test-driven development with 80%+ coverage. Use when writing features, fixing bugs, or refactoring.
---

# TDD Workflow

Adapted from Everything Claude Code `tdd-workflow` for Voxtra.

## When to Activate

Writing features, fixing bugs, refactoring, adding endpoints or components.

## Core Principles

1. **Tests BEFORE code** — always.
2. **80%+ coverage** on touched modules (unit + integration).
3. **All test types where relevant**: unit (engine pure functions), integration (API routes with mocked AssemblyAI), E2E (Playwright smoke, mocked network).

## Cycle

1. RED: write failing test describing desired behavior.
2. Run: confirm it fails (`npm test`).
3. GREEN: minimal implementation to pass.
4. REFACTOR: clean up, tests stay green.
5. VERIFY: coverage + typecheck + lint.

## Voxtra Rules

- Engine tests are deterministic: no network, no LLM, no randomness.
- Intent-boundary tests: unknown/garbled intents are rejected safely (`ok: false`, no state mutation).
- Each bug fix ships with a regression test written first.
- No placeholder tests (`expect(true).toBe(true)` is forbidden).
