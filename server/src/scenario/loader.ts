import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScenarioDefinition } from './types.js';

const here = dirname(fileURLToPath(import.meta.url));

function loadScenarioFile(absPath: string): ScenarioDefinition {
  const raw = readFileSync(absPath, 'utf-8');
  return JSON.parse(raw) as ScenarioDefinition;
}

export function loadScenarios(): Map<string, ScenarioDefinition> {
  // dist layout: dist/scenario/loader.js -> repo: scenarios/*.json (../../scenarios)
  // src layout (tests): server/src/scenario/loader.ts -> ../../scenarios
  const candidates = [
    join(here, '..', '..', 'scenarios', 'warehouse-chemical-spill.json'),
    join(here, '..', '..', '..', 'scenarios', 'warehouse-chemical-spill.json'),
  ];
  const map = new Map<string, ScenarioDefinition>();
  for (const p of candidates) {
    try {
      const def = loadScenarioFile(p);
      map.set(def.metadata.id, def);
      return map;
    } catch {
      // try next candidate
    }
  }
  throw new Error('No scenario definitions found (looked for scenarios/warehouse-chemical-spill.json)');
}
