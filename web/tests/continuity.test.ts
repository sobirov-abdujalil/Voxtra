import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/report.js';
import type { ReportData } from '../src/report.js';

/** Continuity: Task 4's report information architecture stands; polish is additive only. */
function fixture(): ReportData {
  return {
    scenarioId: 'warehouse-chemical-spill',
    title: 'Warehouse Chemical Spill',
    completed: true,
    turns: 5,
    score: 58,
    denominator: 58,
    maxScore: 93,
    summary: 'Perfect run: all 5 critical actions completed, score 58/58.',
    breakdown: {
      completed: [
        { action: 'isolate_area', turn: 1, scoreDelta: 10 },
        { action: 'notify_supervisor', turn: 2, scoreDelta: 10 },
        { action: 'inspect_label', turn: 3, scoreDelta: 8 },
        { action: 'document_incident', turn: 4, scoreDelta: 10 },
        { action: 'clean_spill', turn: 5, scoreDelta: 20 },
      ],
      missed: [],
      invalid: [],
      recovery: [],
      penalties: [],
    },
    evidence: [
      { turn: 1, userTranscript: 'I will isolate the area', intent: 'isolate_area', from: 'unidentified_spill', to: 'area_isolated', rule: 'unidentified_spill::isolate_area', result: 'applied', scoreDelta: 10, timestamp: '2026-09-20T00:00:01.000Z' },
      { turn: 2, userTranscript: 'notify the supervisor', intent: 'notify_supervisor', from: 'area_isolated', to: 'coordinated', rule: 'area_isolated::notify_supervisor', result: 'applied', scoreDelta: 10, timestamp: '2026-09-20T00:00:02.000Z' },
      { turn: 3, userTranscript: 'read the label', intent: 'inspect_label', from: 'coordinated', to: 'ready_for_cleanup', rule: 'coordinated::inspect_label', result: 'applied', scoreDelta: 8, timestamp: '2026-09-20T00:00:03.000Z' },
      { turn: 4, userTranscript: 'Documenting the incident', intent: 'document_incident', from: 'ready_for_cleanup', to: 'documented', rule: 'ready_for_cleanup::document_incident', result: 'applied', scoreDelta: 10, timestamp: '2026-09-20T00:00:04.000Z' },
      { turn: 5, userTranscript: 'clean it up', intent: 'clean_spill', from: 'documented', to: 'resolved', rule: 'documented::clean_spill', result: 'applied', scoreDelta: 20, timestamp: '2026-09-20T00:00:05.000Z' },
    ],
  };
}

describe('report continuity', () => {
  it('still renders the score header, breakdown, timeline, and replay', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      renderReport(host, fixture());
      expect(host.querySelector('#report-score')?.textContent).toContain('58 / 58');
      expect(host.querySelector('#report-completion')?.textContent).toContain('complete');
      for (const group of ['completed', 'missed', 'invalid', 'recovery', 'penalties']) {
        expect(host.querySelector(`#breakdown-${group}`), `breakdown ${group}`).not.toBeNull();
      }
      expect(host.querySelectorAll('#report-timeline .timeline-row').length).toBe(5);
      const buttons = [...host.querySelectorAll<HTMLButtonElement>('#breakdown-completed .breakdown-entry')];
      expect(buttons.length).toBe(5);
      buttons[3]?.click();
      expect(host.querySelector('.timeline-row[data-turn="4"].highlighted')).not.toBeNull();
    } finally {
      host.remove();
    }
  });
});
