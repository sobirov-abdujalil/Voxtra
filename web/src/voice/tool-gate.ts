/**
 * Pure client-side tool.result gating (DOM-free, unit-testable).
 *
 * Official guidance: send tool.result when `reply.done` is the latest event
 * received — not earlier (agent still mid-transition-phrase), not later (a new
 * turn has started). Sending while `reply.started` is latest makes the agent
 * fire the same tool repeatedly.
 *
 * The gate accumulates completed tool executions and drains them when the
 * conversation is idle. Interrupted replies drop their pending results (the
 * agent has moved on). Shared as a pure module so server-side Vitest can pin
 * the behavior; web/src/voice/session.ts is the only production importer.
 */

export interface PendingTool {
  callId: string;
  result: string;
  isError: boolean;
}

export class ToolResultGate {
  private pending: PendingTool[] = [];
  private idle = true;

  get pendingCount(): number {
    return this.pending.length;
  }

  /** Queue a finished tool execution; returns results ready to send now. */
  add(tool: PendingTool): PendingTool[] {
    this.pending.push(tool);
    return this.drain();
  }

  /**
   * Feed a server event through the gate; returns results ready to send now.
   * Only reply.* / input.speech.started / session.ready affect idleness.
   */
  onServerEvent(type: string, status?: unknown): PendingTool[] {
    const lower = type.toLowerCase();
    if (lower === 'reply.done') {
      if (status === 'interrupted') {
        this.pending = [];
        this.idle = true;
        return [];
      }
      this.idle = true;
      return this.drain();
    }
    if (lower === 'reply.started' || lower === 'input.speech.started') {
      this.idle = false;
      return [];
    }
    if (lower === 'session.ready') {
      this.idle = true;
      return [];
    }
    return [];
  }

  private drain(): PendingTool[] {
    if (!this.idle || this.pending.length === 0) return [];
    const out = this.pending;
    this.pending = [];
    return out;
  }
}
