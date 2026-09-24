import { describe, expect, it } from 'vitest';
import { humanStateLabel, progressText, renderDrillTimeline } from '../src/drill-ui.js';
import { renderReport } from '../src/report.js';
import type { ReportData } from '../src/report.js';

const EQUIPMENT_LABELS: Record<string, string> = {
  initial: 'Cell re-energized',
  estopped: 'E-stop pressed',
  isolated: 'Cell isolated',
  evacuated: 'Area evacuated',
  verified: 'Technician verified',
  resolved: 'Incident resolved',
};

function equipmentReport(): ReportData {
  return {
    scenarioId: 'equipment-malfunction',
    title: 'Equipment Malfunction',
    completed: true,
    turns: 5,
    score: 65,
    denominator: 65,
    maxScore: 121,
    summary: 'Perfect run: all 5 critical actions completed, score 65/65.',
    breakdown: {
      completed: [
        { action: 'hit_estop', turn: 1, scoreDelta: 15 },
        { action: 'isolate_power', turn: 2, scoreDelta: 15 },
        { action: 'evacuate_area', turn: 3, scoreDelta: 10 },
        { action: 'verify_technician', turn: 4, scoreDelta: 10 },
        { action: 'document_incident', turn: 5, scoreDelta: 15 },
      ],
      missed: [],
      invalid: [],
      recovery: [],
      penalties: [],
    },
    evidence: [
      { turn: 1, userTranscript: 'hitting the emergency stop now', intent: 'hit_estop', from: 'initial', to: 'estopped', rule: 'initial::hit_estop', result: 'applied', scoreDelta: 15, timestamp: '2026-09-23T00:00:01.000Z' },
      { turn: 2, userTranscript: 'locking out the power at the disconnect', intent: 'isolate_power', from: 'estopped', to: 'isolated', rule: 'estopped::isolate_power', result: 'applied', scoreDelta: 15, timestamp: '2026-09-23T00:00:02.000Z' },
      { turn: 3, userTranscript: 'everyone out of the cell and the aisle', intent: 'evacuate_area', from: 'isolated', to: 'evacuated', rule: 'isolated::evacuate_area', result: 'applied', scoreDelta: 10, timestamp: '2026-09-23T00:00:03.000Z' },
      { turn: 4, userTranscript: 'checking on the technician', intent: 'verify_technician', from: 'evacuated', to: 'verified', rule: 'evacuated::verify_technician', result: 'applied', scoreDelta: 10, timestamp: '2026-09-23T00:00:04.000Z' },
      { turn: 5, userTranscript: 'filing the incident report now', intent: 'document_incident', from: 'verified', to: 'resolved', rule: 'verified::document_incident', result: 'applied', scoreDelta: 15, timestamp: '2026-09-23T00:00:05.000Z' },
    ],
  };
}

describe('equipment drill rendering', () => {
  it('renders equipment state labels from scenario data, never raw ids', () => {
    expect(humanStateLabel('initial', EQUIPMENT_LABELS)).toBe('Cell re-energized');
    expect(humanStateLabel('estopped', EQUIPMENT_LABELS)).toBe('E-stop pressed');
    expect(humanStateLabel('resolved', EQUIPMENT_LABELS)).toBe('Incident resolved');
    expect(humanStateLabel('estopped', EQUIPMENT_LABELS)).not.toContain('_');
  });

  it('derives progress from equipment required flags', () => {
    const required = ['estopped', 'isolated', 'evacuated', 'verified', 'documented'];
    expect(progressText({}, required)).toBe('0 of 5 required actions completed');
    expect(progressText({ estopped: true, isolated: true }, required)).toBe('2 of 5 required actions completed');
    expect(
      progressText({ estopped: true, isolated: true, evacuated: true, verified: true, documented: true }, required),
    ).toBe('5 of 5 required actions completed');
  });

  it('renders one timeline row per equipment turn with signed deltas', () => {
    const host = document.createElement('ol');
    renderDrillTimeline(
      host,
      [
        { turn: 1, intent: 'hit_estop', from: 'initial', to: 'estopped', scoreDelta: 15 },
        { turn: 2, intent: 'enter_cell', from: 'initial', to: 'initial', scoreDelta: -15 },
      ],
      EQUIPMENT_LABELS,
    );
    const rows = host.querySelectorAll('.drill-timeline-row');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('Cell re-energized');
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('E-stop pressed');
    expect(rows[0]?.querySelector('.score-delta')?.textContent).toBe('+15');
    expect(rows[1]?.querySelector('.score-delta')?.textContent).toBe('-15');
    expect(rows[1]?.classList.contains('negative')).toBe(true);
  });
});

describe('equipment report rendering', () => {
  it('renders 65/65 with five completed and five timeline rows', () => {
    const host = document.createElement('div');
    renderReport(host, equipmentReport());
    expect(host.querySelector('#report-score')?.textContent).toContain('65 / 65');
    expect(host.querySelectorAll('#breakdown-completed .breakdown-entry').length).toBe(5);
    expect(host.querySelectorAll('#report-timeline .timeline-row').length).toBe(5);
  });

  it('renders penalty rows distinctly', () => {
    const host = document.createElement('div');
    const data = equipmentReport();
    data.evidence.push({
      turn: 6,
      userTranscript: 'going in',
      intent: 'enter_cell',
      from: 'initial',
      to: 'initial',
      rule: 'initial::enter_cell',
      result: 'applied',
      scoreDelta: -15,
      timestamp: '2026-09-23T00:00:06.000Z',
    });
    renderReport(host, data);
    expect(host.querySelector('.timeline-row[data-turn="6"]')?.classList.contains('negative')).toBe(true);
  });
});
