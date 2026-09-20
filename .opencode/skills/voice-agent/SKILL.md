---
name: voice-agent
description: AssemblyAI Voice Agent integration patterns for Voxtra. Use when working on mic capture, session auth, WebSocket turns, interruption, or tool calling.
---

# Voice Agent Skill (Voxtra × AssemblyAI)

Project-specific skill. Created from scratch for VoxDrill.

## Architecture (verified against official AssemblyAI docs — see docs/architecture.md)

```
Browser mic (getUserMedia)
  → fetch short-lived session material from OUR server (POST /api/voice/token)
  → open AssemblyAI voice session per official docs (server mints/relays; key never in client)
  → stream mic audio; receive transcript + agent-audio events
  → transcript → structured intent (LLM interprets, allowlisted enum only)
  → POST intent to /api/sessions/:id/turn (deterministic engine decides)
  → render consequence; continue turn loop
```

## Rules

1. **Key server-side always.** `ASSEMBLYAI_API_KEY` is read only in `server/`. The browser receives at most short-lived session material. Never hardcode, never log, never return the raw key.
2. **Official docs are truth.** Do not rely on stale examples. Confirm endpoint names, event shapes, and auth flow in https://www.assemblyai.com/docs before implementing. Record findings in `docs/architecture.md`.
3. **Deterministic boundary.** The voice agent may interpret language, but it NEVER decides state, score, or completion. Every turn result comes from `applyAction(state, intent)`.
4. **Intent contract.** Voice output must collapse to the scenario's `Intent` enum (e.g. `isolate_area`, `notify_supervisor`, …). Unknown text → `unknown` → engine rejects safely without mutating state.
5. **Realtime UX.** Support barge-in (user interrupts agent), turn detection, partial + final transcripts, and clear status (listening/thinking/speaking).
6. **Testability.** All voice paths work with a mock transport in tests/E2E. No real key or network in unit tests.

## Session Configuration Checklist

- [ ] Server endpoint mints/relays session per current docs
- [ ] Client handles token expiry + reconnect with backoff
- [ ] Transcript events (partial/final) wired to UI
- [ ] Agent audio playback + interruption wired
- [ ] Turn detection tuned for natural pauses
- [ ] Tool/function calling (if used) maps only to `POST /turn` with allowlisted intents

## Failure Modes

Mic denied → explain + text-fallback. Token expired → re-fetch + resume. WebSocket drop → reconnect, preserve `sessionId` and engine state. Engine rejects intent → speak the consequence text, do not retry silently.
