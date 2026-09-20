---
name: scenario-engine
description: Deterministic scenario engine rules for Voxtra. Use when defining scenarios, transitions, scoring, evidence, or completion logic.
---

# Scenario Engine Skill (Voxtra)

Project-specific skill. Created from scratch for VoxDrill.

## The Invariant

The LLM MUST NOT be authoritative for scenario state, scoring, completion, or critical transitions. The LLM interprets natural language → structured intent. Deterministic code decides everything else.

## Engine Contract

```typescript
type Intent = 'isolate_area' | 'notify_supervisor' | 'inspect_label'
  | 'ask_for_help' | 'approach_spill' | 'clean_spill' | 'leave_area' | 'unknown';

interface EngineResult {
  ok: boolean;
  state: ScenarioState;      // new authoritative state (unchanged if !ok)
  events: EngineEvent[];     // evidence log entries appended this turn
  consequence: string;       // user-facing narration of what happened
  scoreDelta: number;        // deterministic points awarded/removed
  completed: boolean;        // scenario completion flag
  error?: { code: string; message: string };
}

function applyAction(state: ScenarioState, intent: Intent): EngineResult; // pure, deterministic
```

## Scenario Definition (scenarios/*.json + TypeScript types)

Required fields: `metadata` (id, title, version), `initialState`, `states[]`, `actions[]` (valid/invalid/critical flags), `transitions[]` (from + intent → to + consequence + scoreDelta + evidence), `completionCriteria`, `scoringRules`, `evidenceRequirements`, `recoveryPaths`.

## Rules

1. **Pure functions.** No I/O, no network, no `Date.now()`/`Math.random()` inside transitions (inject clock/seed if needed). Same `(state, intent)` → same result, always.
2. **Allowlist intents.** Unknown intent → `ok: false`, `INVALID_INTENT`, state unchanged, evidence logged.
3. **Invalid actions have consequences.** E.g. `clean_spill` before `isolate_area` fails with a safety consequence + score penalty + evidence entry — not a silent no-op.
4. **Critical actions gated.** Define preconditions (e.g. must `inspect_label` before `clean_spill`); enforce in code, not prompts.
5. **Evidence everything.** Every turn appends `{ turn, intent, from, to, scoreDelta, timestamp }` to the session log. The after-action report is rendered FROM this log.
6. **Completion is computed.** `completed` derives from state + criteria (e.g. area isolated + supervisor notified + correct cleanup), never from LLM assertion.
7. **Recovery paths.** Every failure state has ≥1 valid action leading back toward completion; document them.
8. **No phrase hardcoding.** Engine accepts intent enums; phrase→intent mapping lives in the voice layer and is tested separately with mocks.

## First Scenario: Warehouse Chemical Spill

- Initial state: `unidentified_spill`.
- Intents: `isolate_area`, `notify_supervisor`, `inspect_label`, `ask_for_help`, `approach_spill`, `clean_spill`, `leave_area`.
- Golden path (conceptual): isolate → notify → inspect → correct cleanup → report. Unsafe shortcuts (approach/clean early, leave without notifying) produce deterministic penalties and recovery steps. Exact numbers live in `scenarios/warehouse-chemical-spill.json` and are covered by tests.
