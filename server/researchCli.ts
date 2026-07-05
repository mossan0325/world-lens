// 定期実行(OSスケジューラ/cron)や手動一括実行用のCLI。
// 使い方: npm run research [-- --countries=JP,DE --topics=経済,政治・規制]
import { config, hasOpenAiKey } from './config';
import { openWorldLensDatabase } from './database';
import { WorldLensRepository } from './repository';
import { createJobProgress, executeResearchRun, normalizeTopics } from './researchJob';

function parseListArg(name: string): string[] | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  if (!arg) {
    return undefined;
  }
  const values = arg
    .slice(prefix.length)
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  return values.length > 0 ? values : undefined;
}

async function main(): Promise<number> {
  if (!hasOpenAiKey()) {
    console.error('OPENAI_API_KEY is not configured. Add it to .env before running research.');
    return 1;
  }

  const db = openWorldLensDatabase();
  const repository = new WorldLensRepository(db);

  const latest = repository.latestRun();
  if (latest?.status === 'running') {
    const startedAt = Date.parse(latest.started_at);
    if (Number.isFinite(startedAt) && Date.now() - startedAt < 30 * 60 * 1000) {
      console.error(`Another research run (${latest.id}) is already in progress. Aborting.`);
      db.close();
      return 1;
    }
  }

  const topics = normalizeTopics(parseListArg('topics'));
  const countries = repository.listCountriesByCode(parseListArg('countries') ?? [], config.countryLimit);
  if (countries.length === 0) {
    console.error('No target countries were selected.');
    db.close();
    return 1;
  }

  console.log(`Starting research run: ${countries.length} countries, topics = ${topics.join(', ')}`);
  console.log(`Model: ${config.openaiModel}, concurrency: ${config.researchConcurrency}`);

  const run = repository.createRun(config.openaiModel, topics, countries.length);
  repository.initializeRunCountries(run.id, countries);

  const result = await executeResearchRun({
    repository,
    runId: run.id,
    countries,
    topics,
    concurrency: config.researchConcurrency,
    progress: createJobProgress(),
  });

  console.log(`Run ${run.id} finished with status "${result.status}" (${result.topicCount} topics).`);
  if (result.failures.length > 0) {
    console.log('Failures:');
    for (const failure of result.failures) {
      console.log(`  - ${failure}`);
    }
  }

  db.close();
  return result.status === 'failed' ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error('Research CLI crashed:', error);
    process.exitCode = 1;
  });
