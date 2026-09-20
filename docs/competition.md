# Voxtra — Competition Notes (early draft)

## Arena

Voice-AI / simulation-training hackathon entries. Most demos show fluent conversation but
hand-wave adjudication: the same LLM that chats also declares the score.

## Our edge

**Deterministic adjudication.** The voice agent interprets; the scenario engine decides.
Every score traces to a logged `(turn, intent, from, to, scoreDelta)` chain rendered in the
after-action report. Judges can audit the outcome instead of trusting a chatbot.

## What judges see

1. Live mic → consequence in <2s.
2. An unsafe action visibly penalized with a recovery path.
3. The evidence log → the score (trust moment).
4. One-line architecture: "LLM interprets, deterministic engine decides."

## Risks

- Live-venue audio is hostile → text-fallback + pre-recorded backup (see `demo-script.md`).
- Voice latency variance → keep turn loop server-local fast; stream consequences eagerly.
- Competitors with prettier UI → win on the trust story, not pixels (foundation stage).
