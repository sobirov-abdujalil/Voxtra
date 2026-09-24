import { describe, expect, it } from 'vitest';
import { renderReport } from '../src/report.js';
import type { ReportData } from '../src/report.js';

/**
 * Regression cover for the Forklift 59/57 display defect (H4): the headline
 * score must never show a numerator above its denominator. Option A:
 * headline shows required/denominator with bonuses on a separate labeled line.
 */

function baseReport(): ReportData {
  return {
    scenarioId: 'forklift-incident',
    title: 'Forklift Incident',
    completed: true,
    turns: 6,
    score: 59,
    denominator: 57,
    maxScore: 113,
    headlineScore: 57,
    bonusPoints: 2,
    summary: 'Perfect run: all 5 critical actions completed, score 57/57 (+2 bonus).',
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
    evidence: [],
  };
}

function headlineNumerator(host: HTMLElement): number {
  const text = host.querySelector('#report-score')?.textContent ?? '';
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (!match) throw new Error(`no score fraction in headline (${text})`);
  return Number(match[1]);
}

function headlineDenominator(host: HTMLElement): number {
  const text = host.querySelector('#report-score')?.textContent ?? '';
  const match = /(\d+)\s*\/\s*(\d+)/.exec(text);
  if (!match) throw new Error(`no score fraction in headline (${text})`);
  return Number(match[2]);
}

describe('report headline invariant', () => {
  it('caps a 59/57 bonus run at 57 / 57 with a separate bonus line', () => {
    const host = document.createElement('div');
    renderReport(host, baseReport());
    expect(host.querySelector('#report-score')?.textContent).toContain('57 / 57');
    expect(host.querySelector('#report-score')?.textContent).not.toContain('59 / 57');
    const bonus = host.querySelector('#report-bonus');
    expect(bonus?.textContent).toMatch(/\+2 bonus/);
    expect(headlineNumerator(host)).toBeLessThanOrEqual(headlineDenominator(host));
  });

  it('shows no bonus line for a clean golden path on either scenario', () => {
    const host = document.createElement('div');
    const clean: ReportData = {
      ...baseReport(),
      turns: 5,
      score: 57,
      headlineScore: 57,
      bonusPoints: 0,
      summary: 'Perfect run: all 5 critical actions completed, score 57/57.',
    };
    renderReport(host, clean);
    expect(host.querySelector('#report-score')?.textContent).toContain('57 / 57');
    expect(host.querySelector('#report-bonus')).toBeNull();
  });

  it('derives the cap defensively when the server omits the new fields', () => {
    const host = document.createElement('div');
    const legacy = baseReport();
    delete legacy.headlineScore;
    delete legacy.bonusPoints;
    renderReport(host, legacy);
    expect(host.querySelector('#report-score')?.textContent).toContain('57 / 57');
    expect(host.querySelector('#report-bonus')?.textContent).toMatch(/\+2 bonus/);
    expect(headlineNumerator(host)).toBeLessThanOrEqual(headlineDenominator(host));
  });

  it('never inflates a penalized run below the denominator', () => {
    const host = document.createElement('div');
    renderReport(
      host,
      { ...baseReport(), score: 45, headlineScore: 45, bonusPoints: 0, summary: 'Score 45/57.' },
    );
    expect(host.querySelector('#report-score')?.textContent).toContain('45 / 57');
    expect(host.querySelector('#report-bonus')).toBeNull();
  });
});
