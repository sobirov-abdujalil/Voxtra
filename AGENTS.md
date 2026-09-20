# AGENTS.md — Voxtra (VoxDrill): Authoritative Project Instructions

This file is the single source of truth for how to work in this repository. All agents, skills, and contributors must follow it. When in doubt, this file wins over any other doc.

## 1. Project Purpose

**Voxtra / VoxDrill**: a real-time voice simulation trainer where the user's spoken decisions change a simulated situation.

- First scenario: **Warehouse Chemical Spill**.
- Core loop: USER SPEAKS → AssemblyAI voice agent → interpret intent → **deterministic scenario engine** → state change → consequence → next turn → evidence log → deterministic score → after-action report.
- The product's differentiator is trust: scores and outcomes are **computed by code, not hallucinated by the LLM**.

## 2. Architecture Principles

1. **Deterministic authority.** Scenario state, transitions, scoring, completion, and critical gates live in pure server-side TypeScript (`server/src/scenario/` + `scenarios/*.json`). The LLM interprets natural language into a structured `Intent` enum and nothing more.
2. **Thin client.** `web/` renders server-provided state. It never computes scores, transitions, or completion.
3. **Simple stable stack.** TypeScript throughout. Express API (`server/`), Vite + TypeScript client (`web/`), Vitest for tests. npm workspaces. Node 24 baseline.
4. **No over-engineering.** Foundation first. Defer dashboards, landing pages, extra scenarios, and polish to `docs/roadmap.md`.
5. **Docs reflect reality.** Never document a feature as done unless verified by a passing command. Update `project-state/STATE.md` after every meaningful change.

## 3. AssemblyAI Integration Rules

1. `ASSEMBLYAI_API_KEY` is **server-side only** (read in `server/` from `.env`). Never in `web/`, never in responses, logs, commits, or chat output.
2. The browser obtains at most **short-lived session material** from `POST /api/voice/token`. The raw key never leaves the server.
3. **Official docs are the source of truth**: https://www.assemblyai.com/docs. Do not implement from stale examples. Record the verified design in `docs/architecture.md`.
4. Voice-layer failures (mic denied, token expiry, socket drop) must degrade gracefully with reconnect + preserved `sessionId`/engine state.
5. No real AssemblyAI network calls in unit tests — mock at the boundary. E2E uses mocks unless explicitly marked live.

## 4. Deterministic Scenario-Engine Rules

1. `applyAction(state, intent)` is **pure and total**: same input → same output; unknown intents return `ok: false` without mutating state.
2. No I/O, network, wall-clock, or unseeded randomness inside transitions.
3. Invalid/unsafe actions produce **explicit consequences** (penalty + evidence entry + recovery hint), never silent no-ops.
4. `completed` is computed from state + `completionCriteria`, never asserted by the LLM.
5. Every turn appends an evidence entry `{ turn, intent, from, to, scoreDelta }`. The after-action report renders **from this log**.
6. No hardcoded spoken phrases in the engine. Phrase → intent mapping lives in the voice layer.
7. Every failure state has ≥1 documented recovery path.

## 5. Security Rules

- Never hardcode secrets. Never commit `.env`. Never print secret values (in code, logs, diffs, or chat).
- Validate every POST body with `zod`; allowlist intent enums; `400 INVALID_INTENT` on unknown.
- Sanitize transcripts before rendering (text, not HTML).
- Rate-limit `/api/voice/token` and `/api/sessions*/turn`; cap body sizes; CORS allowlist; `helmet` headers.
- `npm audit --audit-level=high` must pass before merge. Critical finding → STOP → fix → rescan.

## 6. Testing Requirements

- **TDD**: tests first (RED), minimal code (GREEN), refactor. Target **80%+** on touched modules.
- Required coverage: engine (valid/invalid/critical/completion/scoring/evidence/recovery), API validation + no-secret-leakage, security, critical browser smoke (mocked network).
- No fake tests (`expect(true).toBe(true)` forbidden). Deterministic engine tests need no network/LLM.
- Every bug fix ships with a regression test written first.

## 7. Coding Conventions

- TypeScript `strict`. No `any` without justification. 2-space indent, single quotes, semicolons.
- Small functions (<50 lines), nesting ≤4. Descriptive names. Explicit error handling.
- Layout: `server/src/{routes,services,scenario,integrations}`, `web/src`, `scenarios/*.json`, `tests/` mirroring source.
- `npm run lint` + `npx tsc --noEmit` green before every commit.

## 8. Verification Requirements

- Never claim something works without running it. Evidence = command + output.
- Gate order: `build` → `typecheck` → `lint` → `tests` → `security scan`. Use the `verifier` agent or `verification-loop` skill.
- Record results in `project-state/STATE.md`; regressions in `project-state/REGRESSIONS.md`.

## 9. Git Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`). Small focused commits.
- Never commit `.env`, `node_modules`, `dist`, `build`, coverage, or logs. `.env.example` (names only) IS committed.
- Never force-push. Never overwrite remotes. Do not push unless a remote exists and is clearly the user's.

## 10. Project-State Workflow

- `project-state/STATE.md` — current honest status. `CURRENT_TASK.md` — the one active task. `COMPLETED.md` — dated log. `BLOCKERS.md` — anything needing the user. `REGRESSIONS.md` — test/eval failures.
- Update state files with every task. One `in_progress` item at a time.
- Blockers requiring the user's personal account/secret/auth/browser approval go in `BLOCKERS.md` — do not work around auth by hardcoding.

## 11. Scope-Control Rules

- This stage is **foundation + setup**. OUT: extra scenarios, scoring UI polish, dashboards, landing pages, pitch assets.
- New scope needs a decision entry in `docs/decisions.md` and a roadmap slot in `docs/roadmap.md`.
- Future implementation proceeds one DeepSeek-generated task at a time on top of this skeleton.

## 12. OpenCode Harness

- Agents: `.opencode/agents/` (planner, architect, tdd-guide, code-reviewer, security-reviewer, build-error-resolver, e2e-runner, verifier).
- Skills: `.opencode/skills/` (coding-standards, backend-patterns, frontend-patterns, tdd-workflow, verification-loop, eval-harness, security-review, voice-agent, scenario-engine, hackathon-product).
- ECC provenance: adapted from `C:\Voxtra\_sources\everything-claude-code` (Claude-specific tool/model declarations removed; OpenCode-native). `voice-agent`, `scenario-engine`, `hackathon-product` created from scratch.
