import cors from 'cors';
import express from 'express';
import type { ApiError, LatestResponse, ResearchRunRequest } from '../shared/types';
import { config, hasOpenAiKey } from './config';
import { openWorldLensDatabase } from './database';
import { WorldLensRepository } from './repository';
import {
  createJobProgress,
  executeResearchRun,
  normalizeTopics,
  type ResearchJobProgress,
} from './researchJob';
import { scheduleDailyTask } from './scheduler';

const app = express();
const db = openWorldLensDatabase();
const repository = new WorldLensRepository(db);
const jobs = new Map<string, ResearchJobProgress>();
let activeRunId: string | null = null;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// CLI(別プロセス)からの実行中ランも考慮する。古い 'running' はクラッシュ残骸とみなして無視。
function isResearchActive(): boolean {
  if (activeRunId !== null) {
    return true;
  }
  const latest = repository.latestRun();
  if (!latest || latest.status !== 'running') {
    return false;
  }
  const startedAt = Date.parse(latest.started_at);
  return Number.isFinite(startedAt) && Date.now() - startedAt < 30 * 60 * 1000;
}

function startRun(countryCodes: string[] | undefined, topics: string[] | undefined): string {
  const normalizedTopics = normalizeTopics(topics);
  const countries = repository.listCountriesByCode(countryCodes ?? [], config.countryLimit);
  if (countries.length === 0) {
    throw new Error('No target countries were selected.');
  }

  const run = repository.createRun(config.openaiModel, normalizedTopics, countries.length);
  repository.initializeRunCountries(run.id, countries);
  const progress = createJobProgress();
  jobs.set(run.id, progress);
  activeRunId = run.id;

  void executeResearchRun({
    repository,
    runId: run.id,
    countries,
    topics: normalizedTopics,
    concurrency: config.researchConcurrency,
    progress,
  })
    .catch((error: unknown) => {
      console.error(`Research run ${run.id} crashed:`, error);
      repository.markRun(run.id, 'failed', error instanceof Error ? error.message : String(error));
    })
    .finally(() => {
      if (activeRunId === run.id) {
        activeRunId = null;
      }
    });

  return run.id;
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, apiKeyConfigured: hasOpenAiKey(), model: config.openaiModel });
});

app.get('/api/countries', (_request, response) => {
  response.json(repository.listCountries());
});

app.get('/api/research/latest', (_request, response) => {
  const run = repository.latestRun();
  const payload: LatestResponse = {
    apiKeyConfigured: hasOpenAiKey(),
    researchRunning: isResearchActive(),
    autoResearchTime: config.researchAutoTime,
    countries: repository.listCountries(),
    run,
    updates: repository.latestUpdatesPerCountry(),
    synthesis: run ? repository.getSynthesis(run.id) : null,
    coverage: run ? repository.runCoverage(run.id) : [],
  };
  response.json(payload);
});

app.get('/api/research/runs/:id', (request, response) => {
  const progress = jobs.get(request.params.id);
  const status = repository.runStatus(
    request.params.id,
    progress ? Array.from(progress.currentCountries) : [],
    progress?.failedCount ?? 0,
  );
  if (!status) {
    response.status(404).json({ error: 'Run not found.' } satisfies ApiError);
    return;
  }
  response.json(status);
});

app.post('/api/research/run', (request, response) => {
  if (!hasOpenAiKey()) {
    response.status(400).json({ error: 'OPENAI_API_KEY is not configured. Add it to .env and restart the server.' } satisfies ApiError);
    return;
  }
  if (isResearchActive()) {
    response.status(409).json({ error: 'リサーチが既に実行中です。完了までお待ちください。' } satisfies ApiError);
    return;
  }

  const body = request.body as ResearchRunRequest;
  try {
    const runId = startRun(body.countryCodes, body.topics);
    response.status(202).json({ runId });
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) } satisfies ApiError);
  }
});

app.listen(config.port, () => {
  console.log(`World Lens API listening on http://127.0.0.1:${config.port}`);

  if (config.researchAutoTime && hasOpenAiKey()) {
    scheduleDailyTask(config.researchAutoTime, () => {
      if (isResearchActive()) {
        console.log('Scheduled research skipped: a run is already in progress.');
        return;
      }
      console.log('Starting scheduled daily research run.');
      try {
        startRun(undefined, undefined);
      } catch (error) {
        console.error('Scheduled research failed to start:', error);
      }
    });
    console.log(`Daily research scheduled at ${config.researchAutoTime} (local time).`);
  } else if (config.researchAutoTime) {
    console.log('RESEARCH_AUTO_TIME is set but OPENAI_API_KEY is missing; scheduled research is disabled.');
  }
});
