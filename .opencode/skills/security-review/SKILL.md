---
name: security-review
description: Security checklist and patterns for Voxtra. Use for auth, user input, API endpoints, secrets, and third-party integrations.
---

# Security Review

Adapted from Everything Claude Code `security-review` for Voxtra.

## When to Activate

Auth, user input, file handling, new endpoints, secrets, credentials, third-party APIs (AssemblyAI), sensitive data.

## Checklist

### 1. Secrets
```typescript
// NEVER
const apiKey = "sk-xxxxx";
// ALWAYS (server-side only)
const apiKey = process.env.ASSEMBLYAI_API_KEY;
if (!apiKey) throw new Error('ASSEMBLYAI_API_KEY not configured');
```
- `.env` never committed (gitignored). `.env.example` contains names only, no values.
- Real key never sent to browser, never in responses/logs/history.

### 2. Input validation
- `zod` schemas on all POST bodies; allowlist intent enums; reject unknown with 400.
- Sanitize transcripts before rendering (text, not HTML).

### 3. API hardening
- Rate limits on `/api/voice/token`, `/api/sessions*/turn`; body-size caps; CORS allowlist; security headers (helmet).
- Generic error messages to clients; detailed logs server-side without secrets.

### 4. Dependencies
- `npm audit --audit-level=high`; update vulnerable packages; check licenses.

## Response Protocol

Critical finding → STOP → fix → rotate exposed secret if any → rescan → record in `project-state/REGRESSIONS.md`.
