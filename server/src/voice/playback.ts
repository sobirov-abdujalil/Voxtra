/**
 * Unit-testable barge-in helper.
 * Owns the queued agent-audio buffers + the currently playing source.
 * On any new user turn, call clearOnBargeIn() to drop the queue and stop playback.
 */
export interface Stoppable {
  stop: () => void;
}

export class PlaybackQueue {
  private queue: ArrayBuffer[] = [];
  private current: Stoppable | null = null;

  get queuedCount(): number {
    return this.queue.length;
  }

  get hasCurrent(): boolean {
    return this.current !== null;
  }

  setCurrent(source: Stoppable | null): void {
    this.current = source;
  }

  enqueue(buf: ArrayBuffer): void {
    this.queue.push(buf);
  }

  dequeue(): ArrayBuffer | undefined {
    return this.queue.shift();
  }

  clear(): void {
    this.queue = [];
  }

  /**
   * Barge-in: drop every queued buffer and stop the currently playing source.
   * Returns counts so callers/tests can assert the behavior.
   */
  clearOnBargeIn(): { dropped: number; stoppedCurrent: boolean } {
    const dropped = this.queue.length;
    this.queue = [];
    let stoppedCurrent = false;
    if (this.current) {
      try {
        this.current.stop();
      } catch {
        // stop must never throw through the barge-in path; count it as stopped anyway
      }
      stoppedCurrent = true;
      this.current = null;
    }
    return { dropped, stoppedCurrent };
  }
}
