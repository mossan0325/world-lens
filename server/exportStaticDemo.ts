// GitHub Pages の静的デモ用に、現在のSQLiteの内容を /api/research/latest 相当のJSONへ書き出す。
// 使い方: npm run export:demo  →  public/demo/latest.json が更新される(コミットしてpushするとPagesに反映)。
import fs from 'node:fs';
import path from 'node:path';
import type { LatestResponse } from '../shared/types';
import { openWorldLensDatabase } from './database';
import { WorldLensRepository } from './repository';

const db = openWorldLensDatabase();
const repository = new WorldLensRepository(db);

const run = repository.latestRun();
const updates = repository.latestUpdatesPerCountry();

const payload: LatestResponse = {
  apiKeyConfigured: false,
  researchRunning: false,
  autoResearchTime: null,
  countries: repository.listCountries(),
  run,
  updates,
  synthesis: run ? repository.getSynthesis(run.id) : null,
  coverage: run ? repository.runCoverage(run.id) : [],
  snapshot_generated_at: new Date().toISOString(),
};

const outPath = path.resolve(process.cwd(), 'public', 'demo', 'latest.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(payload, null, 1), 'utf8');

const sizeKb = Math.round(fs.statSync(outPath).size / 1024);
console.log(`Exported static demo snapshot: ${updates.length} topics, run ${run?.id ?? '(none)'}, ${sizeKb} KB`);
console.log(`-> ${outPath}`);

db.close();
