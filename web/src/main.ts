import {
  FALLBACK_REQUIRED_FLAGS,
  FALLBACK_STATE_LABELS,
  hideDrillError,
  humanStateLabel,
  micHumanLabel,
  parseHashRoute,
  progressText,
  renderDrillTimeline,
  showDrillError,
} from './drill-ui.js';
import type { EvidenceLike } from './drill-ui.js';
import { renderReport, renderReportError } from './report.js';
import type { ReportData } from './report.js';
import { startVoiceDrill } from './voice/session.js';
import type { MicState } from './voice/session.js';

const DEFAULT_SCENARIO_ID = 'warehouse-chemical-spill';
const API = '';

let sessionId: string | null = null;
let selectedScenarioId: string = DEFAULT_SCENARIO_ID;
let stopVoice: (() => void) | null = null;
let stateLabels: Record<string, string> = { ...FALLBACK_STATE_LABELS };
let requiredFlags: string[] = [...FALLBACK_REQUIRED_FLAGS];

const el = <T extends HTMLElement>(id: string): T => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`missing #${id}`);
  return node as T;
};

function setText(id: string, value: string): void {
  el(id).textContent = value;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error?.message ?? `request failed: ${path}`);
  return body.data as T;
}

function appendFinalTranscript(text: string): void {
  const list = el('transcript-final');
  const item = document.createElement('li');
  // textContent only — never innerHTML with transcript content.
  item.textContent = text;
  list.appendChild(item);
  while (list.children.length > 20) list.removeChild(list.children[0] as Node);
  // Auto-scroll the transcript pane only — never the page (no scroll trap).
  const wrap = document.getElementById('transcript-final-wrap');
  if (wrap) wrap.scrollTop = wrap.scrollHeight;
}

/** Single mic indicator: machine value stays in #mic-state; human label alongside. */
function setMicState(state: string): void {
  setText('mic-state', state);
  setText('mic-label', micHumanLabel(state));
  const indicator = document.getElementById('mic-indicator');
  if (indicator) indicator.dataset.micState = state;
  const cue = document.getElementById('barge-cue');
  if (cue) cue.hidden = state !== 'live';
}

/** Surface a failure loudly with one recovery action. Never silent. */
function showError(message: string): void {
  const box = document.getElementById('drill-error');
  const msg = document.getElementById('drill-error-message');
  if (box instanceof HTMLElement && msg instanceof HTMLElement) {
    showDrillError(box, msg, message);
  }
}

interface SessionStateLike {
  current?: unknown;
  flags?: Record<string, boolean>;
  evidence?: EvidenceLike[];
  completed?: unknown;
}

/** Render scenario state: human label + progress + drill timeline + raw detail. */
function renderScenarioState(state: unknown): void {
  setText('state', JSON.stringify(state, null, 2));
  if (typeof state === 'object' && state !== null) {
    const s = state as SessionStateLike;
    const current = typeof s.current === 'string' ? s.current : '';
    setText('scenario-label', current ? humanStateLabel(current, stateLabels) : 'No session yet.');
    setText('progress-indicator', progressText(s.flags, requiredFlags));
    renderProgressPips(s.flags, requiredFlags);
    const list = document.getElementById('drill-timeline-list');
    if (list instanceof HTMLElement && Array.isArray(s.evidence)) {
      renderDrillTimeline(list, s.evidence, stateLabels);
    }
    checkCompletedFromState(state);
  }
}

/** Additive progress pips: visual mirror of #progress-indicator text (tests pin the text). */
function renderProgressPips(flags: Record<string, boolean> | undefined, required: readonly string[]): void {
  const host = document.getElementById('progress-pips');
  if (!(host instanceof HTMLElement)) return;
  host.innerHTML = '';
  for (const flag of required) {
    const pip = document.createElement('span');
    pip.className = 'pip';
    if (flags?.[flag] === true) pip.classList.add('done');
    host.appendChild(pip);
  }
}

function showReportCta(completed: boolean): void {
  const box = el('report-cta-container');
  const btn = el<HTMLButtonElement>('open-report');
  const navReport = el<HTMLButtonElement>('nav-report');
  if (completed && sessionId) {
    box.hidden = false;
    navReport.disabled = false;
  } else {
    box.hidden = true;
  }
  btn.onclick = () => {
    if (sessionId) location.hash = `#/report/${sessionId}`;
  };
}

function checkCompletedFromState(state: unknown): void {
  if (typeof state === 'object' && state !== null) {
    const completed = (state as { completed?: unknown }).completed === true;
    showReportCta(completed);
  }
}

function starterConsequence(scenarioId: string): string {
  if (scenarioId === 'forklift-incident') {
    return 'Session started. A pedestrian is down by the forklift and the operator is shaken. What do you do?';
  }
  if (scenarioId === 'equipment-malfunction') {
    return 'Session started. A robotic arm has re-energized with a technician inside the cell. What do you do?';
  }
  return 'Session started. You face an unidentified spill. What do you do?';
}

async function startSession(): Promise<void> {
  setText('status', 'Creating drill session…');
  try {
    const data = await api<{ sessionId: string; state: unknown }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ scenarioId: selectedScenarioId }),
    });
    sessionId = data.sessionId;
    renderScenarioState(data.state);
    setText('status', `Session live: ${sessionId}`);
    el<HTMLButtonElement>('start-voice').disabled = false;
    setText('consequence', starterConsequence(selectedScenarioId));
  } catch (err) {
    const message = (err as Error).message;
    setText('status', message);
    showError(`${message}. Check the server is running, then try again.`);
  }
}

async function sendIntent(intent: string): Promise<void> {
  if (!sessionId) return;
  try {
    const data = await api<{ consequence: string; state: unknown; completed?: boolean }>(
      `/api/sessions/${sessionId}/turn`,
      {
        method: 'POST',
        body: JSON.stringify({ intent }),
      },
    );
    setText('consequence', data.consequence);
    renderScenarioState(data.state);
  } catch (err) {
    const message = (err as Error).message;
    setText('consequence', message);
    showError(message);
    // refresh state view after rejected turns
    try {
      const data = await api<{ state: unknown }>(`/api/sessions/${sessionId}`);
      renderScenarioState(data.state);
    } catch {
      // The error box already carries the failure; no second surface needed.
    }
  }
}

async function showView(): Promise<void> {
  const route = parseHashRoute(location.hash);
  const selectionView = el('selection-view');
  const drillView = el('drill-view');
  const reportView = el('report-view');
  selectionView.hidden = route.name !== 'selection';
  drillView.hidden = route.name !== 'drill';
  reportView.hidden = route.name !== 'report';
  if (route.name === 'report') {
    await loadReportIntoView(route.id);
  }
}

async function loadReportIntoView(id: string): Promise<void> {
  const content = el('report-content');
  setText('report-meta', `Session ${id}`);
  try {
    const report = await api<ReportData>(`/api/sessions/${id}/report`);
    renderReport(content, report);
  } catch (err) {
    // Never fail silently: surface load errors in the UI.
    renderReportError(content, (err as Error).message);
  }
}

function buildIntentButtons(intents: string[]): void {
  const box = el('intents');
  box.innerHTML = '';
  for (const intent of intents) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = intent;
    btn.addEventListener('click', () => void sendIntent(intent));
    box.appendChild(btn);
  }
}

async function loadScenarioDef(scenarioId: string): Promise<void> {
  try {
    const def = await api<{
      metadata?: { title?: string };
      intents: string[];
      states?: Array<{ id: string; label: string }>;
      completionCriteria?: { requiredFlags?: string[] };
    }>(`/api/scenarios/${scenarioId}`);
    buildIntentButtons(def.intents);
    if (Array.isArray(def.states)) {
      const labels: Record<string, string> = {};
      for (const s of def.states) {
        if (typeof s.id === 'string' && typeof s.label === 'string') labels[s.id] = s.label;
      }
      if (Object.keys(labels).length > 0) stateLabels = labels;
    }
    if (Array.isArray(def.completionCriteria?.requiredFlags) && def.completionCriteria.requiredFlags.length > 0) {
      requiredFlags = def.completionCriteria.requiredFlags.filter((f): f is string => typeof f === 'string');
    }
    const title = def.metadata?.title ?? scenarioId;
    const heading = document.querySelector('#drill-view h1');
    if (heading) heading.textContent = `${title} drill`;
    setText('status', 'Ready. Start a drill session.');
  } catch {
    // Server may not be running in static preview; keep text-fallback disabled state.
    buildIntentButtons([
      'isolate_area',
      'notify_supervisor',
      'inspect_label',
      'document_incident',
      'ask_for_help',
      'approach_spill',
      'clean_spill',
      'leave_area',
    ]);
    setText('status', 'Server unreachable. Start the API on :3001 first.');
  }
}

async function selectScenario(scenarioId: string): Promise<void> {
  selectedScenarioId = scenarioId;
  sessionId = null;
  el<HTMLButtonElement>('start-voice').disabled = true;
  showReportCta(false);
  await loadScenarioDef(scenarioId);
  location.hash = '#/drill';
}

async function init(): Promise<void> {
  await loadScenarioDef(selectedScenarioId);

  setMicState('idle');
  renderDrillTimeline(el('drill-timeline-list'), []);

  el<HTMLButtonElement>('start-session').addEventListener('click', () => void startSession());
  el<HTMLButtonElement>('nav-home').addEventListener('click', () => {
    location.hash = '#/';
  });
  el<HTMLButtonElement>('select-start-warehouse').addEventListener('click', () => {
    void selectScenario('warehouse-chemical-spill');
  });
  const forkliftBtn = document.getElementById('select-forklift');
  if (forkliftBtn instanceof HTMLButtonElement) {
    forkliftBtn.addEventListener('click', () => {
      void selectScenario('forklift-incident');
    });
  }
  const equipmentBtn = document.getElementById('select-equipment');
  if (equipmentBtn instanceof HTMLButtonElement) {
    equipmentBtn.addEventListener('click', () => {
      void selectScenario('equipment-malfunction');
    });
  }
  el<HTMLButtonElement>('nav-drill').addEventListener('click', () => {
    location.hash = '#/drill';
  });
  el<HTMLButtonElement>('nav-report').addEventListener('click', () => {
    if (sessionId) location.hash = `#/report/${sessionId}`;
  });
  el<HTMLButtonElement>('back-to-drill').addEventListener('click', () => {
    location.hash = '#/drill';
  });
  el<HTMLButtonElement>('drill-error-dismiss').addEventListener('click', () => {
    const box = el('drill-error');
    hideDrillError(box);
    const first = document.querySelector<HTMLElement>('#intents button');
    first?.focus();
  });
  window.addEventListener('hashchange', () => void showView());
  el<HTMLButtonElement>('start-voice').addEventListener('click', () => {
    void (async () => {
      // Explicit user gesture gate: mic/WS start only from this click.
      if (!sessionId) {
        setText('status', 'Start a drill session first.');
        return;
      }
      const drillId = sessionId;
      setText('status', 'Requesting microphone…');
      setMicState('requesting');
      try {
        const handle = await startVoiceDrill(
          drillId,
          {
            onStatus: (s, info) => setText('status', info ?? `Voice: ${s}`),
            onMicState: (s: MicState) => setMicState(s),
            onTranscript: (e) => {
              if (e.kind === 'partial') setText('transcript-partial', e.text);
              else {
                setText('transcript-partial', '—');
                appendFinalTranscript(e.text);
              }
            },
            onState: (state) => {
              renderScenarioState(state);
            },
            onConsequence: (text) => setText('consequence', text),
            onError: (message) => {
              setText('status', message);
              showError(message);
            },
          },
          selectedScenarioId,
        );
        stopVoice = handle.stop;
        el<HTMLButtonElement>('stop-voice').disabled = false;
        el<HTMLButtonElement>('start-voice').disabled = true;
      } catch (err) {
        const message = (err as Error).message;
        setText('status', message);
        setMicState('error');
        showError(`${message}. Try again, try Chromium, or use the text intents below.`);
      }
    })();
  });
  el<HTMLButtonElement>('stop-voice').addEventListener('click', () => {
    stopVoice?.();
    stopVoice = null;
    el<HTMLButtonElement>('stop-voice').disabled = true;
    el<HTMLButtonElement>('start-voice').disabled = false;
    setMicState('stopped');
    setText('status', sessionId ? `Session live: ${sessionId}` : 'Ready.');
  });
  await showView();
}

void init();
