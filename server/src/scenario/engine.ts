import {
  CompletionCriteria,
  EngineResult,
  ScenarioDefinition,
  ScenarioState,
  isKnownIntent,
} from './types.js';

export function createInitialState(def: ScenarioDefinition): ScenarioState {
  return {
    scenarioId: def.metadata.id,
    current: def.metadata.initialState,
    turn: 0,
    score: def.scoringRules.startScore,
    completed: false,
    flags: {},
    evidence: [],
  };
}

export function isCompleted(
  state: Pick<ScenarioState, 'current' | 'flags'>,
  criteria: CompletionCriteria,
): boolean {
  if (state.current !== criteria.state) return false;
  return criteria.requiredFlags.every((f) => state.flags[f] === true);
}

function cloneState(state: ScenarioState): ScenarioState {
  return {
    ...state,
    flags: { ...state.flags },
    evidence: [...state.evidence],
  };
}

/**
 * applyAction is pure and total: same input -> same output.
 * No I/O, no network, no wall-clock, no randomness.
 * Unknown/invalid intents return ok:false WITHOUT mutating state
 * (except appending an evidence entry for the rejected turn).
 */
export function applyAction(
  def: ScenarioDefinition,
  state: ScenarioState,
  rawIntent: string,
): EngineResult {
  const turn = state.turn + 1;

  if (!isKnownIntent(rawIntent)) {
    const next = cloneState(state);
    next.turn = turn;
    next.evidence.push({ turn, intent: rawIntent, from: state.current, to: state.current, scoreDelta: 0 });
    return {
      ok: false,
      state: next,
      consequence: `Unrecognized action "${rawIntent}". Say what you want to do clearly, e.g. isolate the area or notify your supervisor.`,
      scoreDelta: 0,
      completed: false,
      error: { code: 'INVALID_INTENT', message: `Unknown intent: ${rawIntent}` },
    };
  }

  const transition = def.transitions.find((t) => t.from === state.current && t.intent === rawIntent);

  if (!transition) {
    const next = cloneState(state);
    next.turn = turn;
    next.evidence.push({ turn, intent: rawIntent, from: state.current, to: state.current, scoreDelta: 0 });
    return {
      ok: false,
      state: next,
      consequence: `That action has no effect from "${state.current}". Consider isolating the area or asking for help.`,
      scoreDelta: 0,
      completed: false,
      error: { code: 'NO_TRANSITION', message: `No transition for intent ${rawIntent} from ${state.current}` },
    };
  }

  const next = cloneState(state);
  next.turn = turn;
  next.current = transition.to;
  next.score += transition.scoreDelta;
  for (const f of transition.setFlags ?? []) next.flags[f] = true;
  for (const f of transition.clearFlags ?? []) delete next.flags[f];
  next.evidence.push({
    turn,
    intent: rawIntent,
    from: state.current,
    to: transition.to,
    scoreDelta: transition.scoreDelta,
  });
  next.completed = isCompleted(next, def.completionCriteria);

  return {
    ok: true,
    state: next,
    consequence: transition.consequence,
    scoreDelta: transition.scoreDelta,
    completed: next.completed,
  };
}

export function buildReport(state: ScenarioState, def: ScenarioDefinition): {
  scenarioId: string;
  title: string;
  completed: boolean;
  turns: number;
  score: number;
  evidence: ScenarioState['evidence'];
  recoveryPaths: Record<string, string[]>;
} {
  return {
    scenarioId: def.metadata.id,
    title: def.metadata.title,
    completed: state.completed,
    turns: state.turn,
    score: state.score,
    evidence: [...state.evidence],
    recoveryPaths: def.recoveryPaths,
  };
}
