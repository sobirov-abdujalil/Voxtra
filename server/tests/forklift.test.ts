import { describe, expect, it } from 'vitest';
import {
  applyAction,
  buildReport,
  computeDenominator,
  computeMaxScore,
  createInitialState,
  isCompleted,
} from '../src/scenario/engine.js';
import { loadScenarios } from '../src/scenario/loader.js';

function forkliftSetup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('forklift-incident');
  if (!def) throw new Error('forklift scenario missing');
  return { def, initial: createInitialState(def) };
}

function warehouseSetup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('warehouse-chemical-spill');
  if (!def) throw new Error('warehouse scenario missing');
  return { def, initial: createInitialState(def) };
}

describe('loader: both scenarios independently', () => {
  it('loads warehouse and forklift by id with distinct intents', () => {
    const scenarios = loadScenarios();
    expect(scenarios.has('warehouse-chemical-spill')).toBe(true);
    expect(scenarios.has('forklift-incident')).toBe(true);
    const warehouse = scenarios.get('warehouse-chemical-spill');
    const forklift = scenarios.get('forklift-incident');
    expect(warehouse?.intents).toContain('isolate_area');
    expect(forklift?.intents).toContain('secure_scene');
    expect(forklift?.intents).not.toContain('isolate_area');
    expect(warehouse?.intents).not.toContain('secure_scene');
  });
});

describe('forklift engine: golden path', () => {
  it('secure -> call -> notify -> preserve -> document completes 57/57', () => {
    const { def, initial } = forkliftSetup();
    let s = initial;
    const steps: Array<[string, number, string]> = [
      ['secure_scene', 12, 'scene_secured'],
      ['call_emergency', 11, 'help_summoned'],
      ['notify_supervisor', 9, 'supervisor_notified'],
      ['preserve_scene', 10, 'scene_preserved'],
      ['document_incident', 15, 'resolved'],
    ];
    for (const [intent, delta, to] of steps) {
      const r = applyAction(def, s, intent);
      expect(r.ok).toBe(true);
      expect(r.scoreDelta).toBe(delta);
      expect(r.state.current).toBe(to);
      s = r.state;
    }
    expect(s.completed).toBe(true);
    expect(s.score).toBe(57);
    expect(s.evidence).toHaveLength(5);
    expect(isCompleted(s, def.completionCriteria)).toBe(true);
  });

  it('denominator is 57 and maxScore exceeds it with optional bonuses', () => {
    const { def } = forkliftSetup();
    expect(computeDenominator(def)).toBe(57);
    const max = computeMaxScore(def);
    expect(max).toBeGreaterThan(57);
    expect(max).toBe(113);
  });

  it('report renders from the evidence log with five completed and perfect summary', () => {
    const { def, initial } = forkliftSetup();
    let s = initial;
    for (const intent of ['secure_scene', 'call_emergency', 'notify_supervisor', 'preserve_scene', 'document_incident']) {
      s = applyAction(def, s, intent).state;
    }
    const report = buildReport(s, def);
    expect(report.scenarioId).toBe('forklift-incident');
    expect(report.score).toBe(57);
    expect(report.denominator).toBe(57);
    expect(report.completed).toBe(true);
    expect(report.breakdown.completed).toHaveLength(5);
    expect(report.breakdown.missed).toHaveLength(0);
    expect(report.breakdown.invalid).toHaveLength(0);
    expect(report.summary).toContain('57/57');
  });
});

describe('forklift engine: invalid actions penalize without transition', () => {
  it.each([
    ['move_victim', -12],
    ['restart_forklift', -10],
    ['clear_aisle', -8],
    ['handle_alone', -6],
  ])('%s from initial penalizes %i with no state change', (intent, delta) => {
    const { def, initial } = forkliftSetup();
    const r = applyAction(def, initial, intent);
    expect(r.ok).toBe(true);
    expect(r.scoreDelta).toBe(delta);
    expect(r.state.current).toBe('initial');
    expect(r.state.score).toBe(delta);
    expect(r.state.turn).toBe(1);
    expect(r.state.evidence).toHaveLength(1);
    expect(r.state.evidence[0]).toMatchObject({ intent, from: 'initial', to: 'initial', scoreDelta: delta });
  });

  it('move_victim mid-drill does not advance the state', () => {
    const { def, initial } = forkliftSetup();
    let s = applyAction(def, initial, 'secure_scene').state;
    expect(s.current).toBe('scene_secured');
    const r = applyAction(def, s, 'move_victim');
    expect(r.state.current).toBe('scene_secured');
    expect(r.scoreDelta).toBe(-12);
  });

  it('unknown intent is rejected with INVALID_INTENT and no score change', () => {
    const { def, initial } = forkliftSetup();
    const r = applyAction(def, initial, 'teleport');
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('INVALID_INTENT');
    expect(r.state.current).toBe('initial');
    expect(r.state.score).toBe(0);
    expect(r.state.evidence).toHaveLength(1);
  });

  it('warehouse intent in forklift session is rejected as unknown', () => {
    const { def, initial } = forkliftSetup();
    const r = applyAction(def, initial, 'isolate_area');
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('INVALID_INTENT');
  });
});

describe('forklift engine: recovery', () => {
  it.each([['reassess'], ['correct_course']])('%s after a penalty is recorded as recovery', (intent) => {
    const { def, initial } = forkliftSetup();
    let s = applyAction(def, initial, 'move_victim').state;
    s = applyAction(def, s, intent).state;
    const report = buildReport(s, def);
    expect(report.breakdown.penalties.length).toBeGreaterThan(0);
    expect(report.breakdown.penalties[0]).toMatchObject({ turn: 1, intent: 'move_victim' });
    expect(report.breakdown.recovery.map((r) => r.turn)).toContain(2);
    expect(report.breakdown.recovery[0]?.intent).toBe(intent);
  });

  it('same input produces same output without mutating input', () => {
    const { def, initial } = forkliftSetup();
    const snapshot = JSON.parse(JSON.stringify(initial)) as typeof initial;
    const a = applyAction(def, initial, 'secure_scene');
    const b = applyAction(def, initial, 'secure_scene');
    expect(a).toEqual(b);
    expect(initial).toEqual(snapshot);
  });
});

describe('warehouse regression: unchanged after forklift addition', () => {
  it('warehouse golden path still scores 58/58', () => {
    const { def, initial } = warehouseSetup();
    let s = initial;
    for (const intent of ['isolate_area', 'notify_supervisor', 'inspect_label', 'document_incident', 'clean_spill']) {
      const r = applyAction(def, s, intent);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(s.score).toBe(58);
    expect(s.completed).toBe(true);
    expect(computeDenominator(def)).toBe(58);
  });
});
