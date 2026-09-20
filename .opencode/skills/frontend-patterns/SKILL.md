---
name: frontend-patterns
description: Frontend patterns for Voxtra's Vite + TypeScript web client. Use when building UI components, state, or voice interactions.
---

# Frontend Patterns

Adapted from Everything Claude Code `frontend-patterns` for Voxtra (Vite + vanilla TypeScript, React-compatible).

## Component Principles

- Composition over inheritance; small focused modules.
- Explicit state machine for drill UI: `idle → requesting-mic → live → paused → report`.
- Render is a pure function of server-provided session state; the client never computes authoritative state or scores.

## Voice UI Rules

- Mic access via `getUserMedia` only after explicit user gesture; handle denial gracefully.
- Show live status: listening / thinking / speaking / interrupted.
- Interruption support: user speech must be able to cut agent audio (barge-in) — UI reflects it instantly.
- Never embed API keys or tokens in source; fetch short-lived session material from `/api/voice/token` at session start.

## Data Fetching

```typescript
const res = await fetch('/api/sessions/abc/turn', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ intent: 'isolate_area' }),
});
const body = await res.json();
if (!body.ok) throw new Error(body.error.message);
renderState(body.data.state);
```

## Performance & A11y

- Lazy-load report views; keep first paint < 2s on desktop.
- Keyboard-accessible controls; visible focus; live-region announcements for consequences.
- Sanitize any transcript HTML before rendering (treat as untrusted text).
