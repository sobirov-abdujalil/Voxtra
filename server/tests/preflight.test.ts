import { describe, expect, it } from 'vitest';
import {
  PREFLIGHT_MAX_CPU_PCT,
  PREFLIGHT_MAX_TCP_LATENCY_MS,
  PREFLIGHT_MIN_FREE_DISK_GB,
  evaluatePreflight,
} from '../../e2e/preflight.js';

/**
 * Threshold logic for the E2E pre-flight gate (2026-09-24 Forklift diagnosis
 * mitigation). Pure function, no network, no sampling — the live sampler is
 * exercised manually via `npm run preflight` (see docs/test-plan.md).
 */
describe('preflight threshold logic', () => {
  it('passes a fit machine with empty reasons', () => {
    const verdict = evaluatePreflight({
      cpuPct: 30,
      tcpAttempts: 3,
      tcpSuccesses: 3,
      tcpLatencyMs: 120,
      freeDiskGb: 180,
    });
    expect(verdict.ok).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it('passes when every dimension is unknown (cannot assess is not unfit)', () => {
    const verdict = evaluatePreflight({});
    expect(verdict.ok).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it('aborts above the CPU ceiling and names CPU', () => {
    const verdict = evaluatePreflight({ cpuPct: PREFLIGHT_MAX_CPU_PCT + 5 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/CPU/);
  });

  it('passes exactly at the CPU ceiling (fail only when strictly above)', () => {
    expect(evaluatePreflight({ cpuPct: PREFLIGHT_MAX_CPU_PCT }).ok).toBe(true);
    expect(evaluatePreflight({ cpuPct: PREFLIGHT_MAX_CPU_PCT + 0.1 }).ok).toBe(false);
  });

  it('aborts when all TCP attempts fail and names connectivity', () => {
    const verdict = evaluatePreflight({ tcpAttempts: 3, tcpSuccesses: 0 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/TCP connect/);
  });

  it('aborts on excessive TCP latency and names latency', () => {
    const verdict = evaluatePreflight({
      tcpAttempts: 3,
      tcpSuccesses: 2,
      tcpLatencyMs: PREFLIGHT_MAX_TCP_LATENCY_MS + 1000,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/latency/);
  });

  it('aborts below the free-disk floor and names disk', () => {
    const verdict = evaluatePreflight({ freeDiskGb: PREFLIGHT_MIN_FREE_DISK_GB - 1 });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.join(' ')).toMatch(/disk/);
  });

  it('lists every failing dimension when several fail at once', () => {
    const verdict = evaluatePreflight({
      cpuPct: PREFLIGHT_MAX_CPU_PCT + 10,
      tcpAttempts: 3,
      tcpSuccesses: 0,
      freeDiskGb: 1,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toHaveLength(3);
  });
});
