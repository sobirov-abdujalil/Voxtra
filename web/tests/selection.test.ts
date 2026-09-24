import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function selectionDocument(): Document {
  const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('selection screen', () => {
  it('explains the product in one line', () => {
    const doc = selectionDocument();
    expect(doc.querySelector('h1')?.textContent).toContain('VoxDrill');
    const tagline = doc.querySelector('#product-tagline')?.textContent ?? '';
    expect(tagline).toContain('Speak your decisions');
    expect(tagline).toContain('after-action report');
  });

  it('shows three scenario cards with all three actionable (M4 complete)', () => {
    const doc = selectionDocument();
    const cards = doc.querySelectorAll('#scenario-cards .scenario-card');
    expect(cards.length).toBe(3);

    const start = doc.querySelector<HTMLButtonElement>('#select-start-warehouse');
    expect(start).not.toBeNull();
    expect(start?.disabled).toBe(false);
    expect(start?.textContent).toContain('Start drill');

    const forklift = doc.querySelector<HTMLButtonElement>('#select-forklift');
    expect(forklift).not.toBeNull();
    expect(forklift?.disabled).toBe(false);
    expect(forklift?.textContent).toContain('Start drill');

    const equipment = doc.querySelector<HTMLButtonElement>('#select-equipment');
    expect(equipment).not.toBeNull();
    expect(equipment?.disabled).toBe(false);
    expect(equipment?.textContent).toContain('Start drill');
    const badges = doc.querySelectorAll('.scenario-card.disabled .coming-soon');
    expect(badges.length).toBe(0);
  });

  it('renders the real how-it-works steps', () => {
    const doc = selectionDocument();
    const steps = [...doc.querySelectorAll('#how-it-works li')].map((li) => li.textContent ?? '');
    expect(steps.length).toBe(4);
    expect(steps[0]).toContain('Speak');
    expect(steps[1]).toContain('Scenario reacts');
    expect(steps[2]).toContain('Evidence recorded');
    expect(steps[3]).toContain('After-action report');
  });

  it('gives microphone guidance', () => {
    const doc = selectionDocument();
    const guidance = doc.querySelector('#mic-guidance')?.textContent ?? '';
    expect(guidance.toLowerCase()).toContain('microphone');
    expect(guidance).toContain('Chromium');
  });
});
