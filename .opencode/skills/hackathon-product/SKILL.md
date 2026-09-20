---
name: hackathon-product
description: Product and demo discipline for VoxDrill as a hackathon build. Use when prioritizing scope, writing demo scripts, or preparing judging materials.
---

# Hackathon Product Skill (VoxDrill)

Project-specific skill. Created from scratch.

## Product Thesis

VoxDrill: real-time voice simulation trainer where spoken decisions change the simulated situation, ending in an evidence-based after-action report. Differentiator: **deterministic scenario engine** — the LLM interprets, code adjudicates. Judges can trust the score because it is computed, not hallucinated.

## Scope Control (foundation stage)

Build foundation only. Explicitly OUT for now: extra scenarios, full scoring UI, dashboard, landing page, pitch video, marketing copy. Every task must map to: voice loop, engine, evidence/report, or demo readiness. If it doesn't, defer to `docs/roadmap.md`.

## Demo Priorities

1. Live mic → agent responds → consequence visible in <2s.
2. One unsafe action (e.g. cleaning before isolating) → visible penalty + recovery.
3. After-action report rendered from the evidence log (show the log → trust the score).
4. One-line architecture statement: "LLM interprets, deterministic engine decides."

## Competition Readiness Checklist

- [ ] `docs/competition.md` current (criteria, rivals, edge).
- [ ] `docs/demo-script.md` rehearsed with fallback (mocked-voice mode if venue audio fails).
- [ ] Backup: pre-recorded run + seeded demo session.
- [ ] No secrets in demo env; fresh short-lived tokens.

## Decision Log

Record product decisions in `docs/decisions.md` with date, context, decision, consequence. Keep `project-state/STATE.md` honest: never mark demo-ready without a verified end-to-end run.
