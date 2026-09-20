---
name: eval-harness
description: Eval-driven development framework for Voxtra voice and scenario behavior. Use to define expected behavior before implementation and track regressions.
---

# Eval Harness

Adapted from Everything Claude Code `eval-harness` for Voxtra.

## Philosophy

Evals are the "unit tests of AI development": define expected behavior BEFORE implementation, run continuously, track regressions.

## Eval Types

### Capability evals
```markdown
[CAPABILITY EVAL: voice-interrupt]
Task: User interrupts agent mid-speech; agent yields within 1s.
Success: [ ] audio stops [ ] turn preserved [ ] no state corruption
```

### Regression evals
```markdown
[REGRESSION EVAL: spill-scoring]
Baseline: <git sha>
Tests: engine-scoring suite PASS/FAIL, report determinism PASS/FAIL
Result: X/Y passed (previously Y/Y)
```

## Grader Types

1. **Code-based (deterministic)**: engine assertions, `npm test`, grep for patterns.
2. **LLM-judged (interpretive)**: transcript → intent mapping quality, tone. Always pair with a deterministic guardrail (allowlisted intent enum).
3. **Human spot-check**: demo-script runs for voice UX.

## Voxtra Rules

- Deterministic behavior (state, scoring, completion) is graded by code, never by LLM vote.
- LLM-judged evals only grade interpretation quality (did the transcript map to the right intent?).
- Store eval definitions in `tests/evals/`; record results in `project-state/REGRESSIONS.md`.
- Metrics: pass@k for flaky-prone voice paths; track over time.
