/**
 * Equipment Malfunction live voice-loop E2E (Chromium + fake media + REAL AssemblyAI).
 *
 * Drives the equipment golden-path drill with synthetic mic audio:
 *   hit_estop -> isolate_power -> evacuate_area -> verify_technician -> document_incident
 * (15 + 15 + 10 + 10 + 15 = 65, resolved) and asserts transcript, intent, state
 * transitions, evidence records, the after-action report view, no console/page
 * errors, and no permanent-key leakage.
 *
 * Audio: e2e/fixtures/audio/equipment/equipment-drill.wav via per-file
 * launchOptions override (the shared config defaults to the Warehouse track).
 *
 * Run headless:   npx playwright test -c e2e/playwright.config.ts
 * Requires C:\Voxtra\.env with ASSEMBLYAI_API_KEY (skipped when absent so
 * CI without a key stays green; the pre-demo command runs it for real).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const here = path.dirname(fileURLToPath(import.meta.url));
const equipmentWav = path.resolve(here, 'fixtures/audio/equipment/equipment-drill.wav');

test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-audio-capture=${equipmentWav}`,
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
});

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
// Single-origin deploys serve API + web from BASE_URL; local dev keeps the
// split (web :5173, api :3001). API_URL overrides both when set.
const API =
  process.env.API_URL ?? (BASE_URL.includes(':5173') ? 'http://localhost:3001' : BASE_URL.replace(/\/$/, ''));
const PERM_KEY = process.env.ASSEMBLYAI_API_KEY ?? '';

test.skip(!PERM_KEY, 'needs ASSEMBLYAI_API_KEY in environment (see C:\\Voxtra\\.env)');

interface Evidence {
  turn: number;
  userTranscript?: string;
  intent: string;
  from: string;
  to: string;
  rule: string;
  result: string;
  scoreDelta: number;
  timestamp: string;
}

test('equipment golden-path voice drill completes with correct state and evidence', async ({ page }) => {
  test.setTimeout(300_000);
  const consoleLines: string[] = [];
  const pageErrors: string[] = [];
  const requestUrls: string[] = [];
  const responseBodies: string[] = [];

  page.on('console', (msg) => {
    consoleLines.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err?.message ?? err));
  });
  page.on('request', (req) => {
    requestUrls.push(req.url());
  });
  page.on('response', (res) => {
    void (async () => {
      try {
        const url = res.url();
        const isLocal = url.startsWith('http://localhost:');
        const isDeployedOrigin = Boolean(process.env.BASE_URL) && url.startsWith(BASE_URL);
        if (!isLocal && !isDeployedOrigin) return;
        const buf = await res.body().catch(() => null);
        if (buf && buf.length < 2_000_000) responseBodies.push(buf.toString('utf8'));
      } catch {
        // ignore body-read races on teardown
      }
    })();
  });

  await page.goto('/', { timeout: 60_000 });
  // Selection screen: all three scenarios actionable (M4 complete).
  await expect(page.locator('#selection-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#scenario-cards .scenario-card')).toHaveCount(3);
  await expect(page.locator('#select-start-warehouse')).toBeEnabled();
  await expect(page.locator('#select-forklift')).toBeEnabled();
  await expect(page.locator('#select-equipment')).toBeEnabled();
  await page.click('#select-equipment');
  await expect(page.locator('#drill-view')).toBeVisible({ timeout: 15_000 });
  await page.click('#start-session');
  await expect(page.locator('#start-voice')).toBeEnabled({ timeout: 15_000 });
  const statusText = await page.locator('#status').innerText();
  const sessionId = (/Session live:\s*(\S+)/.exec(statusText) ?? [])[1];
  expect(sessionId, `session id in status (${statusText})`).toBeTruthy();

  await page.click('#start-voice');
  await expect(page.locator('#mic-state')).toHaveText('live', { timeout: 45_000 });
  await expect(page.locator('#scenario-label')).toContainText('Cell re-energized', { timeout: 15_000 });
  await expect(page.locator('#progress-indicator')).toContainText('required actions completed');
  await expect(page.locator('#barge-cue')).toBeVisible();

  let evidence: Evidence[] = [];
  let completed = false;
  let score = 0;
  let denominator = 0;
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${API}/api/sessions/${sessionId}/report`);
    if (res.ok) {
      const body = (await res.json()) as {
        data?: { evidence?: Evidence[]; completed?: boolean; score?: number; denominator?: number };
      };
      evidence = body.data?.evidence ?? [];
      completed = body.data?.completed ?? false;
      score = body.data?.score ?? 0;
      denominator = body.data?.denominator ?? 0;
      if (evidence.length >= 5 && completed) break;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  console.log(
    `equipment e2e drill summary: turns=${evidence.length} completed=${completed} score=${score}/${denominator} ` +
      JSON.stringify(
        evidence.map((e) => ({ t: e.turn, intent: e.intent, from: e.from, to: e.to, d: e.scoreDelta, u: (e.userTranscript ?? '').slice(0, 60) })),
      ),
  );
  if (completed) {
    await new Promise((r) => setTimeout(r, 12_000));
    const res = await fetch(`${API}/api/sessions/${sessionId}/report`);
    if (res.ok) {
      const body = (await res.json()) as { data?: { evidence?: Evidence[] } };
      evidence = body.data?.evidence ?? evidence;
    }
  }
  // Golden path: estop(15) + isolate(15) + evacuate(10) + verify(10) + document(15) = 65, resolved.
  expect(evidence.length).toBe(5);
  expect(completed).toBe(true);
  expect(score).toBe(65);
  expect(denominator).toBe(65);
  const intents = evidence.slice(0, 5).map((e) => e.intent);
  expect(intents).toEqual(['hit_estop', 'isolate_power', 'evacuate_area', 'verify_technician', 'document_incident']);
  expect(evidence.slice(0, 5).map((e) => e.to)).toEqual([
    'estopped',
    'isolated',
    'evacuated',
    'verified',
    'resolved',
  ]);
  expect(evidence.slice(0, 5).map((e) => e.scoreDelta)).toEqual([15, 15, 10, 10, 15]);
  for (const [i, e] of evidence.slice(0, 5).entries()) {
    expect(e.turn).toBe(i + 1);
    expect(e.result).toBe('applied');
    expect(typeof e.rule).toBe('string');
    expect(e.rule.length).toBeGreaterThan(0);
    expect(typeof e.timestamp).toBe('string');
    expect(typeof e.userTranscript).toBe('string');
  }
  const transcripts = evidence.slice(0, 5).map((e) => (e.userTranscript ?? '').toLowerCase());
  expect(transcripts[0]).toMatch(/emergency stop/);
  expect(transcripts[1]).toMatch(/locking out|disconnect/);
  expect(transcripts[2]).toMatch(/everyone out|out of the cell/);
  expect(transcripts[3]).toMatch(/checking on the technician|he's clear|he is clear/);
  expect(transcripts[4]).toMatch(/incident report|filing/);

  const finals = await page.locator('#transcript-final li').allInnerTexts();
  expect(finals.length).toBeGreaterThanOrEqual(5);
  const stateText = await page.locator('#state').innerText();
  expect(JSON.parse(stateText) as { current: string }).toMatchObject({ current: 'resolved' });
  const consequence = await page.locator('#consequence').innerText();
  expect(consequence.trim().length).toBeGreaterThan(0);
  await expect(page.locator('#scenario-label')).toContainText('Incident resolved');
  await expect(page.locator('#progress-indicator')).toContainText('5 of 5 required actions completed');
  await expect(page.locator('#drill-timeline-list .drill-timeline-row')).toHaveCount(5);

  await expect(page.locator('#open-report')).toBeVisible({ timeout: 15_000 });
  await page.click('#open-report');
  await expect(page.locator('#report-view')).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('#report-score')).toContainText('65 / 65', { timeout: 15_000 });
  // Option-A headline: a clean golden path carries no bonus line.
  await expect(page.locator('#report-bonus')).toHaveCount(0);
  await expect(page.locator('#report-completion')).toContainText('complete');
  const summary = await page.locator('#report-summary').innerText();
  expect(summary).toContain('65/65');
  const completedEntries = await page.locator('#breakdown-completed .breakdown-entry').count();
  expect(completedEntries).toBe(5);
  const timelineRows = await page.locator('#report-timeline .timeline-row').count();
  expect(timelineRows).toBe(5);

  // Report endpoint breakdown for the equipment session: five completed, zero missed/invalid.
  const reportRes = await fetch(`${API}/api/sessions/${sessionId}/report`);
  expect(reportRes.ok).toBe(true);
  const reportBody = (await reportRes.json()) as {
    data?: { breakdown?: { completed?: unknown[]; missed?: unknown[]; invalid?: unknown[] }; score?: number };
  };
  expect(reportBody.data?.breakdown?.completed).toHaveLength(5);
  expect(reportBody.data?.breakdown?.missed).toHaveLength(0);
  expect(reportBody.data?.breakdown?.invalid).toHaveLength(0);
  expect(reportBody.data?.score).toBe(65);

  await page.locator('#breakdown-completed .breakdown-entry').nth(3).click();
  await expect(page.locator('#report-timeline .timeline-row[data-turn="4"].highlighted')).toBeVisible();
  const highlightedCount = await page.locator('#report-timeline .timeline-row.highlighted').count();
  expect(highlightedCount).toBe(1);

  await page.locator('#report-timeline .timeline-row[data-turn="2"]').click();
  await expect(page.locator('#report-timeline .timeline-row[data-turn="2"] .timeline-detail')).toBeVisible();

  await page.click('#nav-drill');
  await expect(page.locator('#drill-view')).toBeVisible({ timeout: 15_000 });
  await page.click('#stop-voice');
  await expect(page.locator('#mic-state')).toHaveText('stopped', { timeout: 15_000 });

  expect(pageErrors).toEqual([]);
  const bad = consoleLines.filter((l) =>
    /session error|ws error|connection error|malformed tool call|capture error|microphone denied|voice session unavailable|agent audio (decode|enqueue) failed|tool\.result send failed/i.test(
      l,
    ),
  );
  expect(bad).toEqual([]);

  for (const url of requestUrls) expect(url).not.toContain(PERM_KEY);
  for (const body of responseBodies) expect(body).not.toContain(PERM_KEY);
  const html = await page.content();
  expect(html).not.toContain(PERM_KEY);
  const globals = await page.evaluate(() => Object.keys(window as unknown as Record<string, unknown>));
  expect(JSON.stringify(globals)).not.toContain('ASSEMBLYAI_API_KEY');
});

test('equipment invalid path: enter_cell penalizes without transition, then recovery', async ({ request }) => {
  // Deterministic API-driven invalid path (no audio flakiness): proves the
  // engine detects the invalid action in the third scenario, not just the first two.
  const created = await request.post(`${API}/api/sessions`, { data: { scenarioId: 'equipment-malfunction' } });
  expect(created.ok()).toBe(true);
  const createdBody = (await created.json()) as { data?: { sessionId?: string } };
  const sessionId = createdBody.data?.sessionId;
  expect(sessionId).toBeTruthy();

  const bad = await request.post(`${API}/api/sessions/${sessionId}/turn`, {
    data: { intent: 'enter_cell', userTranscript: 'I will go in and check the arm' },
  });
  expect(bad.ok()).toBe(true);
  const badBody = (await bad.json()) as { data?: { state?: { current?: string; score?: number }; scoreDelta?: number } };
  expect(badBody.data?.state?.current).toBe('initial');
  expect(badBody.data?.scoreDelta).toBe(-15);

  const rec = await request.post(`${API}/api/sessions/${sessionId}/turn`, { data: { intent: 'reassess' } });
  expect(rec.ok()).toBe(true);
  const recBody = (await rec.json()) as { data?: { scoreDelta?: number } };
  expect(recBody.data?.scoreDelta).toBeGreaterThan(0);

  const report = await request.get(`${API}/api/sessions/${sessionId}/report`);
  expect(report.ok()).toBe(true);
  const reportBody = (await report.json()) as {
    data?: {
      breakdown?: {
        penalties?: Array<{ turn?: number; intent?: string }>;
        recovery?: Array<{ turn?: number; intent?: string }>;
      };
      evidence?: Array<{ turn?: number; intent?: string; from?: string; to?: string; scoreDelta?: number }>;
    };
  };
  expect(reportBody.data?.breakdown?.penalties?.[0]).toMatchObject({ turn: 1, intent: 'enter_cell' });
  expect(reportBody.data?.breakdown?.recovery?.map((r) => r.turn)).toContain(2);
  const first = reportBody.data?.evidence?.[0];
  expect(first?.from).toBe('initial');
  expect(first?.to).toBe('initial');
  expect(first?.scoreDelta).toBe(-15);
});
