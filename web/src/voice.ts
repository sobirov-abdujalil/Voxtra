/**
 * Voice client skeleton (verified against AssemblyAI docs, Sep 2026).
 *
 * Flow:
 * 1. POST /api/voice/token -> { token, expires_in_seconds } (short-lived, one-time use).
 * 2. Open wss://agents.assemblyai.com/v1/ws?token=<token>.
 * 3. First message MUST be session.update (agent_id or inline config).
 * 4. Stream PCM16 mic audio (getUserMedia + AudioWorklet); play back agent audio.
 * 5. Transcripts arrive as events; map final transcripts to intent enums and
 *    POST them to /api/sessions/:id/turn — the deterministic engine decides.
 * 6. End gracefully with session.end before closing.
 *
 * The permanent API key NEVER appears here or anywhere in web/.
 */

export type VoiceStatus = 'idle' | 'requesting-mic' | 'live' | 'ended' | 'error';

export interface VoiceHandle {
  status: VoiceStatus;
  stop: () => void;
}

const WS_URL = 'wss://agents.assemblyai.com/v1/ws';

export async function fetchVoiceToken(): Promise<{ token: string; expires_in_seconds: number }> {
  const res = await fetch('/api/voice/token', { method: 'POST' });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'voice token failed');
  return body.data;
}

export async function startVoiceSession(onStatus: (s: VoiceStatus, info?: string) => void): Promise<VoiceHandle> {
  onStatus('requesting-mic');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false },
    });
  } catch {
    onStatus('error', 'Microphone denied. Use the text intent buttons instead.');
    return { status: 'error', stop: () => undefined };
  }

  let token: string;
  try {
    ({ token } = await fetchVoiceToken());
  } catch {
    onStatus('error', 'Voice session unavailable. Use the text intent buttons instead.');
    stream.getTracks().forEach((t) => t.stop());
    return { status: 'error', stop: () => undefined };
  }

  const url = new URL(WS_URL);
  url.searchParams.set('token', token);
  const ws = new WebSocket(url.toString());
  let stopped = false;

  ws.addEventListener('open', () => {
    // Inline session config placeholder — replaced by stored agent_id once provisioned.
    ws.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          system_prompt:
            'You are a warehouse safety coach. Interpret the trainee speech and keep replies short. Never assert scores or completion.',
          greeting: 'Spill drill started. What do you do first?',
          output: { voice: 'ivy' },
        },
      }),
    );
    onStatus('live');
  });

  ws.addEventListener('error', () => {
    if (!stopped) onStatus('error', 'Voice connection error. Reconnect or use text intents.');
  });

  ws.addEventListener('close', () => {
    if (!stopped) onStatus('ended');
  });

  const stop = (): void => {
    stopped = true;
    try {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'session.end' }));
    } catch {
      // ignore close-path errors
    }
    try {
      ws.close();
    } catch {
      // ignore
    }
    stream.getTracks().forEach((t) => t.stop());
    onStatus('ended');
  };

  // NOTE: PCM16 AudioWorklet streaming + agent-audio playback lands in the next
  // task (needs pcm-processor worklet + playback queue). Socket + mic lifecycle
  // above is the verified skeleton.
  void stream;
  return { status: 'live', stop };
}
