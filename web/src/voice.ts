/**
 * Back-compat shim. Full implementation lives in ./voice/session.ts.
 * The permanent API key NEVER appears here or anywhere in web/.
 */
export type { MicState, TranscriptEvent, VoiceCallbacks, VoiceHandle, VoiceStatus } from './voice/session.js';
export { startVoiceDrill } from './voice/session.js';

import { startVoiceDrill } from './voice/session.js';
import type { VoiceHandle, VoiceStatus } from './voice/session.js';

export async function fetchVoiceToken(): Promise<{ token: string; expires_in_seconds: number; wsUrl?: string }> {
  const res = await fetch('/api/voice/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'voice token failed');
  return body.data;
}

/**
 * Legacy entry kept for older callers. Prefer startVoiceDrill(sessionId, callbacks)
 * so tool calls can POST turns with evidence continuity.
 */
export async function startVoiceSession(
  onStatus: (s: VoiceStatus, info?: string) => void,
  sessionId?: string,
): Promise<VoiceHandle> {
  if (!sessionId) {
    onStatus('error', 'Start a drill session first, then start voice.');
    return { status: 'error', stop: () => undefined };
  }
  return startVoiceDrill(sessionId, { onStatus });
}
