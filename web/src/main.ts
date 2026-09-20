import { startVoiceSession } from './voice.js';

const SCENARIO_ID = 'warehouse-chemical-spill';
const API = '';

let sessionId: string | null = null;
let stopVoice: (() => void) | null = null;

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

async function startSession(): Promise<void> {
  setText('status', 'Creating drill session…');
  const data = await api<{ sessionId: string; state: unknown }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ scenarioId: SCENARIO_ID }),
  });
  sessionId = data.sessionId;
  setText('state', JSON.stringify(data.state, null, 2));
  setText('status', `Session live: ${sessionId}`);
  el<HTMLButtonElement>('start-voice').disabled = false;
  el<HTMLButtonElement>('load-report').disabled = false;
  setText('consequence', 'Session started. You face an unidentified spill. What do you do?');
}

async function sendIntent(intent: string): Promise<void> {
  if (!sessionId) return;
  try {
    const data = await api<{ consequence: string; state: unknown }>(`/api/sessions/${sessionId}/turn`, {
      method: 'POST',
      body: JSON.stringify({ intent }),
    });
    setText('consequence', data.consequence);
    setText('state', JSON.stringify(data.state, null, 2));
  } catch (err) {
    setText('consequence', (err as Error).message);
    // refresh state view after rejected turns
    const data = await api<{ state: unknown }>(`/api/sessions/${sessionId}`);
    setText('state', JSON.stringify(data.state, null, 2));
  }
}

async function loadReport(): Promise<void> {
  if (!sessionId) return;
  const data = await api<unknown>(`/api/sessions/${sessionId}/report`);
  setText('report', JSON.stringify(data, null, 2));
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

async function init(): Promise<void> {
  try {
    const data = await api<{ intents: string[] }>(`/api/scenarios/${SCENARIO_ID}`);
    buildIntentButtons(data.intents);
    setText('status', 'Ready. Start a drill session.');
  } catch {
    // Server may not be running in static preview; keep text-fallback disabled state.
    buildIntentButtons([
      'isolate_area',
      'notify_supervisor',
      'inspect_label',
      'ask_for_help',
      'approach_spill',
      'clean_spill',
      'leave_area',
    ]);
    setText('status', 'Server unreachable. Start the API on :3001 first.');
  }

  el<HTMLButtonElement>('start-session').addEventListener('click', () => void startSession());
  el<HTMLButtonElement>('load-report').addEventListener('click', () => void loadReport());
  el<HTMLButtonElement>('start-voice').addEventListener('click', () => {
    void (async () => {
      setText('status', 'Requesting microphone…');
      const handle = await startVoiceSession((s, info) => setText('status', info ?? `Voice: ${s}`));
      stopVoice = handle.stop;
      el<HTMLButtonElement>('stop-voice').disabled = false;
      el<HTMLButtonElement>('start-voice').disabled = true;
    })();
  });
  el<HTMLButtonElement>('stop-voice').addEventListener('click', () => {
    stopVoice?.();
    stopVoice = null;
    el<HTMLButtonElement>('stop-voice').disabled = true;
    el<HTMLButtonElement>('start-voice').disabled = false;
    setText('status', sessionId ? `Session live: ${sessionId}` : 'Ready.');
  });
}

void init();
