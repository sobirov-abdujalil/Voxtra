import { describe, expect, it } from 'vitest';
import { humanStateLabel, progressText, renderDrillTimeline } from '../src/drill-ui.js';
import { renderReport } from '../src/report.js';
import type { ReportData } from '../src/report.js';

const FORKLIFT_LABELS: Record<string, string> = {
  initial: 'Incident uncontrolled',
  scene_secured: 'Scene secured',
  help_summoned: 'Help summoned',
  supervisor_notified: 'Supervisor notified',
  scene_preserved: 'Scene preserved',
  resolved: 'Incident resolved',
};

function forkliftReport(): ReportData {
  return {
    scenarioId: 'forklift-incident',
    title: 'Forklift Incident',
    completed: true,
    turns: 5,
    score: 57,
    denominator: 57,
    maxScore: 113,
    summary: 'Perfect run: all 5 critical actions completed, score 57/57.',
    breakdown: {
      completed: [
        { action: 'secure_scene', turn: 1, scoreDelta: 12 },
        { action: 'call_emergency', turn: 2, scoreDelta: 11 },
        { action: 'notify_supervisor', turn: 3, scoreDelta: 9 },
        { action: 'preserve_scene', turn: 4, scoreDelta: 10 },
        { action: 'document_incident', turn: 5, scoreDelta: 15 },
      ],
      missed: [],
      invalid: [],
      recovery: [],
      penalties: [],
    },
    evidence: [
      { turn: 1, userTranscript: 'stopping the forklift and locking it out', intent: 'secure_scene', from: 'initial', to: 'scene_secured', rule: 'initial::secure_scene', result: 'applied', scoreDelta: 12, timestamp: '2026-09-22T00:00:01.000Z' },
      { turn: 2, userTranscript: 'calling 911 right now', intent: 'call_emergency', from: 'scene_secured', to: 'help_summoned', rule: 'scene_secured::call_emergency', result: 'applied', scoreDelta: 11, timestamp: '2026-09-22T00:00:02.000Z' },
      { turn: 3, userTranscript: 'notifying the shift manager', intent: 'notify_supervisor', from: 'help_summoned', to: 'supervisor_notified', rule: 'help_summoned::notify_supervisor', result: 'applied', scoreDelta: 9, timestamp: '2026-09-22T00:00:03.000Z' },
      { turn: 4, userTranscript: 'photographing the scene', intent: 'preserve_scene', from: 'supervisor_notified', to: 'scene_preserved', rule: 'supervisor_notified::preserve_scene', result: 'applied', scoreDelta: 10, timestamp: '2026-09-22T00:00:04.000Z' },
      { turn: 5, userTranscript: 'filing the incident report now', intent: 'document_incident', from: 'scene_preserved', to: 'resolved', rule: 'scene_preserved::document_incident', result: 'applied', scoreDelta: 15, timestamp: '2026-09-22T00:00:05.000Z' },
    ],
  };
}

describe('forklift drill rendering', () => {
  it('renders forklift state labels from scenario data, never raw ids', () => {
    expect(humanStateLabel('initial', FORKLIFT_LABELS)).toBe('Incident uncontrolled');
    expect(humanStateLabel('scene_secured', FORKLIFT_LABELS)).toBe('Scene secured');
    expect(humanStateLabel('resolved', FORKLIFT_LABELS)).toBe('Incident resolved');
    expect(humanStateLabel('scene_secured', FORKLIFT_LABELS)).not.toContain('_');
  });

  it('derives progress from forklift required flags', () => {
    const required = ['secured', 'helped', 'notified', 'preserved', 'documented'];
    expect(progressText({}, required)).toBe('0 of 5 required actions completed');
    expect(progressText({ secured: true, helped: true }, required)).toBe('2 of 5 required actions completed');
    expect(
      progressText({ secured: true, helped: true, notified: true, preserved: true, documented: true }, required),
    ).toBe('5 of 5 required actions completed');
  });

  it('renders one timeline row per forklift turn with signed deltas', () => {
    const host = document.createElement('ol');
    renderDrillTimeline(
      host,
      [
        { turn: 1, intent: 'secure_scene', from: 'initial', to: 'scene_secured', scoreDelta: 12 },
        { turn: 2, intent: 'move_victim', from: 'initial', to: 'initial', scoreDelta: -12 },
      ],
      FORKLIFT_LABELS,
    );
    const rows = host.querySelectorAll('.drill-timeline-row');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('Incident uncontrolled');
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('Scene secured');
    expect(rows[0]?.querySelector('.score-delta')?.textContent).toBe('+12');
    expect(rows[1]?.querySelector('.score-delta')?.textContent).toBe('-12');
    expect(rows[1]?.classList.contains('negative')).toBe(true);
  });
});

describe('forklift report rendering', () => {
  it('renders 57/57 with five completed and five timeline rows', () => {
    const host = document.createElement('div');
    renderReport(host, forkliftReport());
    expect(host.querySelector('#report-score')?.textContent).toContain('57 / 57');
    expect(host.querySelectorAll('#breakdown-completed .breakdown-entry').length).toBe(5);
    expect(host.querySelectorAll('#report-timeline .timeline-row').length).toBe(5);
  });

  it('renders penalty rows distinctly', () => {
    const host = document.createElement('div');
    const data = forkliftReport();
    data.evidence.push({
      turn: 6,
      userTranscript: 'move him',
      intent: 'move_victim',
      from: 'initial',
      to: 'initial',
      rule: 'initial::move_victim',
      result: 'applied',
      scoreDelta: -12,
      timestamp: '2026-09-22T00:00:06.000Z',
    });
    renderReport(host, data);
    expect(host.querySelector('.timeline-row[data-turn="6"]')?.classList.contains('negative')).toBe(true);
  });
});
