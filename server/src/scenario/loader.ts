import { readdirSync, readFileSync } from 'node:fs';
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
  // Loads every scenarios/*.json by id (additive: Warehouse + Forklift, no hardcoded file).
  const dirCandidates = [
    join(here, '..', '..', 'scenarios'),
    join(here, '..', '..', '..', 'scenarios'),
  ];
  const map = new Map<string, ScenarioDefinition>();
  for (const dir of dirCandidates) {
    try {
      const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
      for (const f of files) {
        try {
          const def = loadScenarioFile(join(dir, f));
          if (def?.metadata?.id) map.set(def.metadata.id, def);
        } catch {
          // skip unreadable file, try next
        }
      }
      if (map.size > 0) return map;
    } catch {
      // try next candidate dir
    }
  }
  throw new Error('No scenario definitions found (looked for scenarios/*.json)');
}
