import { describe, expect, it } from 'vitest';
import { applyAction, buildReport, createInitialState, isCompleted } from '../src/scenario/engine.js';
import { loadScenarios } from '../src/scenario/loader.js';

function setup() {
  const scenarios = loadScenarios();
  const def = scenarios.get('warehouse-chemical-spill');
  if (!def) throw new Error('scenario missing');
  return { def, initial: createInitialState(def) };
}

describe('scenario engine: valid golden path', () => {
  it('isolate -> notify -> inspect -> clean completes with deterministic score', () => {
    const { def, initial } = setup();
    let s = initial;
    const steps: Array<[string, number, string]> = [
      ['isolate_area', 10, 'area_isolated'],
      ['notify_supervisor', 10, 'coordinated'],
      ['inspect_label', 8, 'ready_for_cleanup'],
      ['clean_spill', 20, 'resolved'],
    ];
    for (const [intent, delta, to] of steps) {
      const r = applyAction(def, s, intent);
      expect(r.ok).toBe(true);
      expect(r.scoreDelta).toBe(delta);
      expect(r.state.current).toBe(to);
      s = r.state;
    }
    expect(s.completed).toBe(true);
    expect(s.score).toBe(48);
    expect(s.evidence).toHaveLength(4);
    expect(isCompleted(s, def.completionCriteria)).toBe(true);
  });
});

describe('scenario engine: invalid and critical actions', () => {
  it('clean_spill first causes exposure with penalty', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, 'clean_spill');
    expect(r.ok).toBe(true);
    expect(r.state.current).toBe('exposed');
    expect(r.scoreDelta).toBe(-15);
    expect(r.completed).toBe(false);
  });

  it('approach_spill first causes exposure', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, 'approach_spill');
    expect(r.state.current).toBe('exposed');
    expect(r.scoreDelta).toBe(-10);
  });

  it('leave_area abandons the scene', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, 'leave_area');
    expect(r.state.current).toBe('abandoned');
    expect(r.scoreDelta).toBe(-10);
  });

  it('unknown intent is rejected without mutating state position', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, 'dance_around');
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('INVALID_INTENT');
    expect(r.state.current).toBe(initial.current);
    expect(r.state.score).toBe(initial.score);
    expect(r.state.evidence).toHaveLength(1);
  });

  it('intent with no transition from terminal-ish state is rejected safely', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, '');
    expect(r.ok).toBe(false);
  });
});

describe('scenario engine: determinism and purity', () => {
  it('same input produces same output and does not mutate the input', () => {
    const { def, initial } = setup();
    const snapshot = JSON.parse(JSON.stringify(initial)) as typeof initial;
    const a = applyAction(def, initial, 'isolate_area');
    const b = applyAction(def, initial, 'isolate_area');
    expect(a).toEqual(b);
    expect(initial).toEqual(snapshot);
  });
});

describe('scenario engine: scoring and evidence', () => {
  it('evidence entries chain from/to with running score', () => {
    const { def, initial } = setup();
    const r1 = applyAction(def, initial, 'isolate_area');
    const r2 = applyAction(def, r1.state, 'notify_supervisor');
    expect(r2.state.evidence[0]).toMatchObject({ turn: 1, intent: 'isolate_area', from: 'unidentified_spill', to: 'area_isolated', scoreDelta: 10 });
    expect(r2.state.evidence[1]).toMatchObject({ turn: 2, intent: 'notify_supervisor', from: 'area_isolated', to: 'coordinated', scoreDelta: 10 });
    expect(r2.state.score).toBe(20);
  });

  it('report renders from the evidence log', () => {
    const { def, initial } = setup();
    const r = applyAction(def, initial, 'isolate_area');
    const report = buildReport(r.state, def);
    expect(report.score).toBe(r.state.score);
    expect(report.evidence).toEqual(r.state.evidence);
    expect(report.completed).toBe(false);
  });
});

describe('scenario engine: recovery paths', () => {
  it('exposed can recover via isolate_area', () => {
    const { def, initial } = setup();
    const bad = applyAction(def, initial, 'clean_spill');
    expect(bad.state.current).toBe('exposed');
    const rec = applyAction(def, bad.state, 'isolate_area');
    expect(rec.ok).toBe(true);
    expect(rec.state.current).toBe('area_isolated');
    expect(rec.scoreDelta).toBe(5);
  });

  it('abandoned can recover via notify_supervisor', () => {
    const { def, initial } = setup();
    const bad = applyAction(def, initial, 'leave_area');
    const rec = applyAction(def, bad.state, 'notify_supervisor');
    expect(rec.ok).toBe(true);
    expect(rec.state.current).toBe('unidentified_spill');
  });

  it('every failure state has a documented recovery path', () => {
    const { def } = setup();
    expect(def.recoveryPaths['exposed'].length).toBeGreaterThan(0);
    expect(def.recoveryPaths['abandoned'].length).toBeGreaterThan(0);
  });
});

describe('scenario engine: completion criteria', () => {
  it('is not complete before the golden path finishes', () => {
    const { def, initial } = setup();
    expect(isCompleted(initial, def.completionCriteria)).toBe(false);
    const r = applyAction(def, initial, 'isolate_area');
    expect(isCompleted(r.state, def.completionCriteria)).toBe(false);
  });
});
