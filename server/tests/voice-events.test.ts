import { describe, expect, it } from 'vitest';
import { classifyTranscriptEvent } from '../../web/src/voice/events.js';

describe('transcript event classification (live event names)', () => {
  it('maps transcript.user.delta to a user partial', () => {
    expect(classifyTranscriptEvent({ type: 'transcript.user.delta', text: 'isolate the' })).toEqual({
      kind: 'partial',
      agent: false,
      text: 'isolate the',
    });
  });

  it('maps transcript.user (no "final" in the name) to a user final', () => {
    // Regression: substring heuristics for "final" missed this exact name,
    // so userTranscript stayed empty and no final line ever rendered.
    expect(classifyTranscriptEvent({ type: 'transcript.user', text: "I'll isolate the area" })).toEqual({
      kind: 'final',
      agent: false,
      text: "I'll isolate the area",
    });
  });

  it('marks agent captions as agent-only (never a userTranscript source)', () => {
    expect(classifyTranscriptEvent({ type: 'transcript.agent.delta', delta: 'cordon' })).toMatchObject({
      kind: 'partial',
      agent: true,
    });
    expect(classifyTranscriptEvent({ type: 'transcript.agent', text: 'Area cordoned.' })).toMatchObject({
      kind: 'final',
      agent: true,
    });
  });

  it('keeps legacy fallbacks for unknown transcript flavors', () => {
    expect(classifyTranscriptEvent({ type: 'x.transcript.final', transcript: 'hi' })).toMatchObject({ kind: 'final' });
    expect(classifyTranscriptEvent({ type: 'user.speech', text: 'hi' })).toMatchObject({
      kind: 'partial',
      agent: false,
    });
  });

  it('returns null for non-transcript events and empty text', () => {
    expect(classifyTranscriptEvent({ type: 'reply.audio', data: 'AAA=' })).toBeNull();
    expect(classifyTranscriptEvent({ type: 'transcript.user', text: '' })).toBeNull();
    expect(classifyTranscriptEvent({ nope: 1 })).toBeNull();
  });
});
