# Voxtra — Product (VoxDrill)

## Concept

A real-time voice simulation trainer where the user's spoken decisions change a simulated situation.

## Core loop

USER SPEAKS → AssemblyAI voice agent → interpret intent → deterministic scenario engine →
state change → consequence → next turn → evidence log → deterministic score → after-action report.

## First scenario: Warehouse Chemical Spill

The trainee faces an unidentified spill. Safe sequencing (isolate → notify → identify → clean)
resolves the drill. Unsafe shortcuts (approach/clean early, leave without reporting) produce
explicit consequences, penalties, and recovery steps.

## Key principle

The LLM interprets natural language into a structured intent enum. Deterministic application
code — and only that code — controls scenario state, transitions, scoring, and completion.
Scores are computed, not hallucinated.

## Non-goals (foundation stage)

Extra scenarios, scoring UI polish, dashboards, landing pages, pitch assets. See `docs/roadmap.md`.
