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

function equipmentSetup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('equipment-malfunction');
  if (!def) throw new Error('equipment scenario missing');
  return { def, initial: createInitialState(def) };
}

function warehouseSetup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('warehouse-chemical-spill');
  if (!def) throw new Error('warehouse scenario missing');
  return { def, initial: createInitialState(def) };
}

function forkliftSetup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('forklift-incident');
  if (!def) throw new Error('forklift scenario missing');
  return { def, initial: createInitialState(def) };
}

describe('loader: all three scenarios independently', () => {
  it('loads warehouse, forklift, and equipment by id with distinct intents', () => {
    const scenarios = loadScenarios();
    expect(scenarios.has('warehouse-chemical-spill')).toBe(true);
    expect(scenarios.has('forklift-incident')).toBe(true);
    expect(scenarios.has('equipment-malfunction')).toBe(true);
    const warehouse = scenarios.get('warehouse-chemical-spill');
    const forklift = scenarios.get('forklift-incident');
    const equipment = scenarios.get('equipment-malfunction');
    expect(equipment?.intents).toContain('hit_estop');
    expect(equipment?.intents).toContain('enter_cell');
    expect(equipment?.intents).not.toContain('isolate_area');
    expect(equipment?.intents).not.toContain('secure_scene');
    expect(warehouse?.intents).not.toContain('hit_estop');
    expect(forklift?.intents).not.toContain('hit_estop');
  });
});

describe('equipment engine: golden path', () => {
  it('estop -> isolate -> evacuate -> verify -> document completes 65/65', () => {
    const { def, initial } = equipmentSetup();
    let s = initial;
    const steps: Array<[string, number, string]> = [
      ['hit_estop', 15, 'estopped'],
      ['isolate_power', 15, 'isolated'],
      ['evacuate_area', 10, 'evacuated'],
      ['verify_technician', 10, 'verified'],
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
    expect(s.score).toBe(65);
    expect(s.evidence).toHaveLength(5);
    expect(isCompleted(s, def.completionCriteria)).toBe(true);
  });

  it('denominator is 65 and maxScore is 121 with optional bonuses', () => {
    const { def } = equipmentSetup();
    expect(computeDenominator(def)).toBe(65);
    expect(computeMaxScore(def)).toBe(121);
  });

  it('report renders from the evidence log with five completed and perfect summary', () => {
    const { def, initial } = equipmentSetup();
    let s = initial;
    for (const intent of ['hit_estop', 'isolate_power', 'evacuate_area', 'verify_technician', 'document_incident']) {
      s = applyAction(def, s, intent).state;
    }
    const report = buildReport(s, def);
    expect(report.scenarioId).toBe('equipment-malfunction');
    expect(report.score).toBe(65);
    expect(report.denominator).toBe(65);
    expect(report.headlineScore).toBe(65);
    expect(report.bonusPoints).toBe(0);
    expect(report.completed).toBe(true);
    expect(report.breakdown.completed).toHaveLength(5);
    expect(report.breakdown.missed).toHaveLength(0);
    expect(report.breakdown.invalid).toHaveLength(0);
    expect(report.summary).toContain('65/65');
  });
});

describe('equipment engine: invalid actions penalize without transition', () => {
  it.each([
    ['enter_cell', -15],
    ['reset_fault', -10],
    ['continue_work', -8],
    ['ignore_alarm', -6],
  ])('%s from initial penalizes %i with no state change', (intent, delta) => {
    const { def, initial } = equipmentSetup();
    const r = applyAction(def, initial, intent);
    expect(r.ok).toBe(true);
    expect(r.scoreDelta).toBe(delta);
    expect(r.state.current).toBe('initial');
    expect(r.state.score).toBe(delta);
    expect(r.state.turn).toBe(1);
    expect(r.state.evidence).toHaveLength(1);
    expect(r.state.evidence[0]).toMatchObject({ intent, from: 'initial', to: 'initial', scoreDelta: delta });
  });

  it('enter_cell mid-drill does not advance the state', () => {
    const { def, initial } = equipmentSetup();
    let s = applyAction(def, initial, 'hit_estop').state;
    expect(s.current).toBe('estopped');
    const r = applyAction(def, s, 'enter_cell');
    expect(r.state.current).toBe('estopped');
    expect(r.scoreDelta).toBe(-15);
  });

  it('unknown intent is rejected with INVALID_INTENT and no score change', () => {
    const { def, initial } = equipmentSetup();
    const r = applyAction(def, initial, 'teleport');
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('INVALID_INTENT');
    expect(r.state.current).toBe('initial');
    expect(r.state.score).toBe(0);
    expect(r.state.evidence).toHaveLength(1);
  });

  it('warehouse and forklift intents in an equipment session are rejected as unknown', () => {
    const { def, initial } = equipmentSetup();
    for (const intent of ['isolate_area', 'secure_scene']) {
      const r = applyAction(def, initial, intent);
      expect(r.ok).toBe(false);
      expect(r.error?.code).toBe('INVALID_INTENT');
    }
  });

  it('equipment intents are rejected in warehouse and forklift sessions', () => {
    const { def: warehouse, initial: w } = warehouseSetup();
    expect(applyAction(warehouse, w, 'hit_estop').error?.code).toBe('INVALID_INTENT');
    const { def: forklift, initial: f } = forkliftSetup();
    expect(applyAction(forklift, f, 'hit_estop').error?.code).toBe('INVALID_INTENT');
  });
});

describe('equipment engine: recovery', () => {
  it.each([['reassess'], ['correct_course']])('%s after a penalty is recorded as recovery', (intent) => {
    const { def, initial } = equipmentSetup();
    let s = applyAction(def, initial, 'enter_cell').state;
    s = applyAction(def, s, intent).state;
    const report = buildReport(s, def);
    expect(report.breakdown.penalties.length).toBeGreaterThan(0);
    expect(report.breakdown.penalties[0]).toMatchObject({ turn: 1, intent: 'enter_cell' });
    expect(report.breakdown.recovery.map((r) => r.turn)).toContain(2);
    expect(report.breakdown.recovery[0]?.intent).toBe(intent);
  });

  it('same input produces same output without mutating input', () => {
    const { def, initial } = equipmentSetup();
    const snapshot = JSON.parse(JSON.stringify(initial)) as typeof initial;
    const a = applyAction(def, initial, 'hit_estop');
    const b = applyAction(def, initial, 'hit_estop');
    expect(a).toEqual(b);
    expect(initial).toEqual(snapshot);
  });
});

describe('warehouse and forklift regression: unchanged after equipment addition', () => {
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

  it('forklift golden path still scores 57/57', () => {
    const { def, initial } = forkliftSetup();
    let s = initial;
    for (const intent of ['secure_scene', 'call_emergency', 'notify_supervisor', 'preserve_scene', 'document_incident']) {
      const r = applyAction(def, s, intent);
      expect(r.ok).toBe(true);
      s = r.state;
    }
    expect(s.score).toBe(57);
    expect(s.completed).toBe(true);
    expect(computeDenominator(def)).toBe(57);
    expect(computeMaxScore(def)).toBe(113);
  });
});
