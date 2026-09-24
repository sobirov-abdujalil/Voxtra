import { describe, expect, it } from 'vitest';
import { ToolResultGate } from '../../web/src/voice/tool-gate.js';

const t1 = { callId: 'c1', result: 'done one', isError: false };
const t2 = { callId: 'c2', result: 'done two', isError: false };

describe('tool.result gate: reply.done-gated flush', () => {
  it('sends immediately while the conversation is idle', () => {
    const gate = new ToolResultGate();
    expect(gate.add(t1)).toEqual([t1]);
    expect(gate.pendingCount).toBe(0);
  });

  it('holds results while a reply is in flight and drains in order on reply.done', () => {
    const gate = new ToolResultGate();
    expect(gate.onServerEvent('reply.started')).toEqual([]);
    expect(gate.add(t1)).toEqual([]);
    expect(gate.add(t2)).toEqual([]);
    expect(gate.pendingCount).toBe(2);
    expect(gate.onServerEvent('reply.done', 'completed')).toEqual([t1, t2]);
    expect(gate.pendingCount).toBe(0);
  });

  it('drops pending results when the reply is interrupted', () => {
    const gate = new ToolResultGate();
    gate.onServerEvent('reply.started');
    gate.add(t1);
    expect(gate.onServerEvent('reply.done', 'interrupted')).toEqual([]);
    expect(gate.pendingCount).toBe(0);
    // Gate is idle again: the next tool sends immediately.
    expect(gate.add(t2)).toEqual([t2]);
  });

  it('treats user speech starting as a busy turn', () => {
    const gate = new ToolResultGate();
    gate.onServerEvent('input.speech.started');
    expect(gate.add(t1)).toEqual([]);
    expect(gate.onServerEvent('reply.done', 'completed')).toEqual([t1]);
  });

  it('ignores unrelated events without changing state', () => {
    const gate = new ToolResultGate();
    gate.onServerEvent('reply.started');
    expect(gate.onServerEvent('reply.audio')).toEqual([]);
    expect(gate.onServerEvent('transcript.user')).toEqual([]);
    expect(gate.add(t1)).toEqual([]);
    expect(gate.pendingCount).toBe(1);
  });

  it('session.ready marks the gate idle', () => {
    const gate = new ToolResultGate();
    gate.onServerEvent('reply.started');
    gate.onServerEvent('session.ready');
    expect(gate.add(t1)).toEqual([t1]);
  });
});
