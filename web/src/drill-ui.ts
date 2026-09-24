/**
 * Drill-view UI helpers (UI only — no engine, no scoring, no secrets).
 *
 * Pure functions + tiny DOM builders. All user-controlled content is set via
 * textContent, never innerHTML. The machine-readable mic/state values used by
 * tests and the voice session are never renamed here — human labels are
 * rendered alongside them.
 */

export interface EvidenceLike {
  turn: number;
  intent: string;
  from: string;
  to: string;
  scoreDelta: number;
}

export type Route = { name: 'selection' } | { name: 'drill' } | { name: 'report'; id: string };

export const FALLBACK_STATE_LABELS: Record<string, string> = {
  unidentified_spill: 'Unidentified spill',
  area_isolated: 'Area isolated',
  coordinated: 'Isolated and supervisor notified',
  ready_for_cleanup: 'Ready for safe cleanup',
  documented: 'Incident documented',
  resolved: 'Spill safely resolved',
  exposed: 'Exposed to chemical (recoverable)',
  abandoned: 'Scene left unattended (recoverable)',
};

export const FALLBACK_REQUIRED_FLAGS: string[] = [
  'isolated',
  'notified',
  'inspected',
  'documented',
  'cleaned',
];

/** Map an internal state id to its human label. Never returns the raw id bare. */
export function humanStateLabel(stateId: string, labels?: Record<string, string>): string {
  const map = labels ?? FALLBACK_STATE_LABELS;
  const known = map[stateId];
  if (known) return known;
  // Fallback: humanize snake_case so an unknown id never renders raw.
  return stateId
    .split('_')
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/** e.g. "2 of 5 required actions completed" from existing session flags. */
export function progressText(
  flags: Record<string, boolean> | undefined,
  required: readonly string[] = FALLBACK_REQUIRED_FLAGS,
): string {
  const done = required.filter((f) => flags?.[f] === true).length;
  return `${done} of ${required.length} required actions completed`;
}

/** Signed delta so color is never the sole signal: "+10", "-15", "+0". */
export function formatDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

/** Human mic label. The machine value stays in #mic-state for tests/session. */
export function micHumanLabel(state: string): string {
  switch (state) {
    case 'idle':
      return 'Idle';
    case 'requesting':
      return 'Requesting permission…';
    case 'live':
      return 'Listening';
    case 'denied':
      return 'Microphone blocked';
    case 'stopped':
      return 'Voice stopped';
    case 'error':
      return 'Voice error';
    default:
      return state.length > 0 ? state : 'Idle';
  }
}

/** Hash routing convention: #/ selection, #/drill drill, #/report/:id report. */
export function parseHashRoute(hash: string): Route {
  const report = /^#\/report\/([A-Za-z0-9_-]+)$/.exec(hash);
  if (report) return { name: 'report', id: String(report[1]) };
  if (hash === '#/drill' || hash === '#drill') return { name: 'drill' };
  return { name: 'selection' };
}

function textEl(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

/**
 * Render the drill-time timeline (compact counterpart of the report timeline).
 * Rows carry turn number, intent chip, from→to, and a signed score delta.
 */
export function renderDrillTimeline(
  container: HTMLElement,
  evidence: readonly EvidenceLike[],
  labels?: Record<string, string>,
): void {
  container.innerHTML = '';
  if (evidence.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'drill-timeline-empty';
    empty.textContent = 'No turns yet — your decisions will appear here.';
    container.appendChild(empty);
    return;
  }
  const ordered = [...evidence].sort((a, b) => a.turn - b.turn);
  for (const item of ordered) {
    const row = document.createElement('li');
    row.className = 'drill-timeline-row';
    if (item.scoreDelta < 0) row.classList.add('negative');
    else if (item.scoreDelta > 0) row.classList.add('positive');
    else row.classList.add('neutral');
    row.dataset.turn = String(item.turn);
    row.appendChild(textEl('span', `Turn ${item.turn}`, 'turn-num'));
    row.appendChild(textEl('span', item.intent, 'intent-chip'));
    row.appendChild(
      textEl('span', `${humanStateLabel(item.from, labels)} → ${humanStateLabel(item.to, labels)}`, 'state-change'),
    );
    const delta = textEl('span', formatDelta(item.scoreDelta), 'score-delta');
    delta.setAttribute('aria-label', item.scoreDelta < 0 ? `score ${item.scoreDelta}, penalty` : `score +${item.scoreDelta}, gain`);
    row.appendChild(delta);
    container.appendChild(row);
  }
}

/** Show a plain-language error with a single recovery action. Never silent. */
export function showDrillError(box: HTMLElement, messageEl: HTMLElement, message: string): void {
  messageEl.textContent = message;
  box.hidden = false;
}

export function hideDrillError(box: HTMLElement): void {
  box.hidden = true;
}
