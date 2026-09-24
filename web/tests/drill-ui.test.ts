import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatDelta,
  humanStateLabel,
  micHumanLabel,
  parseHashRoute,
  progressText,
  renderDrillTimeline,
  showDrillError,
  hideDrillError,
} from '../src/drill-ui.js';

describe('drill polish', () => {
  it('renders scenario state as a human label, never the raw id', () => {
    expect(humanStateLabel('unidentified_spill')).toBe('Unidentified spill');
    expect(humanStateLabel('ready_for_cleanup')).toBe('Ready for safe cleanup');
    expect(humanStateLabel('unidentified_spill')).not.toContain('_');
    // Unknown ids are humanized, never shown raw with underscores.
    expect(humanStateLabel('some_future_state')).toBe('Some Future State');
  });

  it('derives the progress indicator from session flags', () => {
    expect(progressText({}, ['isolated', 'notified', 'inspected', 'documented', 'cleaned'])).toBe(
      '0 of 5 required actions completed',
    );
    expect(
      progressText({ isolated: true, notified: true }, ['isolated', 'notified', 'inspected', 'documented', 'cleaned']),
    ).toBe('2 of 5 required actions completed');
    expect(
      progressText(
        { isolated: true, notified: true, inspected: true, documented: true, cleaned: true },
        ['isolated', 'notified', 'inspected', 'documented', 'cleaned'],
      ),
    ).toBe('5 of 5 required actions completed');
  });

  it('renders one timeline row per turn with intent, states, and signed delta', () => {
    const host = document.createElement('ol');
    renderDrillTimeline(
      host,
      [
        { turn: 1, intent: 'isolate_area', from: 'unidentified_spill', to: 'area_isolated', scoreDelta: 10 },
        { turn: 2, intent: 'clean_spill', from: 'unidentified_spill', to: 'exposed', scoreDelta: -15 },
      ],
    );
    const rows = host.querySelectorAll('.drill-timeline-row');
    expect(rows.length).toBe(2);
    expect(rows[0]?.querySelector('.intent-chip')?.textContent).toBe('isolate_area');
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('Unidentified spill');
    expect(rows[0]?.querySelector('.state-change')?.textContent).toContain('Area isolated');
    expect(rows[0]?.querySelector('.score-delta')?.textContent).toBe('+10');
    expect(rows[1]?.querySelector('.score-delta')?.textContent).toBe('-15');
    // Color is not the sole signal: the sign and an aria label carry the meaning.
    expect(rows[1]?.querySelector('.score-delta')?.getAttribute('aria-label')).toContain('penalty');
    expect(rows[0]?.classList.contains('positive')).toBe(true);
    expect(rows[1]?.classList.contains('negative')).toBe(true);
  });

  it('renders timeline content as text with no HTML injection', () => {
    const host = document.createElement('ol');
    renderDrillTimeline(host, [
      { turn: 1, intent: '<img src=x onerror=alert(1)>', from: 'unidentified_spill', to: 'area_isolated', scoreDelta: 10 },
    ]);
    expect(host.innerHTML).not.toContain('<img');
    expect(host.textContent).toContain('<img src=x onerror=alert(1)>');
  });

  it('shows an empty timeline message before the first turn', () => {
    const host = document.createElement('ol');
    renderDrillTimeline(host, []);
    expect(host.querySelector('.drill-timeline-empty')).not.toBeNull();
  });

  it('maps mic machine states to human labels without renaming the machine value', () => {
    expect(micHumanLabel('requesting')).toContain('permission');
    expect(micHumanLabel('live')).toBe('Listening');
    expect(micHumanLabel('denied')).toContain('blocked');
    expect(formatDelta(10)).toBe('+10');
    expect(formatDelta(-15)).toBe('-15');
  });

  it('parses the routing convention: #/ selection, #/drill drill, #/report/:id report', () => {
    expect(parseHashRoute('#/')).toEqual({ name: 'selection' });
    expect(parseHashRoute('')).toEqual({ name: 'selection' });
    expect(parseHashRoute('#/drill')).toEqual({ name: 'drill' });
    expect(parseHashRoute('#/report/sess_abc')).toEqual({ name: 'report', id: 'sess_abc' });
  });

  it('surfaces drill errors with a visible message and a recovery action', () => {
    const box = document.createElement('div');
    box.hidden = true;
    const message = document.createElement('p');
    box.appendChild(message);
    const recovery = document.createElement('button');
    recovery.textContent = 'Use text intents instead';
    box.appendChild(recovery);
    showDrillError(box, message, 'Microphone denied. Use the text intent buttons instead.');
    expect(box.hidden).toBe(false);
    expect(message.textContent).toContain('Microphone denied');
    expect(recovery.disabled).toBe(false);
    hideDrillError(box);
    expect(box.hidden).toBe(true);
  });

  it('keeps the drill error surface and transcript contracts in index.html', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const error = doc.querySelector('#drill-error');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(doc.querySelector('#drill-error-dismiss')).not.toBeNull();
    expect(doc.querySelector('#barge-cue')?.textContent).toContain('speak anytime');
    expect(doc.querySelector('#transcript-partial')?.getAttribute('aria-live')).toBe('polite');
    expect(doc.querySelector('#scenario-label')).not.toBeNull();
    expect(doc.querySelector('#progress-indicator')).not.toBeNull();
    expect(doc.querySelector('#drill-timeline-list')).not.toBeNull();
    // Existing E2E/test DOM contracts are preserved.
    for (const id of ['status', 'start-session', 'start-voice', 'stop-voice', 'mic-state', 'transcript-final', 'state', 'intents', 'consequence', 'open-report', 'report-view', 'drill-view']) {
      expect(doc.querySelector(`#${id}`), `#${id} preserved`).not.toBeNull();
    }
  });
});
