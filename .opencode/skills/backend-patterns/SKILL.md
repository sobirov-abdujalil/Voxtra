---
name: backend-patterns
description: Backend architecture patterns for Voxtra's Express + TypeScript API. Use when building API routes, services, or integrations.
---

# Backend Patterns

Adapted from Everything Claude Code `backend-patterns` for Voxtra.

## API Design

Resource-based routes under `/api`:

```typescript
GET    /api/health            // liveness
GET    /api/scenarios         // list scenarios
GET    /api/scenarios/:id     // scenario definition (no secrets)
POST   /api/sessions          // create drill session (server mints session context)
POST   /api/sessions/:id/turn // submit structured intent -> engine transition
GET    /api/sessions/:id      // state + evidence log (no secrets)
GET    /api/sessions/:id/report // after-action report
POST   /api/voice/token       // short-lived voice session material (never the raw API key)
```

- Query params for filtering/pagination: `?limit=20&offset=0`.
- Consistent envelope: `{ ok: true, data }` / `{ ok: false, error: { code, message } }`.
- Validate bodies with `zod`; reject unknown intent strings with `400 INVALID_INTENT`.

## Layering

```
routes/      -> HTTP only: parse, validate, call service, serialize
services/    -> orchestration (session store, engine calls, AssemblyAI client)
scenario/    -> deterministic engine (pure functions, no I/O)
integrations/-> AssemblyAI client wrapper (key read from env, server-side only)
```

## Rules

- Engine functions are pure: `(state, intent) => { state, events, consequence }`. No network, no randomness (seeded where needed).
- Secrets via `process.env` only; fail fast with a clear error if missing (never print the value).
- Rate-limit session/turn endpoints; cap body size.
- Log without PII/secrets; include `sessionId` correlation IDs.
