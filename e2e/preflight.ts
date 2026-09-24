/**
 * E2E pre-flight environment check (2026-09-24 Forklift diagnosis mitigation).
 *
 * The Task 13 recurrence (forklift golden 0/2 with turn-skip/reorder signatures
 * plus a mid-drill equipment audio stall, wall-clock 2-3x inflated) was
 * classified as environmental/service-side, not product code: the Task 9
 * prompt fix is intact at runtime, the 90s fixture tails are intact on disk,
 * and every heard utterance in both runs mapped to its correct intent.
 * A loaded machine makes turn detection close turns out of order instead of
 * producing a legible signal — this module makes an unfit machine abort with
 * a clear message rather than produce a false red.
 *
 * Thresholds are deliberately lenient: they abort only on a clearly-unfit
 * machine, never on ordinary load. Tightening a threshold to hide a product
 * failure is forbidden (see project-state/REGRESSIONS.md).
 */
import { cpus } from 'node:os';
import { statfsSync } from 'node:fs';
import { connect } from 'node:net';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PREFLIGHT_MAX_CPU_PCT = 85;
export const PREFLIGHT_TCP_HOST = 'agents.assemblyai.com';
export const PREFLIGHT_TCP_PORT = 443;
export const PREFLIGHT_TCP_ATTEMPTS = 3;
export const PREFLIGHT_TCP_TIMEOUT_MS = 5000;
export const PREFLIGHT_MAX_TCP_LATENCY_MS = 3000;
export const PREFLIGHT_MIN_FREE_DISK_GB = 5;

export interface PreflightSample {
  /** Mean % CPU busy over the sample window. undefined = could not sample (pass). */
  cpuPct?: number;
  /** Successful TCP connects to the voice backend. undefined = not probed (pass). */
  tcpSuccesses?: number;
  tcpAttempts?: number;
  /** Mean connect latency over successful attempts, ms. */
  tcpLatencyMs?: number;
  /** Free disk on the repo volume, GB. undefined = could not assess (pass). */
  freeDiskGb?: number;
}

export interface PreflightVerdict {
  ok: boolean;
  reasons: string[];
}

/** Pure threshold logic: the unit-tested core. Unknown dimensions pass. */
export function evaluatePreflight(sample: PreflightSample): PreflightVerdict {
  const reasons: string[] = [];
  if (sample.cpuPct !== undefined && sample.cpuPct > PREFLIGHT_MAX_CPU_PCT) {
    reasons.push(`CPU ${sample.cpuPct.toFixed(1)}% exceeds ${PREFLIGHT_MAX_CPU_PCT}% — machine is unfit for live E2E`);
  }
  if (sample.tcpAttempts !== undefined) {
    const successes = sample.tcpSuccesses ?? 0;
    if (successes < 1) {
      reasons.push(
        `TCP connect to ${PREFLIGHT_TCP_HOST}:${PREFLIGHT_TCP_PORT} failed ${sample.tcpAttempts}/${sample.tcpAttempts} attempts — voice backend unreachable from this machine`,
      );
    } else if (sample.tcpLatencyMs !== undefined && sample.tcpLatencyMs > PREFLIGHT_MAX_TCP_LATENCY_MS) {
      reasons.push(
        `TCP latency ${Math.round(sample.tcpLatencyMs)}ms exceeds ${PREFLIGHT_MAX_TCP_LATENCY_MS}ms — network too jittery for turn detection`,
      );
    }
  }
  if (sample.freeDiskGb !== undefined && sample.freeDiskGb < PREFLIGHT_MIN_FREE_DISK_GB) {
    reasons.push(`Free disk ${sample.freeDiskGb.toFixed(1)}GB below ${PREFLIGHT_MIN_FREE_DISK_GB}GB — browser profile + artifacts may stall`);
  }
  return { ok: reasons.length === 0, reasons };
}

function snapshotCpu(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const c of cpus()) {
    idle += c.times.idle;
    total += c.times.user + c.times.nice + c.times.sys + c.times.idle + c.times.irq;
  }
  return { idle, total };
}

function sampleCpuPct(windowMs = 1000): Promise<number> {
  const before = snapshotCpu();
  return new Promise((resolve) => {
    setTimeout(() => {
      const after = snapshotCpu();
      const idleDelta = after.idle - before.idle;
      const totalDelta = after.total - before.total;
      resolve(totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0);
    }, windowMs);
  });
}

function probeTcpOnce(timeoutMs: number): Promise<number | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = connect(PREFLIGHT_TCP_PORT, PREFLIGHT_TCP_HOST);
    const done = (latency: number | null) => {
      socket.destroy();
      resolve(latency);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(Date.now() - start));
    socket.once('timeout', () => done(null));
    socket.once('error', () => done(null));
  });
}

/** Impure live sampling: CPU + TCP + disk. No secrets touched, nothing logged but timings. */
export async function sampleEnvironment(): Promise<PreflightSample> {
  const [cpuPct, tcpLatencies, freeDiskGb] = await Promise.all([
    sampleCpuPct(),
    (async () => {
      const latencies: number[] = [];
      for (let i = 0; i < PREFLIGHT_TCP_ATTEMPTS; i += 1) {
        const latency = await probeTcpOnce(PREFLIGHT_TCP_TIMEOUT_MS);
        if (latency !== null) latencies.push(latency);
      }
      return latencies;
    })(),
    (async () => {
      try {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const stats = statfsSync(path.resolve(here, '..'));
        return (Number(stats.bfree) * Number(stats.bsize)) / 1024 ** 3;
      } catch {
        return undefined;
      }
    })(),
  ]);
  return {
    cpuPct,
    tcpAttempts: PREFLIGHT_TCP_ATTEMPTS,
    tcpSuccesses: tcpLatencies.length,
    tcpLatencyMs: tcpLatencies.length > 0 ? tcpLatencies.reduce((a, b) => a + b, 0) / tcpLatencies.length : undefined,
    freeDiskGb,
  };
}

/** Full live run: sample, evaluate, print. PREFLIGHT_FORCE_FAIL=1 forces the abort path (abort-message demo). */
export async function runPreflight(): Promise<PreflightVerdict> {
  if (process.env.PREFLIGHT_FORCE_FAIL === '1') {
    return {
      ok: false,
      reasons: ['PREFLIGHT_FORCE_FAIL=1 — forced abort demonstration (not a real machine reading)'],
    };
  }
  const sample = await sampleEnvironment();
  const verdict = evaluatePreflight(sample);
  const latency = sample.tcpLatencyMs === undefined ? 'n/a' : `${Math.round(sample.tcpLatencyMs)}ms`;
  const disk = sample.freeDiskGb === undefined ? 'n/a' : `${sample.freeDiskGb.toFixed(1)}GB`;
  // eslint-disable-next-line no-console
  console.log(
    `preflight: cpu=${sample.cpuPct?.toFixed(1) ?? 'n/a'}% tcp=${sample.tcpSuccesses ?? 'n/a'}/${sample.tcpAttempts ?? 'n/a'} latency=${latency} disk=${disk} => ${verdict.ok ? 'FIT' : 'UNFIT'}`,
  );
  for (const reason of verdict.reasons) {
    // eslint-disable-next-line no-console
    console.log(`preflight: ${reason}`);
  }
  return verdict;
}

const invokedAsScript = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedAsScript) {
  runPreflight().then((verdict) => {
    if (!verdict.ok) {
      // eslint-disable-next-line no-console
      console.log('E2E PREFLIGHT ABORT: machine unfit for live E2E — close load, retry later, do not trust a red run from this state.');
      process.exit(1);
    }
  });
}
