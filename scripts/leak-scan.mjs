// Submission-day key-leak scan: fails if the AssemblyAI key NAME appears in
// the built client bundle (it must only ever live server-side in .env).
// Portable (node only, no deps). Run via `npm run scan:leak`.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join(process.cwd(), 'web', 'dist');
const NEEDLE = 'ASSEMBLYAI_API_KEY';

if (!existsSync(DIST)) {
  console.error(`scan:leak: ${DIST} missing — run npm run build --workspaces first`);
  process.exit(1);
}

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(js|css|html|map)$/.test(name)) {
      const text = readFileSync(p, 'utf8');
      if (text.includes(NEEDLE)) hits.push(p);
    }
  }
}
walk(DIST);

if (hits.length > 0) {
  console.error(`scan:leak: FAIL — ${NEEDLE} found in ${hits.length} bundle file(s):`);
  for (const h of hits) console.error(`  ${h}`);
  process.exit(1);
}
console.log('scan:leak: PASS — no key material in web/dist');
