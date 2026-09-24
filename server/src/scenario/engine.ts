import {
  CompletionCriteria,
  EngineResult,
  ScenarioDefinition,
  ScenarioState,
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
 * Failure states are data-driven per scenario. Warehouse (no field) defaults to
 * the historic {'exposed','abandoned'} set so its behavior is unchanged.
 * Forklift defines failureStates: [] (invalid actions are self-loop penalties
 * with no state change, so there are no distinct failure states).
 */
const DEFAULT_FAILURE_STATES = new Set(['exposed', 'abandoned']);

function getFailureStates(def: ScenarioDefinition): Set<string> {
  if (Array.isArray(def.failureStates)) return new Set(def.failureStates);
  return DEFAULT_FAILURE_STATES;
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

  if (!def.intents.includes(rawIntent)) {
    const next = cloneState(state);
    next.turn = turn;
    next.evidence.push({
      turn,
      intent: rawIntent,
      from: state.current,
      to: state.current,
      scoreDelta: 0,
      rule: `rejected::${rawIntent}`,
      result: 'rejected',
    });
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
    next.evidence.push({
      turn,
      intent: rawIntent,
      from: state.current,
      to: state.current,
      scoreDelta: 0,
      rule: `${state.current}::${rawIntent}::rejected`,
      result: 'rejected',
    });
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
    rule: `${state.current}::${rawIntent}`,
    result: 'applied',
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

export interface ReportBreakdownEntry {
  action?: string;
  turn?: number;
  intent?: string;
  rule?: string;
  from?: string;
  to?: string;
  scoreDelta?: number;
}

export interface ReportBreakdown {
  completed: Array<{ action: string; turn: number; scoreDelta: number }>;
  missed: Array<{ action: string }>;
  invalid: Array<{ turn: number; intent: string; rule: string }>;
  recovery: Array<{ turn: number; intent: string; from: string; to: string; scoreDelta: number }>;
  penalties: Array<{ turn: number; intent: string; rule: string; scoreDelta: number }>;
}

export interface ReportData {
  scenarioId: string;
  title: string;
  completed: boolean;
  turns: number;
  score: number;
  denominator: number;
  maxScore: number;
  /**
   * Option-A headline contract (2026-09-22 H4 fix): the headline numerator
   * never exceeds the denominator. headlineScore is the required-path score
   * (total minus bonus excess); bonusPoints is the extra credit above the
   * denominator, rendered on a separate labeled line. score stays the raw
   * deterministic total so the breakdown still adds up.
   */
  headlineScore: number;
  bonusPoints: number;
  summary: string;
  breakdown: ReportBreakdown;
  evidence: ScenarioState['evidence'];
  recoveryPaths: Record<string, string[]>;
}

/**
 * Denominator: max score over strict-progress paths (no self-loop stays,
 * to !== from), no repeated states, depth-capped. This is the score
 * of the minimal required safe sequence (e.g., 58 = 10+10+8+10+20).
 * Pure and deterministic. Failure states are never part of the max
 * (entry requires a penalty), so the search stays on the main chain.
 */
export function computeDenominator(def: ScenarioDefinition): number {
  const failureStates = getFailureStates(def);
  let best = def.scoringRules.startScore;
  let found = false;
  const visited = new Set<string>();
  const dfs = (
    state: string,
    flags: Set<string>,
    score: number,
    depth: number,
  ): void => {
    if (state === def.completionCriteria.state && def.completionCriteria.requiredFlags.every((f) => flags.has(f))) {
      if (!found || score > best) {
        best = score;
        found = true;
      }
      return;
    }
    if (depth >= 12 || visited.has(state)) return;
    visited.add(state);
    for (const t of def.transitions) {
      if (t.from !== state) continue;
      if (t.to === t.from) continue;
      if (t.scoreDelta < 0) continue;
      if (failureStates.has(t.to)) continue;
      const next = new Set(flags);
      for (const f of t.setFlags ?? []) next.add(f);
      for (const f of t.clearFlags ?? []) next.delete(f);
      dfs(t.to, next, score + t.scoreDelta, depth + 1);
    }
    visited.delete(state);
  };
  dfs(def.metadata.initialState, new Set<string>(), def.scoringRules.startScore, 0);
  return found ? best : def.scoringRules.startScore;
}

/**
 * Theoretical maximum with optional self-loop bonuses (each positive
 * self-loop taken at most once). Self-loops never change state, so they
 * can always be collected when visiting that state; the remaining
 * progress search is over state-changing moves only (fast DAG walk).
 * Unbounded farming (repeating the same self-loop) is excluded, so the
 * result is finite. Pure and deterministic.
 */
export function computeMaxScore(def: ScenarioDefinition): number {
  const failureStates = getFailureStates(def);
  const selfSum = new Map<string, number>();
  const selfFlags = new Map<string, string[]>();
  for (const t of def.transitions) {
    if (t.from !== t.to) continue;
    if (t.scoreDelta <= 0) continue;
    if (failureStates.has(t.from)) continue;
    selfSum.set(t.from, (selfSum.get(t.from) ?? 0) + t.scoreDelta);
    for (const f of t.setFlags ?? []) {
      const list = selfFlags.get(t.from) ?? [];
      if (!list.includes(f)) list.push(f);
      selfFlags.set(t.from, list);
    }
  }
  let best = def.scoringRules.startScore;
  let found = false;
  const visited = new Set<string>();
  const dfs = (
    state: string,
    flags: Set<string>,
    score: number,
    depth: number,
  ): void => {
    const withSelf = score + (selfSum.get(state) ?? 0);
    const merged = new Set(flags);
    for (const f of selfFlags.get(state) ?? []) merged.add(f);
    if (state === def.completionCriteria.state && def.completionCriteria.requiredFlags.every((f) => merged.has(f))) {
      if (!found || withSelf > best) {
        best = withSelf;
        found = true;
      }
    }
    if (depth >= 12 || visited.has(state)) return;
    visited.add(state);
    const base = withSelf;
    for (const t of def.transitions) {
      if (t.from !== state) continue;
      if (t.to === t.from) continue;
      if (t.scoreDelta < 0) continue;
      if (failureStates.has(t.to)) continue;
      const next = new Set(merged);
      for (const f of t.setFlags ?? []) next.add(f);
      for (const f of t.clearFlags ?? []) next.delete(f);
      dfs(t.to, next, base + t.scoreDelta, depth + 1);
    }
    visited.delete(state);
  };
  dfs(def.metadata.initialState, new Set<string>(), def.scoringRules.startScore, 0);
  return best;
}

export function buildBreakdown(
  evidence: ScenarioState['evidence'],
  def: ScenarioDefinition,
): ReportBreakdown {
  const completed: ReportBreakdown['completed'] = [];
  const missed: ReportBreakdown['missed'] = [];
  for (const action of def.criticalActions) {
    const hit = evidence.find((e) => e.intent === action && e.result === 'applied');
    if (hit) completed.push({ action, turn: hit.turn, scoreDelta: hit.scoreDelta });
    else missed.push({ action });
  }
  const invalid = evidence
    .filter((e) => e.result === 'rejected')
    .map((e) => ({ turn: e.turn, intent: e.intent, rule: e.rule ?? '' }));
  const failureStates = getFailureStates(def);
  const recoveryIntents = new Set(def.recoveryIntents ?? []);
  const recovery = evidence
    .filter(
      (e) =>
        e.result === 'applied' &&
        e.scoreDelta > 0 &&
        (failureStates.has(e.from) || recoveryIntents.has(e.intent)),
    )
    .map((e) => ({ turn: e.turn, intent: e.intent, from: e.from, to: e.to, scoreDelta: e.scoreDelta }));
  const penalties = evidence
    .filter((e) => e.scoreDelta < 0)
    .map((e) => ({ turn: e.turn, intent: e.intent, rule: e.rule ?? '', scoreDelta: e.scoreDelta }));
  return { completed, missed, invalid, recovery, penalties };
}

export function buildSummary(
  breakdown: ReportBreakdown,
  completed: boolean,
  score: number,
  denominator: number,
  bonusPoints = 0,
): string {
  const headline = score - bonusPoints;
  const bonusSuffix = bonusPoints > 0 ? ` (+${bonusPoints} bonus)` : '';
  const total = breakdown.completed.length + breakdown.missed.length;
  if (completed && breakdown.missed.length === 0 && breakdown.penalties.length === 0 && breakdown.invalid.length === 0) {
    return `Perfect run: all ${total} critical actions completed, score ${headline}/${denominator}${bonusSuffix}.`;
  }
  const parts: string[] = [];
  parts.push(`${breakdown.completed.length} of ${total} critical actions completed`);
  if (breakdown.missed.length > 0) {
    parts.push(`${breakdown.missed.length} missed (${breakdown.missed.map((m) => m.action).join(', ')})`);
  }
  if (breakdown.penalties.length > 0) {
    const totalPenalty = breakdown.penalties.reduce((s, p) => s + p.scoreDelta, 0);
    parts.push(`${breakdown.penalties.length} penalized action${breakdown.penalties.length > 1 ? 's' : ''} (${totalPenalty})`);
  }
  if (breakdown.invalid.length > 0) {
    parts.push(`${breakdown.invalid.length} invalid action${breakdown.invalid.length > 1 ? 's' : ''}`);
  }
  if (breakdown.recovery.length > 0) {
    parts.push(`${breakdown.recovery.length} recovery action${breakdown.recovery.length > 1 ? 's' : ''}`);
  }
  if (!completed) parts.push('drill incomplete');
  return `${parts.join('; ')}. Score ${headline}/${denominator}${bonusSuffix}.`;
}

export function buildReport(state: ScenarioState, def: ScenarioDefinition): ReportData {
  const breakdown = buildBreakdown(state.evidence, def);
  const denominator = computeDenominator(def);
  const maxScore = computeMaxScore(def);
  const bonusPoints = Math.max(0, state.score - denominator);
  const headlineScore = state.score - bonusPoints;
  return {
    scenarioId: def.metadata.id,
    title: def.metadata.title,
    completed: state.completed,
    turns: state.turn,
    score: state.score,
    denominator,
    maxScore,
    headlineScore,
    bonusPoints,
    summary: buildSummary(breakdown, state.completed, state.score, denominator, bonusPoints),
    breakdown,
    evidence: [...state.evidence],
    recoveryPaths: def.recoveryPaths,
  };
}
