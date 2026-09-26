export interface ReportEvidence {
  turn: number;
  userTranscript?: string;
  intent: string;
  from: string;
  to: string;
  rule?: string;
  result?: string;
  scoreDelta: number;
  timestamp?: string;
}

export interface ReportBreakdown {
  completed: Array<{ action: string; turn: number; scoreDelta: number }>;
  missed: Array<{ action: string }>;
  invalid: Array<{ turn: number; intent: string; rule: string }>;
  recovery: Array<{ turn: number; intent: string; from: string; to: string; scoreDelta: number }>;
  penalties: Array<{ turn: number; intent: string; rule: string; scoreDelta: number }>;
}

export interface ReportData {
  scenarioId: string;
  title: string;
  completed: boolean;
  turns: number;
  score: number;
  denominator: number;
  maxScore?: number;
  /** Option-A headline contract: capped required-path score (see server buildReport). Optional for back-compat; derived when absent. */
  headlineScore?: number;
  /** Extra credit above the denominator, shown on its own labeled line. Optional for back-compat; derived when absent. */
  bonusPoints?: number;
  summary: string;
  breakdown: ReportBreakdown;
  evidence: ReportEvidence[];
  recoveryPaths?: Record<string, string[]>;
}

function text(parent: HTMLElement, value: string): Text {
  const node = document.createTextNode(value);
  parent.appendChild(node);
  return node;
}

function elWithText(tag: string, value: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function turnList(value: number | number[] | undefined): number[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function highlightTurns(timeline: HTMLElement, turns: number[]): void {
  const rows = timeline.querySelectorAll<HTMLElement>('.timeline-row');
  rows.forEach((row) => {
    const t = Number(row.dataset.turn);
    if (turns.includes(t)) {
      row.classList.add('highlighted');
    } else {
      row.classList.remove('highlighted');
    }
  });
  const first = turns.length > 0 ? timeline.querySelector<HTMLElement>(`.timeline-row[data-turn="${turns[0]}"]`) : null;
  if (first) {
    try {
      first.scrollIntoView({ block: 'nearest' });
    } catch {
      // scrollIntoView may be unavailable in test DOM; highlighting still applies.
    }
  }
}

function makeBreakdownButton(label: string, turns: number[], timeline: HTMLElement): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'breakdown-entry';
  if (turns.length > 0) btn.dataset.turns = turns.join(',');
  // Keep the full label as text (tests/E2E assert on it), then append a
  // small turn pill for scanning. textContent still contains the label.
  btn.textContent = `${label} `;
  if (turns.length > 0) {
    const pill = document.createElement('span');
    pill.className = 'turn-pill';
    pill.textContent = turns.length === 1 ? `turn ${turns[0]}` : `turns ${turns.join(', ')}`;
    btn.appendChild(pill);
  }
  btn.addEventListener('click', () => {
    highlightTurns(timeline, turns);
  });
  return btn;
}

function buildTimelineRow(evidence: ReportEvidence): HTMLElement {
  const row = document.createElement('article');
  row.className = 'timeline-row';
  if (evidence.scoreDelta < 0) row.classList.add('negative');
  else if (evidence.scoreDelta > 0) row.classList.add('positive');
  row.dataset.turn = String(evidence.turn);
  row.tabIndex = 0;

  const header = document.createElement('div');
  header.className = 'timeline-header';
  header.appendChild(elWithText('span', `Turn ${evidence.turn}`, 'turn-num'));
  header.appendChild(elWithText('span', evidence.intent, 'intent-chip'));
  header.appendChild(elWithText('span', `${evidence.from} → ${evidence.to}`, 'state-change'));
  const delta = evidence.scoreDelta >= 0 ? `+${evidence.scoreDelta}` : `${evidence.scoreDelta}`;
  header.appendChild(elWithText('span', delta, 'score-delta'));
  row.appendChild(header);

  const transcriptLine = document.createElement('p');
  transcriptLine.className = 'transcript-line';
  // textContent only — never innerHTML with transcript content.
  transcriptLine.textContent = evidence.userTranscript && evidence.userTranscript.length > 0 ? `“${evidence.userTranscript}”` : '—';
  row.appendChild(transcriptLine);

  const detail = document.createElement('div');
  detail.className = 'timeline-detail';
  detail.hidden = true;
  const fields: Array<[string, string]> = [
    ['Timestamp', evidence.timestamp ?? '—'],
    ['Intent', evidence.intent],
    ['From', evidence.from],
    ['To', evidence.to],
    ['Rule', evidence.rule ?? '—'],
    ['Result', evidence.result ?? '—'],
    ['Score delta', String(evidence.scoreDelta)],
  ];
  for (const [label, value] of fields) {
    const line = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = `${label}: `;
    line.appendChild(strong);
    text(line, value);
    detail.appendChild(line);
  }
  // Natural home for a future audio control; disabled by design in this task.
  const audioBtn = document.createElement('button');
  audioBtn.type = 'button';
  audioBtn.className = 'audio-replay';
  audioBtn.disabled = true;
  audioBtn.title = 'Audio replay is not stored in this build';
  audioBtn.textContent = 'Play audio (unavailable)';
  detail.appendChild(audioBtn);
  row.appendChild(detail);

  const toggle = (): void => {
    detail.hidden = !detail.hidden;
    row.classList.toggle('expanded', !detail.hidden);
  };
  row.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    toggle();
  });
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  });
  return row;
}

export function renderReport(container: HTMLElement, report: ReportData): void {
  container.innerHTML = '';

  const header = document.createElement('header');
  header.className = 'report-header';
  // Option-A headline (H4 fix): the numerator never exceeds the denominator.
  // Bonuses render on their own labeled line, never inside the fraction.
  const bonus = report.bonusPoints ?? Math.max(0, report.score - report.denominator);
  const headline = report.headlineScore ?? report.score - bonus;
  const scoreLine = document.createElement('h2');
  scoreLine.id = 'report-score';
  // Hero number with the denominator secondary: separate spans keep
  // textContent as "65 / 65" so existing assertions still pass.
  const numSpan = document.createElement('span');
  numSpan.className = 'score-num';
  numSpan.textContent = String(headline);
  const denSpan = document.createElement('span');
  denSpan.className = 'score-den';
  denSpan.textContent = `/ ${report.denominator}`;
  scoreLine.append(numSpan, document.createTextNode(' '), denSpan);
  scoreLine.setAttribute('aria-label', `Score ${headline} out of ${report.denominator}`);
  header.appendChild(scoreLine);
  if (bonus > 0) {
    const bonusLine = document.createElement('p');
    bonusLine.id = 'report-bonus';
    bonusLine.className = 'bonus';
    bonusLine.textContent = `+${bonus} bonus points`;
    header.appendChild(bonusLine);
  }

  const completion = document.createElement('p');
  completion.id = 'report-completion';
  completion.textContent = report.completed ? 'Drill complete' : 'Drill incomplete';
  completion.className = report.completed ? 'completed' : 'incomplete';
  header.appendChild(completion);

  const summary = document.createElement('p');
  summary.id = 'report-summary';
  summary.textContent = report.summary;
  header.appendChild(summary);
  container.appendChild(header);

  const breakdown = document.createElement('section');
  breakdown.id = 'report-breakdown';
  container.appendChild(breakdown);

  const timeline = document.createElement('section');
  timeline.id = 'report-timeline';
  const timelineTitle = document.createElement('h3');
  timelineTitle.textContent = `Evidence timeline (${report.evidence.length} turns)`;
  timeline.appendChild(timelineTitle);
  container.appendChild(timeline);

  const groups: Array<{ key: keyof ReportBreakdown; title: string }> = [
    { key: 'completed', title: 'Completed' },
    { key: 'missed', title: 'Missed' },
    { key: 'invalid', title: 'Invalid' },
    { key: 'recovery', title: 'Recovery' },
    { key: 'penalties', title: 'Penalties' },
  ];
  for (const group of groups) {
    const box = document.createElement('div');
    box.className = 'breakdown-group';
    box.id = `breakdown-${group.key}`;
    const title = document.createElement('h4');
    title.textContent = group.title;
    box.appendChild(title);
    const list = document.createElement('div');
    list.className = 'breakdown-list';
    const entries = report.breakdown[group.key] as unknown[];
    if (entries.length === 0) {
      list.appendChild(elWithText('p', '—', 'empty'));
    }
    for (const entry of entries) {
      const record = entry as Record<string, unknown>;
      if (group.key === 'completed') {
        const action = String(record['action'] ?? '');
        const turn = Number(record['turn']);
        const delta = Number(record['scoreDelta']);
        const label = `${action} (turn ${turn}, ${delta >= 0 ? '+' : ''}${delta})`;
        list.appendChild(makeBreakdownButton(label, turnList(turn), timeline));
      } else if (group.key === 'missed') {
        const action = String(record['action'] ?? '');
        const item = document.createElement('p');
        item.className = 'breakdown-entry missed';
        item.textContent = action;
        list.appendChild(item);
      } else if (group.key === 'invalid') {
        const turn = Number(record['turn']);
        const intent = String(record['intent'] ?? '');
        list.appendChild(makeBreakdownButton(`${intent} (turn ${turn})`, turnList(turn), timeline));
      } else if (group.key === 'recovery') {
        const turn = Number(record['turn']);
        const intent = String(record['intent'] ?? '');
        const delta = Number(record['scoreDelta']);
        list.appendChild(makeBreakdownButton(`${intent} (turn ${turn}, +${delta})`, turnList(turn), timeline));
      } else {
        const turn = Number(record['turn']);
        const intent = String(record['intent'] ?? '');
        const delta = Number(record['scoreDelta']);
        list.appendChild(makeBreakdownButton(`${intent} (turn ${turn}, ${delta})`, turnList(turn), timeline));
      }
    }
    box.appendChild(list);
    breakdown.appendChild(box);
  }

  const ordered = [...report.evidence].sort((a, b) => a.turn - b.turn);
  for (const item of ordered) {
    timeline.appendChild(buildTimelineRow(item));
  }
}

export function renderReportError(container: HTMLElement, message: string): void {
  container.innerHTML = '';
  const alert = document.createElement('p');
  alert.id = 'report-error';
  alert.role = 'alert';
  alert.textContent = `Could not load the report: ${message}`;
  container.appendChild(alert);
}
