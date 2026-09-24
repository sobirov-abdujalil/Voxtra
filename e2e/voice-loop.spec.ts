/**
 * Live voice-loop E2E (Chromium + fake media + REAL AssemblyAI).
 *
 * Drives the full golden-path drill with synthetic mic audio:
 *   isolate_area -> notify_supervisor -> inspect_label -> document_incident -> clean_spill
 * and asserts transcript, intent, state transitions, evidence records,
 * the after-action report view, no console/page errors, and no
 * permanent-key leakage.
 *
 * Run headless:   npx playwright test -c e2e/playwright.config.ts
 * Debug headed:    npx playwright test -c e2e/playwright.config.ts --headed
 * Requires C:\Voxtra\.env with ASSEMBLYAI_API_KEY (skipped when absent so
 * CI without a key stays green; the pre-demo command runs it for real).
 */
import { expect, test } from '@playwright/test';

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

test('golden-path voice drill completes with correct state and evidence', async ({ page }) => {
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

  // Deployed-origin guards: HTTPS secure context, /healthz shape, and the
  // same-origin token endpoint returning temporary material (never the key).
  if (process.env.BASE_URL) {
    expect(BASE_URL.startsWith('https://'), `deployed BASE_URL must be HTTPS (got ${BASE_URL})`).toBe(true);
    const health = await fetch(`${API}/healthz`);
    expect(health.ok).toBe(true);
    const healthBody = (await health.json()) as { status?: string; commit?: string };
    expect(healthBody.status).toBe('ok');
    expect(typeof healthBody.commit).toBe('string');
    const tokenProbe = await fetch(`${API}/api/voice/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(tokenProbe.ok).toBe(true);
    const tokenBody = (await tokenProbe.json()) as { data?: { token?: string } };
    expect(typeof tokenBody.data?.token).toBe('string');
    expect(JSON.stringify(tokenBody)).not.toContain(PERM_KEY);
  }

  await page.goto('/', { timeout: 60_000 });
  // Selection screen (M3 + M4): the product explains itself; all three scenarios actionable.
  await expect(page.locator('#selection-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#product-tagline')).toContainText('Speak your decisions');
  await expect(page.locator('#scenario-cards .scenario-card')).toHaveCount(3);
  await expect(page.locator('#select-start-warehouse')).toBeEnabled();
  await expect(page.locator('#select-forklift')).toBeEnabled();
  await expect(page.locator('#select-equipment')).toBeEnabled();
  await expect(page.locator('#how-it-works li')).toHaveCount(4);
  await expect(page.locator('#mic-guidance')).toContainText('Chromium');
  await page.click('#select-start-warehouse');
  await expect(page.locator('#drill-view')).toBeVisible({ timeout: 15_000 });
  await page.click('#start-session');
  await expect(page.locator('#start-voice')).toBeEnabled({ timeout: 15_000 });
  const statusText = await page.locator('#status').innerText();
  const sessionId = (/Session live:\s*(\S+)/.exec(statusText) ?? [])[1];
  expect(sessionId, `session id in status (${statusText})`).toBeTruthy();

  await page.click('#start-voice');
  // session.ready flips mic-state to live (bounded: token + WS handshake + ready).
  await expect(page.locator('#mic-state')).toHaveText('live', { timeout: 45_000 });
  // Drill polish: human scenario label, progress, and the barge-in cue render.
  await expect(page.locator('#scenario-label')).toContainText('Unidentified spill', { timeout: 15_000 });
  await expect(page.locator('#progress-indicator')).toContainText('required actions completed');
  await expect(page.locator('#barge-cue')).toBeVisible();

  // Poll the server report until all five turns land (bounded 240s).
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

  // Golden path: isolate(10) + notify(10) + inspect(8) + document(10) + clean(20) = 58, resolved.
  console.log(
    `e2e drill summary: turns=${evidence.length} completed=${completed} score=${score}/${denominator} ` +
      JSON.stringify(
        evidence.map((e) => ({ t: e.turn, intent: e.intent, from: e.from, to: e.to, d: e.scoreDelta, u: (e.userTranscript ?? '').slice(0, 60) })),
      ),
  );
  // Settle: an agent that fires extra autonomous tool calls after completion
  // would append evidence here. Re-fetch to catch stragglers.
  if (completed) {
    await new Promise((r) => setTimeout(r, 12_000));
    const res = await fetch(`${API}/api/sessions/${sessionId}/report`);
    if (res.ok) {
      const body = (await res.json()) as { data?: { evidence?: Evidence[] } };
      evidence = body.data?.evidence ?? evidence;
    }
  }
  // Exactly the five golden-path turns, all applied — no repeats, no extras.
  expect(evidence.length).toBe(5);
  expect(completed).toBe(true);
  expect(score).toBe(58);
  expect(denominator).toBe(58);
  const intents = evidence.slice(0, 5).map((e) => e.intent);
  expect(intents).toEqual(['isolate_area', 'notify_supervisor', 'inspect_label', 'document_incident', 'clean_spill']);
  expect(evidence.slice(0, 5).map((e) => e.to)).toEqual([
    'area_isolated',
    'coordinated',
    'ready_for_cleanup',
    'documented',
    'resolved',
  ]);
  expect(evidence.slice(0, 5).map((e) => e.scoreDelta)).toEqual([10, 10, 8, 10, 20]);
  for (const [i, e] of evidence.slice(0, 5).entries()) {
    expect(e.turn).toBe(i + 1);
    expect(e.result).toBe('applied');
    expect(typeof e.rule).toBe('string');
    expect(e.rule.length).toBeGreaterThan(0);
    expect(typeof e.timestamp).toBe('string');
    expect(typeof e.userTranscript).toBe('string');
  }
  const transcripts = evidence
    .slice(0, 5)
    .map((e) => (e.userTranscript ?? '').toLowerCase());
  expect(transcripts[0]).toContain('isolate the area');
  expect(transcripts[1]).toContain('notify the supervisor');
  expect(transcripts[2]).toContain('label');
  expect(transcripts[3]).toContain('document');
  expect(transcripts[4]).toContain('clean');

  // DOM reflects the same final state.
  const finals = await page.locator('#transcript-final li').allInnerTexts();
  expect(finals.length).toBeGreaterThanOrEqual(5);
  const stateText = await page.locator('#state').innerText();
  expect(JSON.parse(stateText) as { current: string }).toMatchObject({ current: 'resolved' });
  const consequence = await page.locator('#consequence').innerText();
  expect(consequence.trim().length).toBeGreaterThan(0);
  // Drill polish: human label, full progress, and the drill-time timeline.
  await expect(page.locator('#scenario-label')).toContainText('Spill safely resolved');
  await expect(page.locator('#progress-indicator')).toContainText('5 of 5 required actions completed');
  await expect(page.locator('#drill-timeline-list .drill-timeline-row')).toHaveCount(5);

  // Drill view hands off with a single primary CTA; no auto-navigation.
  await expect(page.locator('#open-report')).toBeVisible({ timeout: 15_000 });
  await page.click('#open-report');
  await expect(page.locator('#report-view')).toBeVisible({ timeout: 15_000 });

  // Report view: score header with explicit denominator, breakdown, timeline.
  await expect(page.locator('#report-score')).toContainText('58 / 58', { timeout: 15_000 });
  await expect(page.locator('#report-completion')).toContainText('complete');
  const summary = await page.locator('#report-summary').innerText();
  expect(summary).toContain('58/58');
  const completedEntries = await page.locator('#breakdown-completed .breakdown-entry').count();
  expect(completedEntries).toBe(5);
  const timelineRows = await page.locator('#report-timeline .timeline-row').count();
  expect(timelineRows).toBe(5);

  // Decision replay: clicking a breakdown entry highlights the right timeline row.
  await page.locator('#breakdown-completed .breakdown-entry').nth(3).click();
  await expect(page.locator('#report-timeline .timeline-row[data-turn="4"].highlighted')).toBeVisible();
  const highlightedCount = await page.locator('#report-timeline .timeline-row.highlighted').count();
  expect(highlightedCount).toBe(1);

  // Timeline row expands in place to show the full record.
  await page.locator('#report-timeline .timeline-row[data-turn="2"]').click();
  await expect(page.locator('#report-timeline .timeline-row[data-turn="2"] .timeline-detail')).toBeVisible();

  // Clean shutdown exercises session.end before WS close.
  await page.click('#nav-drill');
  await expect(page.locator('#drill-view')).toBeVisible({ timeout: 15_000 });
  await page.click('#stop-voice');
  await expect(page.locator('#mic-state')).toHaveText('stopped', { timeout: 15_000 });

  // No WebSocket/mic/playback errors surfaced; no unhandled page errors.
  expect(pageErrors).toEqual([]);
  const bad = consoleLines.filter((l) =>
    /session error|ws error|connection error|malformed tool call|capture error|microphone denied|voice session unavailable|agent audio (decode|enqueue) failed|tool\.result send failed/i.test(
      l,
    ),
  );
  expect(bad).toEqual([]);

  // The permanent key never appears in browser-visible traffic or DOM.
  for (const url of requestUrls) expect(url).not.toContain(PERM_KEY);
  // Allow the local webServer pipe to echo env names; bodies must not hold the value.
  for (const body of responseBodies) expect(body).not.toContain(PERM_KEY);
  const html = await page.content();
  expect(html).not.toContain(PERM_KEY);
  const globals = await page.evaluate(() => Object.keys(window as unknown as Record<string, unknown>));
  expect(JSON.stringify(globals)).not.toContain('ASSEMBLYAI_API_KEY');
});
