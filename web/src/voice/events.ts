/**
 * Pure server-event transcript classification (DOM-free, unit-testable).
 *
 * Live-verified against the official events reference: user partials arrive as
 * `transcript.user.delta`, user finals as `transcript.user` (note: NO "final"
 * in the name — substring heuristics miss it), agent captions as
 * `transcript.agent.delta` / `transcript.agent`. Legacy substring fallbacks
 * are kept for forward-compatibility, but the exact documented names win.
 *
 * Shared as a pure module so server-side Vitest can pin the behavior;
 * web/src/voice/session.ts is the only production importer.
 */

export interface ClassifiedTranscript {
  kind: 'partial' | 'final';
  /** True for agent captions: render-only, never a userTranscript source. */
  agent: boolean;
  text: string;
}

function rawText(msg: Record<string, unknown>): string {
  const v = msg['transcript'] ?? msg['text'] ?? msg['delta'];
  return typeof v === 'string' ? v : '';
}

export function classifyTranscriptEvent(msg: Record<string, unknown>): ClassifiedTranscript | null {
  const rawType = msg['type'];
  if (typeof rawType !== 'string') return null;
  const type = rawType.toLowerCase();
  const text = rawText(msg);
  if (!text) return null;

  // Documented exact names first.
  if (type === 'transcript.user.delta') return { kind: 'partial', agent: false, text };
  if (type === 'transcript.user') return { kind: 'final', agent: false, text };
  if (type === 'transcript.agent.delta') return { kind: 'partial', agent: true, text };
  if (type === 'transcript.agent') return { kind: 'final', agent: true, text };

  // Legacy/future fallback: anything transcript/user/input-flavored.
  if (!(type.includes('transcript') || type.includes('user.') || type.includes('input.'))) return null;
  const isFinal =
    type.includes('final') || msg['final'] === true || type.includes('turn.end') || type.includes('input.end');
  return { kind: isFinal ? 'final' : 'partial', agent: type.includes('agent'), text };
}
