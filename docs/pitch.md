# VoxDrill — One-Page Pitch

## What it is

VoxDrill is a voice-first trainer for high-stakes workplace calls. You speak your
decisions into a live emergency scenario; the simulation reacts to each decision;
and you finish with an after-action report where every point traces to a logged
turn. Three scenarios ship: Warehouse Chemical Spill, Forklift Incident, Equipment
Malfunction.

## The problem it solves

High-stakes decisions need muscle memory, but live drills are expensive and
classroom walkthroughs have no stakes. VoxDrill gives trainees a place to make
real calls under voice pressure — including wrong ones — with consequences that
are immediate, explicit, and recoverable.

## The differentiator

Branching reality. A spoken decision mutates a deterministic state machine, not a
chat transcript: cordon the area and the scene changes; clean up early and you get
exposed (−15) with a recovery hint; reassess and the recovery is recorded and
scored. The demo arc is BAD DECISION → SYSTEM REACTS → USER RECOVERS →
SYSTEM ADAPTS → SUCCESS → REPORT, and the report proves it turn by turn.

## Why the AssemblyAI Voice Agent API is load-bearing

The voice loop is the product, not decoration. We use real-time speech streaming
(PCM16 in and out), neural turn detection with barge-in (interrupt the coach
mid-sentence and the audio stops), tool calling (one `submit_action` tool whose
intent enum is exactly the scenario's intent list), and inline session updates
(per-scenario prompt, greeting, and tool schema served from our server). Auth is
server-minted short-lived tokens; the permanent key never reaches the browser.
Code paths: `server/src/voice/tools.ts`, `server/src/app.ts`
(`POST /api/voice/token`, `GET /api/voice/agent-config`), `web/src/voice/`.

## The deterministic-engine / LLM boundary

The LLM interprets natural language into a structured intent enum — and nothing
more. Pure server-side code decides the state transition, the consequence text,
the score delta, and completion (`server/src/scenario/`, `scenarios/*.json`).
Unknown speech is rejected safely (`400 INVALID_INTENT`) with no state change.
Same input → same output, no network, no clock, no randomness inside transitions.

## Evidence and scoring

Every turn appends `{ turn, intent, from, to, scoreDelta }`, enriched server-side
with the sanitized transcript and timestamp. The report renders from that log
alone: headline score over an explicit denominator (strict-progress maximum —
Warehouse 58, Forklift 57, Equipment 65), a breakdown (completed, missed,
invalid, recovery, penalties, each referencing a turn), and a replayable
timeline. Optional safe extras earn bonus points on a separate line, so extra
credit never inflates the headline.

## The three scenarios (one line each)

- Warehouse Chemical Spill: isolate → notify → identify → document → clean (58/58).
- Forklift Incident: secure → call 911 without moving the victim → notify →
  preserve → report (57/57).
- Equipment Malfunction: e-stop → lockout → evacuate → verify the technician →
  report (65/65). The third scenario required zero engine changes — the contract
  is fully data-driven.

## What is novel, and what is standard (honest version)

Novel: the trust architecture — a voice agent that cannot invent outcomes
because it has no authority over state or score, with per-turn evidence as the
receipt. Standard: the rest — Express JSON API, static file serving, hash
routing, SAPI-generated test fixtures, Playwright E2E. The residual risk is also
standard: live speech services are nondeterministic (turn splits, STT variants),
so the three golden-path E2E specs double as a tripwire with every flake logged.

## Roadmap after the hackathon

1. Durable session store (file/SQLite) replacing the in-memory map, so reports
   survive restarts and judges can share links.
2. Phrase→intent eval set with pass@k tracking, turning the tripwire flakes into
   measured mapping quality.
3. A fourth scenario authored by a domain expert using only JSON — the
   no-engine-change proof extended beyond the team.
