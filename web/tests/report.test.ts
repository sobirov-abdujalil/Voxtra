import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/report.js';
import type { ReportData } from '../src/report.js';

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

describe('report view', () => {
  it('renders the score with an explicit denominator', () => {
    const host = document.createElement('div');
    renderReport(host, fixture());
    const score = host.querySelector('#report-score');
    expect(score?.textContent).toContain('58 / 58');
  });

  it('links each breakdown entry to the correct turn', () => {
    const host = document.createElement('div');
    renderReport(host, fixture());
    const completed = host.querySelector('#breakdown-completed');
    const buttons = [...(completed?.querySelectorAll('button.breakdown-entry') ?? [])];
    expect(buttons).toHaveLength(5);
    expect(buttons[3]?.getAttribute('data-turns')).toBe('4');
  });

  it('clicking a breakdown entry highlights the correct timeline row', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      renderReport(host, fixture());
      const completed = host.querySelector('#breakdown-completed');
      const buttons = [...(completed?.querySelectorAll('button.breakdown-entry') ?? [])] as HTMLButtonElement[];
      buttons[3]?.click();
      const highlighted = host.querySelector('.timeline-row[data-turn="4"].highlighted');
      expect(highlighted).not.toBeNull();
      const others = host.querySelectorAll('.timeline-row.highlighted');
      expect(others.length).toBe(1);
    } finally {
      host.remove();
    }
  });

  it('renders transcripts as text with no HTML injection', () => {
    const host = document.createElement('div');
    const data = fixture();
    data.evidence[0] = { ...data.evidence[0], userTranscript: '<img src=x onerror=alert(1)>isolate' };
    renderReport(host, data);
    const row = host.querySelector('.timeline-row[data-turn="1"]');
    expect(row?.innerHTML).not.toContain('<img');
    expect(row?.textContent).toContain('<img src=x onerror=alert(1)>isolate');
  });

  it('expands a timeline row on click to show the full record', () => {
    const host = document.createElement('div');
    renderReport(host, fixture());
    const row = host.querySelector<HTMLElement>('.timeline-row[data-turn="2"]');
    const detail = row?.querySelector<HTMLElement>('.timeline-detail');
    expect(detail?.hidden).toBe(true);
    row?.click();
    expect(detail?.hidden).toBe(false);
  });

  it('marks negative deltas distinctly from positive ones', () => {
    const host = document.createElement('div');
    const data = fixture();
    data.evidence.push({
      turn: 6,
      userTranscript: 'clean early',
      intent: 'clean_spill',
      from: 'unidentified_spill',
      to: 'exposed',
      rule: 'unidentified_spill::clean_spill',
      result: 'applied',
      scoreDelta: -15,
      timestamp: '2026-09-20T00:00:06.000Z',
    });
    renderReport(host, data);
    expect(host.querySelector('.timeline-row[data-turn="6"]')?.classList.contains('negative')).toBe(true);
    expect(host.querySelector('.timeline-row[data-turn="1"]')?.classList.contains('negative')).toBe(false);
  });
});
