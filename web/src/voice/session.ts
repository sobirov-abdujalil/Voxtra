/**
 * Voice session orchestration: mic -> token -> AssemblyAI WS -> tool.call ->
 * POST /turn -> tool.result -> UI. Owns the full lifecycle.
 *
 * Must be called from an explicit user gesture ("Start drill"). Nothing
 * microphone-related runs before this function is invoked (browser policy).
 */
import { PlaybackQueue, PlaybackScheduler, base64ToPCM16, pcm16ToBase64, pcm16ToFloat, sanitizeTranscript } from './audio.js';
import { VOICE_SAMPLE_RATE } from './audio.js';
import { classifyTranscriptEvent } from './events.js';
import { ToolResultGate } from './tool-gate.js';
import type { PendingTool } from './tool-gate.js';

export type VoiceStatus = 'idle' | 'requesting-mic' | 'live' | 'ended' | 'error';
export type MicState = 'idle' | 'requesting' | 'live' | 'denied' | 'stopped' | 'error';

export interface TranscriptEvent {
  kind: 'partial' | 'final';
  text: string;
}

export interface VoiceCallbacks {
  onStatus?: (s: VoiceStatus, info?: string) => void;
  onMicState?: (s: MicState) => void;
  onTranscript?: (e: TranscriptEvent) => void;
  onState?: (state: unknown) => void;
  onConsequence?: (text: string) => void;
  onError?: (message: string) => void;
}

export interface VoiceHandle {
  status: VoiceStatus;
  stop: () => void;
}

const FALLBACK_INTENTS = [
  'isolate_area',
  'notify_supervisor',
  'inspect_label',
  'document_incident',
  'ask_for_help',
  'approach_spill',
  'clean_spill',
  'leave_area',
];

const WS_DEFAULT = 'wss://agents.assemblyai.com/v1/ws';

interface TokenData {
  token: string;
  expires_in_seconds: number;
  wsUrl?: string;
}

function report(cb: VoiceCallbacks | undefined, fn: (c: VoiceCallbacks) => void, logMsg: string): void {
  try {
    if (cb) fn(cb);
  } catch (err) {
    // Callback errors must never break the voice loop silently.
    // eslint-disable-next-line no-console
    console.error(`voice callback failed: ${logMsg}: ${(err as Error).message}`);
  }
  // eslint-disable-next-line no-console
  console.error(`voice: ${logMsg}`);
}

function fail(cb: VoiceCallbacks | undefined, message: string): VoiceHandle {
  report(cb, (c) => c.onError?.(message), message);
  report(cb, (c) => c.onStatus?.('error', message), message);
  report(cb, (c) => c.onMicState?.('error'), message);
  return { status: 'error', stop: () => undefined };
}

async function fetchToken(): Promise<TokenData> {
  const res = await fetch('/api/voice/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = (await res.json()) as { ok: boolean; data?: TokenData; error?: { message?: string } };
  if (!body.ok || !body.data) throw new Error(body.error?.message ?? 'voice token failed');
  return body.data;
}

async function fetchSessionUpdate(scenarioId?: string): Promise<{ update: unknown; intents: string[] }> {
  try {
    const qs = scenarioId ? `?scenarioId=${encodeURIComponent(scenarioId)}` : '';
    const res = await fetch(`/api/voice/agent-config${qs}`);
    const body = (await res.json()) as {
      ok: boolean;
      data?: { sessionUpdate: unknown; submitActionTool?: { parameters?: { properties?: { intent?: { enum?: string[] } } } } };
    };
    if (body.ok && body.data) {
      const intents = body.data.submitActionTool?.parameters?.properties?.intent?.enum ?? FALLBACK_INTENTS;
      return { update: body.data.sessionUpdate, intents };
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`voice agent-config fetch failed: ${(err as Error).message}`);
  }
  return { update: null, intents: FALLBACK_INTENTS };
}

function parseSubmitCall(msg: Record<string, unknown>, intents: readonly string[]): { callId: string; intent: string } | null {
  const callId = (msg['call_id'] ?? msg['id']) as unknown;
  const name = (msg['name'] ?? (msg['tool'] as Record<string, unknown> | undefined)?.['name']) as unknown;
  if (typeof callId !== 'string' || callId.length === 0 || name !== 'submit_action') return null;
  const raw = (msg['arguments'] ?? msg['args'] ?? (msg['tool'] as Record<string, unknown> | undefined)?.['arguments']) as unknown;
  let args: Record<string, unknown> | null = null;
  if (typeof raw === 'string') {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
  } else if (typeof raw === 'object' && raw !== null) {
    args = raw as Record<string, unknown>;
  }
  const intent = args?.['intent'];
  if (typeof intent !== 'string' || !intents.includes(intent)) return null;
  return { callId, intent };
}

function extractAudioB64(msg: Record<string, unknown>): string | null {
  const v = msg['audio'] ?? msg['audio_base64'] ?? msg['data'];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function startVoiceDrill(
  sessionId: string,
  cb?: VoiceCallbacks,
  scenarioId?: string,
): Promise<VoiceHandle> {
  report(cb, (c) => c.onStatus?.('requesting-mic'), 'requesting microphone');
  report(cb, (c) => c.onMicState?.('requesting'), 'mic requesting');

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false },
    });
  } catch (err) {
    report(cb, (c) => c.onMicState?.('denied'), 'mic denied');
    return fail(cb, `Microphone denied (${(err as Error).message}). Use the text intent buttons instead.`);
  }

  let tokenData: TokenData;
  try {
    tokenData = await fetchToken();
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    report(cb, (c) => c.onMicState?.('error'), 'token fetch failed');
    return fail(cb, `Voice session unavailable (${(err as Error).message}). Use the text intent buttons instead.`);
  }

  const { update: sessionUpdate, intents } = await fetchSessionUpdate(scenarioId);
  const wsUrl = tokenData.wsUrl ?? WS_DEFAULT;
  const url = `${wsUrl}?token=${encodeURIComponent(tokenData.token)}`;

  // Chromium can render/capture at 24kHz directly; Firefox/Safari fall back and
  // the worklet resamples to 24kHz mono. One context serves capture + playback.
  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: 24000 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`voice AudioContext 24kHz failed, using default: ${(err as Error).message}`);
    ctx = new AudioContext();
  }
  try {
    await ctx.resume();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`voice AudioContext resume failed: ${(err as Error).message}`);
  }
  if (ctx.sampleRate !== VOICE_SAMPLE_RATE) {
    // Firefox/Safari path: the context runs at the hardware rate and the
    // worklet resamples to 24kHz (best-effort, unverified — see docs/decisions.md).
    // Surface it on-screen so a garbled-audio browser is never a mystery.
    report(
      cb,
      (c) => c.onStatus?.('requesting-mic', `Audio at ${ctx.sampleRate}Hz: resampling to 24kHz (best-effort).`),
      `non-24kHz context (${ctx.sampleRate}Hz), worklet resampling active`,
    );
  }

  let source: MediaStreamAudioSourceNode | null = null;
  let node: AudioWorkletNode | null = null;
  try {
    await ctx.audioWorklet.addModule('/pcm-worklet.js');
    source = ctx.createMediaStreamSource(stream);
    node = new AudioWorkletNode(ctx, 'voxtra-pcm-capture');
    source.connect(node);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch(() => undefined);
    return fail(cb, `Audio capture unavailable (${(err as Error).message}). Use the text intent buttons instead.`);
  }

  const playback = new PlaybackQueue();
  const submitted = new Set<string>();
  // tool.result is sent only when reply.done is the latest server event (see
  // tool-gate.ts). Sending earlier makes the agent fire the tool repeatedly.
  const gate = new ToolResultGate();
  let ready = false;
  let stopped = false;
  let lastFinal = '';
  // Gapless agent-audio clock per the official browser-integration lite
  // client: each reply.audio chunk is scheduled at
  //   playbackTime = max(playbackTime, now); src.start(playbackTime);
  //   playbackTime += buffer.duration;
  // Chaining via onended + immediate start() leaves event-loop gaps between
  // chunks — with ~50ms agent chunks the gaps are audible as choppy stutter
  // ("g'g'g"). All live sources are tracked so barge-in can stop them.
  const playbackClock = new PlaybackScheduler();
  const activeSources = new Set<AudioBufferSourceNode>();

  const ws = new WebSocket(url);

  const playNext = (): void => {
    if (stopped) return;
    let buf: ArrayBuffer | undefined;
    // Drain the FIFO queue, scheduling each chunk contiguously on the audio
    // clock. Scheduling (not onended chaining) absorbs network jitter: late
    // arrivals still slot at max(playbackTime, now) with no gap, no overlap.
    while ((buf = playback.dequeue()) !== undefined) {
      try {
        const float = pcm16ToFloat(buf.slice(0));
        if (float.length === 0) continue;
        const audioBuf = ctx.createBuffer(1, float.length, VOICE_SAMPLE_RATE);
        audioBuf.getChannelData(0).set(float);
        const src = ctx.createBufferSource();
        src.buffer = audioBuf;
        src.connect(ctx.destination);
        const now = ctx.currentTime;
        const when = playbackClock.schedule(now, audioBuf.duration);
        activeSources.add(src);
        playback.setCurrent({
          stop: () => {
            try {
              src.stop();
            } catch {
              // already stopped
            }
          },
        });
        src.onended = () => {
          activeSources.delete(src);
          if (activeSources.size === 0) playback.setCurrent(null);
        };
        src.start(when);
      } catch (err) {
        activeSources.clear();
        playback.setCurrent(null);
        report(cb, (c) => c.onError?.(`Agent audio decode failed: ${(err as Error).message}`), 'agent audio decode failed');
      }
    }
  };

  const bargeIn = (reason: string): void => {
    const { dropped, stoppedCurrent } = playback.clearOnBargeIn();
    let stoppedActive = 0;
    for (const src of [...activeSources]) {
      try {
        src.stop();
      } catch {
        // already stopped
      }
      stoppedActive += 1;
    }
    activeSources.clear();
    // Reset the schedule so stale future starts never play after the cut.
    // Mirrors the official `playbackTime = audioCtx.currentTime` on
    // reply.done interrupted.
    try {
      playbackClock.reset(ctx.currentTime);
    } catch {
      playbackClock.reset(0);
    }
    // eslint-disable-next-line no-console
    console.error(`voice barge-in (${reason}): dropped=${dropped} stopped=${stoppedCurrent} active=${stoppedActive}`);
  };

  const sendToolResult = (p: PendingTool): void => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        // Shape per the official events reference: { type, call_id, result, is_error? }.
        ws.send(
          JSON.stringify({
            type: 'tool.result',
            call_id: p.callId,
            result: p.result,
            ...(p.isError ? { is_error: true } : {}),
          }),
        );
      }
    } catch (err) {
      report(cb, (c) => c.onError?.(`tool.result send failed: ${(err as Error).message}`), 'tool.result send failed');
    }
  };

  const submitIntent = async (callId: string, intent: string): Promise<void> => {
    if (submitted.has(callId)) {
      report(cb, (c) => c.onError?.(`Duplicate tool call ignored: ${callId}`), `duplicate submit ignored ${callId}`);
      return;
    }
    submitted.add(callId);
    let consequence = '';
    let ok = true;
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent, userTranscript: lastFinal.slice(0, 2000), toolCallId: callId }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        data?: { consequence?: string; state?: unknown };
        error?: { code?: string; message?: string };
      };
      if (body.ok) {
        consequence = body.data?.consequence ?? 'Done.';
        report(cb, (c) => c.onState?.(body.data?.state), 'turn state updated');
        report(cb, (c) => c.onConsequence?.(consequence), 'turn consequence');
      } else {
        ok = false;
        consequence = body.data?.consequence ?? body.error?.message ?? 'That action had no effect.';
        if (body.data?.state !== undefined) report(cb, (c) => c.onState?.(body.data?.state), 'rejected turn state');
        report(cb, (c) => c.onConsequence?.(consequence), 'rejected turn consequence');
      }
    } catch (err) {
      ok = false;
      consequence = `Turn request failed: ${(err as Error).message}`;
      report(cb, (c) => c.onError?.(consequence), 'turn request failed');
    }
    for (const p of gate.add({ callId, result: consequence.slice(0, 2000), isError: !ok })) {
      sendToolResult(p);
    }
  };

  node.port.onmessage = (ev: MessageEvent) => {
    if (stopped || !ready || ws.readyState !== WebSocket.OPEN) return;
    const data = ev.data as { type?: string; buffer?: ArrayBuffer; message?: string };
    if (data.type === 'pcm-frame' && data.buffer) {
      try {
        ws.send(JSON.stringify({ type: 'input.audio', audio: pcm16ToBase64(data.buffer) }));
      } catch (err) {
        report(cb, (c) => c.onError?.(`Mic frame send failed: ${(err as Error).message}`), 'mic frame send failed');
      }
    } else if (data.type === 'capture-error') {
      report(cb, (c) => c.onError?.(`Mic capture error: ${data.message ?? 'unknown'}`), 'mic capture error');
    }
  };

  ws.addEventListener('open', () => {
    try {
      ws.send(JSON.stringify(sessionUpdate ?? { type: 'session.update', session: { tools: [] } }));
    } catch (err) {
      report(cb, (c) => c.onError?.(`session.update send failed: ${(err as Error).message}`), 'session.update failed');
    }
  });

  ws.addEventListener('message', (ev) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(ev.data as string) as Record<string, unknown>;
    } catch (err) {
      report(cb, (c) => c.onError?.(`Voice message parse failed: ${(err as Error).message}`), 'ws parse failed');
      return;
    }
    const type = typeof msg['type'] === 'string' ? (msg['type'] as string) : '';

    if (type === 'session.ready') {
      ready = true;
      gate.onServerEvent(type);
      report(cb, (c) => c.onStatus?.('live'), 'session ready, streaming');
      report(cb, (c) => c.onMicState?.('live'), 'mic live');
      return;
    }
    if (type === 'session.ended') {
      report(cb, (c) => c.onStatus?.('ended'), 'session ended by server');
      report(cb, (c) => c.onMicState?.('stopped'), 'mic stopped on session end');
      return;
    }
    if (type === 'session.error') {
      const detail = typeof msg['message'] === 'string' ? (msg['message'] as string) : 'session error';
      report(cb, (c) => c.onError?.(`Voice session error: ${detail}`), 'session error');
      report(cb, (c) => c.onStatus?.('error', detail), 'session error status');
      return;
    }
    if (type === 'tool.call') {
      const parsed = parseSubmitCall(msg, intents);
      if (!parsed) {
        report(cb, (c) => c.onError?.('Malformed tool call ignored (expected submit_action with a known intent).'), 'malformed tool call');
        return;
      }
      void submitIntent(parsed.callId, parsed.intent);
      return;
    }
    if (type === 'reply.started' || type === 'input.speech.started') {
      gate.onServerEvent(type);
      if (type === 'input.speech.started') bargeIn(type);
      return;
    }
    if (type === 'reply.done') {
      // The server reports interruptions via status:'interrupted' (not an
      // `interrupted` boolean). Dropped results are stale: the agent moved on.
      const before = gate.pendingCount;
      const due = gate.onServerEvent(type, msg['status']);
      if (msg['status'] === 'interrupted') {
        if (before > 0) {
          report(cb, (c) => c.onError?.(`Dropped ${before} stale tool result(s) after interruption.`), 'stale tool results dropped');
        }
        bargeIn(type);
      }
      for (const p of due) sendToolResult(p);
      return;
    }
    const lower = type.toLowerCase();
    if (lower.includes('transcript') || lower.includes('user.') || lower.includes('input.')) {
      const classified = classifyTranscriptEvent(msg);
      if (classified) {
        const text = sanitizeTranscript(classified.text);
        if (text) {
          // Agent captions render only; lastFinal (the /turn userTranscript
          // source) comes exclusively from user finals.
          if (!classified.agent && classified.kind === 'final') lastFinal = text;
          const kind = classified.kind;
          report(cb, (c) => c.onTranscript?.({ kind, text }), `transcript ${kind}`);
        }
      }
      // Any new user turn barges in: stop agent audio immediately.
      if (lower.includes('turn.start') || lower.includes('input.start') || lower.includes('user.start') || lower.includes('interrupted')) {
        bargeIn(type);
      }
      return;
    }
    const b64 = extractAudioB64(msg);
    if (b64 && (lower.includes('audio') || lower.includes('reply') || lower.includes('agent') || lower.includes('output'))) {
      try {
        playback.enqueue(base64ToPCM16(b64));
        playNext();
      } catch (err) {
        report(cb, (c) => c.onError?.(`Agent audio enqueue failed: ${(err as Error).message}`), 'agent audio enqueue failed');
      }
      return;
    }
  });

  ws.addEventListener('error', () => {
    if (!stopped) {
      report(cb, (c) => c.onError?.('Voice connection error. Reconnect or use text intents.'), 'ws error');
      report(cb, (c) => c.onStatus?.('error', 'Voice connection error.'), 'ws error status');
    }
  });

  ws.addEventListener('close', () => {
    if (!stopped) {
      report(cb, (c) => c.onStatus?.('ended'), 'ws closed');
      report(cb, (c) => c.onMicState?.('stopped'), 'mic stopped on ws close');
    }
  });

  const stop = (): void => {
    stopped = true;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.end' }));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`voice session.end send failed: ${(err as Error).message}`);
    }
    try { ws.close(); } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`voice ws close failed: ${(err as Error).message}`);
    }
    try { node?.disconnect(); } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`voice worklet disconnect failed: ${(err as Error).message}`);
    }
    try { source?.disconnect(); } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`voice source disconnect failed: ${(err as Error).message}`);
    }
    playback.clearOnBargeIn();
    for (const src of [...activeSources]) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSources.clear();
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close().catch((err: Error) => {
      // eslint-disable-next-line no-console
      console.error(`voice AudioContext close failed: ${err.message}`);
    });
    report(cb, (c) => c.onStatus?.('ended'), 'voice stopped');
    report(cb, (c) => c.onMicState?.('stopped'), 'mic stopped');
  };

  return { status: 'live', stop };
}
