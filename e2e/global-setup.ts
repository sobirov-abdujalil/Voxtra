/**
 * Playwright global setup: abort the live E2E legibly on an unfit machine.
 *
 * Without this gate, a loaded machine (Task 13: ~50% CPU with background
 * load, socket-resource exhaustion on ICMP, 2-3x wall-clock inflation)
 * produces turn-skip/reorder signatures that look like product failures.
 * With it, the run fails fast with E2E PREFLIGHT ABORT instead of a false red.
 *
 * No-op when ASSEMBLYAI_API_KEY is absent so keyless CI stays green (specs skip).
 */
import { runPreflight } from './preflight';

export default async function globalSetup(): Promise<void> {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    // eslint-disable-next-line no-console
    console.log('preflight: skipped (no ASSEMBLYAI_API_KEY; specs will skip)');
    return;
  }
  const verdict = await runPreflight();
  if (!verdict.ok) {
    throw new Error(`E2E PREFLIGHT ABORT: machine unfit for live E2E (${verdict.reasons.join('; ')})`);
  }
}
