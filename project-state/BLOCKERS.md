# BLOCKERS.md — items needing the user

None blocking the foundation. Upcoming items that genuinely need the user:

1. **AssemblyAI live verification** — needs the real `ASSEMBLYAI_API_KEY` exercised against
   `GET /v1/token` + a live browser session. The key exists in local `.env`; no action needed
   unless minting fails (then: check key validity/quota in the AssemblyAI dashboard).
2. **Stored agent provisioning** (`POST /v1/agents`) — decision: stored `agent_id` vs inline
   session config. Requires account access; cannot be done without the user's AssemblyAI account.
3. **Mic/browser E2E** — requires a real browser + microphone permission on the user's machine.
4. **Git remote** — no remote configured. Push only when the user confirms the repository.
