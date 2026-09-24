# AGENTS.md — OpenCode project-local rules for Voxtra (VoxDrill)

Project context: Voxtra / VoxDrill is a real-time voice simulation trainer built for the
AssemblyAI Voice Agent Hackathon (deadline September 30 2026). Spoken decisions →
AssemblyAI voice agent → deterministic scenario engine → consequences → evidence log →
deterministic score → after-action report. First scenario: Warehouse Chemical Spill.
Root `AGENTS.md` is the authoritative instruction source; this file is the OpenCode-local
operating rules summary. On conflict, root `AGENTS.md` wins.

## Engineering method

PLAN → TEST → IMPLEMENT → VERIFY → REVIEW → FIX → REGRESSION TEST.
TDD is mandatory: failing test first, minimal code to green, then refactor.
Target 80%+ coverage on touched modules. No placeholder tests.

## Hard rules

1. Never expose `ASSEMBLYAI_API_KEY` to the browser. Server-side only (read in `server/`
   from `.env`). The browser gets at most short-lived session material from
   `POST /api/voice/token`. Never print secret values anywhere.
2. Scenario state, transitions, scoring, completion, and critical gates are managed by
   deterministic server-side logic (`server/src/scenario/` + `scenarios/*.json`), never
   solely by LLM output. The LLM maps speech to an `Intent` enum and nothing more.
3. Every important decision produces an evidence record `{ turn, intent, from, to,
   scoreDelta }`. The after-action report renders from this log.
4. Inspect the repository before editing. Read the files you will change first.
5. Prefer incremental changes with a clear definition of done. Small focused commits,
   conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
6. Do not claim success without actual verification. Evidence = command + output.
   Gate order: build → typecheck → lint → tests → security scan.
7. Completion tracking: at the end of every task, update `project-state/STATE.md` with a
   recalculated PROJECT COMPLETION percentage based on the weighted milestones in
   `docs/roadmap.md`. Never inflate the number. Partial work counts only its completed
   portion. Each task report states PROJECT COMPLETION: XX%.

## Harness

- Agents live in `.opencode/agents/` (one `.md` file per agent; filename is the agent
  name; YAML frontmatter carries `name` + `description`). Adapted from the
  `C:\Voxtra\_sources\everything-claude-code` reference; Claude-specific plugin/hook/MCP
  material was dropped.
- Skills live in `.opencode/skills/<name>/SKILL.md` (YAML frontmatter with `name` +
  `description` of 1–1024 chars). Project-specific skills: `voice-agent`,
  `scenario-engine`, `hackathon-product`.
- No Claude plugins, slash commands, or hooks. No real AssemblyAI network calls in unit
  tests — mock at the boundary.

## User setup note

`opencode.json` is intentionally minimal (`$schema` + `name`). The user should add their
preferred `model` and any project-specific `permission` settings there; see the OpenCode
docs at https://opencode.ai/docs for the current schema.
