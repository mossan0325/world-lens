import { randomUUID } from 'node:crypto';
import type {
  ChangeStatus,
  Country,
  CountryUpdate,
  RarityTier,
  ResearchRun,
  RunCountryCoverage,
  RunStatus,
  RunSynthesis,
  Source,
  SynthesisTheme,
} from '../shared/types';
import type { WorldLensDatabase } from './database';

type CountryRow = Country;

type RunRow = {
  id: string;
  status: string;
  model: string;
  topics_json: string;
  country_count: number;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

type UpdateRow = {
  id: number;
  run_id: string;
  country_code: string;
  topic_rank: number;
  country_name_ja: string;
  country_name_en: string;
  region: string;
  lat: number;
  lng: number;
  rarity_tier: RarityTier;
  category: string;
  importance_score: number;
  headline_ja: string;
  summary_ja: string;
  why_it_matters_ja: string;
  local_context_ja: string;
  confidence: number;
  created_at: string;
};

type SynthesisRow = {
  run_id: string;
  digest_ja: string;
  themes_json: string;
  created_at: string;
};

type SourceRow = Required<Pick<Source, 'id' | 'update_id' | 'title' | 'url' | 'domain'>> & {
  language: string | null;
  published_at: string | null;
  citation_index: number | null;
};

export type ResearchPayload = {
  topic_rank: number;
  category: string;
  importance_score: number;
  headline_ja: string;
  summary_ja: string;
  why_it_matters_ja: string;
  local_context_ja: string;
  confidence: number;
  raw_json: string;
  sources: Omit<Source, 'id' | 'update_id' | 'domain'>[];
};

export class WorldLensRepository {
  private db: WorldLensDatabase;

  constructor(db: WorldLensDatabase) {
    this.db = db;
  }

  listCountries(): Country[] {
    return this.db
      .prepare('SELECT code, name_ja, name_en, region, lat, lng, rarity_tier FROM countries ORDER BY region, name_en')
      .all() as CountryRow[];
  }

  listCountriesByCode(countryCodes: string[], limit: number): Country[] {
    const requested = new Set(countryCodes.map((code) => code.toUpperCase()));
    return this.listCountries()
      .filter((country) => requested.size === 0 || requested.has(country.code))
      .slice(0, limit);
  }

  createRun(model: string, topics: string[], countryCount: number): ResearchRun {
    const run: ResearchRun = {
      id: `run_${randomUUID()}`,
      status: 'running',
      model,
      topics,
      country_count: countryCount,
      started_at: new Date().toISOString(),
      finished_at: null,
      error: null,
    };

    this.db
      .prepare(`
        INSERT INTO research_runs (id, status, model, topics_json, country_count, started_at, finished_at, error)
        VALUES (@id, @status, @model, @topics_json, @country_count, @started_at, @finished_at, @error)
      `)
      .run({ ...run, topics_json: JSON.stringify(topics) });

    return run;
  }

  initializeRunCountries(runId: string, countries: Country[]): void {
    const insert = this.db.prepare(`
      INSERT OR IGNORE INTO research_run_countries (run_id, country_code, status, started_at, finished_at, error)
      VALUES (@run_id, @country_code, 'queued', NULL, NULL, NULL)
    `);
    const transaction = this.db.transaction(() => {
      for (const country of countries) {
        insert.run({ run_id: runId, country_code: country.code });
      }
    });
    transaction();
  }

  markRunCountry(runId: string, countryCode: string, status: string, error: string | null = null): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`
        INSERT INTO research_run_countries (run_id, country_code, status, started_at, finished_at, error)
        VALUES (@run_id, @country_code, @status, @started_at, @finished_at, @error)
        ON CONFLICT(run_id, country_code) DO UPDATE SET
          status = excluded.status,
          started_at = COALESCE(research_run_countries.started_at, excluded.started_at),
          finished_at = excluded.finished_at,
          error = excluded.error
      `)
      .run({
        run_id: runId,
        country_code: countryCode,
        status,
        started_at: now,
        finished_at: status === 'running' || status === 'queued' ? null : now,
        error,
      });
  }

  markRun(id: string, status: string, error: string | null = null): void {
    const finishedAt = status === 'running' ? null : new Date().toISOString();
    this.db
      .prepare('UPDATE research_runs SET status = @status, finished_at = @finished_at, error = @error WHERE id = @id')
      .run({ id, status, finished_at: finishedAt, error });
  }

  saveCountryUpdate(runId: string, countryCode: string, payload: ResearchPayload): number {
    const insertUpdate = this.db.prepare(`
      INSERT INTO country_updates (
        run_id, country_code, topic_rank, category, importance_score, headline_ja, summary_ja,
        why_it_matters_ja, local_context_ja, confidence, raw_json, created_at
      )
      VALUES (
        @run_id, @country_code, @topic_rank, @category, @importance_score, @headline_ja, @summary_ja,
        @why_it_matters_ja, @local_context_ja, @confidence, @raw_json, @created_at
      )
    `);
    const insertSource = this.db.prepare(`
      INSERT INTO sources (update_id, title, url, domain, language, published_at, citation_index)
      VALUES (@update_id, @title, @url, @domain, @language, @published_at, @citation_index)
    `);

    const transaction = this.db.transaction(() => {
      const result = insertUpdate.run({
        run_id: runId,
        country_code: countryCode,
        topic_rank: payload.topic_rank,
        category: payload.category,
        importance_score: payload.importance_score,
        headline_ja: payload.headline_ja,
        summary_ja: payload.summary_ja,
        why_it_matters_ja: payload.why_it_matters_ja,
        local_context_ja: payload.local_context_ja,
        confidence: payload.confidence,
        raw_json: payload.raw_json,
        created_at: new Date().toISOString(),
      });
      const updateId = Number(result.lastInsertRowid);

      payload.sources.slice(0, 8).forEach((source, index) => {
        insertSource.run({
          update_id: updateId,
          title: source.title || source.url,
          url: source.url,
          domain: safeDomain(source.url),
          language: source.language ?? null,
          published_at: source.published_at ?? null,
          citation_index: source.citation_index ?? index,
        });
      });

      return updateId;
    });

    return transaction();
  }

  latestRun(): ResearchRun | null {
    const row = this.db
      .prepare('SELECT * FROM research_runs ORDER BY started_at DESC LIMIT 1')
      .get() as RunRow | undefined;
    return row ? normalizeRun(row) : null;
  }

  // 国ごとに「最後に成功したラン」の結果を返す。最新ランが失敗・未調査でも過去の成功データを保持し、
  // 直前の成功ランのカテゴリと比較して新規/継続を判定する。
  latestUpdatesPerCountry(): CountryUpdate[] {
    const rows = this.db
      .prepare(`
        SELECT
          cu.id, cu.run_id, cu.country_code, cu.topic_rank, c.name_ja AS country_name_ja, c.name_en AS country_name_en,
          c.region, c.lat, c.lng, c.rarity_tier, cu.category, cu.importance_score, cu.headline_ja, cu.summary_ja,
          cu.why_it_matters_ja, cu.local_context_ja, cu.confidence, cu.created_at
        FROM country_updates cu
        JOIN countries c ON c.code = cu.country_code
        ORDER BY cu.created_at DESC, cu.id DESC
      `)
      .all() as UpdateRow[];

    if (rows.length === 0) {
      return [];
    }

    const rowsByCountry = new Map<string, UpdateRow[]>();
    for (const row of rows) {
      const current = rowsByCountry.get(row.country_code) ?? [];
      current.push(row);
      rowsByCountry.set(row.country_code, current);
    }

    const selected: (UpdateRow & { change_status: ChangeStatus | null })[] = [];
    for (const countryRows of rowsByCountry.values()) {
      const latestRunId = countryRows[0].run_id;
      const latestRows = countryRows.filter((row) => row.run_id === latestRunId);
      const previousRow = countryRows.find((row) => row.run_id !== latestRunId);
      const previousCategories = previousRow
        ? new Set(countryRows.filter((row) => row.run_id === previousRow.run_id).map((row) => row.category))
        : null;
      for (const row of latestRows) {
        selected.push({
          ...row,
          change_status: previousCategories ? (previousCategories.has(row.category) ? 'continuing' : 'new') : null,
        });
      }
    }

    selected.sort(
      (a, b) => b.importance_score - a.importance_score || a.topic_rank - b.topic_rank || a.country_code.localeCompare(b.country_code),
    );

    const sources = this.db
      .prepare(`SELECT * FROM sources WHERE update_id IN (${selected.map(() => '?').join(',')}) ORDER BY citation_index ASC`)
      .all(...selected.map((update) => update.id)) as SourceRow[];
    const sourcesByUpdate = new Map<number, Source[]>();
    for (const source of sources) {
      const current = sourcesByUpdate.get(source.update_id) ?? [];
      current.push(source);
      sourcesByUpdate.set(source.update_id, current);
    }

    return selected.map((update) => ({
      ...update,
      sources: sourcesByUpdate.get(update.id) ?? [],
    }));
  }

  runCoverage(runId: string): RunCountryCoverage[] {
    return this.db
      .prepare(`
        SELECT country_code, status, error, finished_at
        FROM research_run_countries
        WHERE run_id = @run_id
        ORDER BY country_code
      `)
      .all({ run_id: runId }) as RunCountryCoverage[];
  }

  saveSynthesis(runId: string, digestJa: string, themes: SynthesisTheme[]): void {
    this.db
      .prepare(`
        INSERT INTO run_synthesis (run_id, digest_ja, themes_json, created_at)
        VALUES (@run_id, @digest_ja, @themes_json, @created_at)
        ON CONFLICT(run_id) DO UPDATE SET
          digest_ja = excluded.digest_ja,
          themes_json = excluded.themes_json,
          created_at = excluded.created_at
      `)
      .run({
        run_id: runId,
        digest_ja: digestJa,
        themes_json: JSON.stringify(themes),
        created_at: new Date().toISOString(),
      });
  }

  getSynthesis(runId: string): RunSynthesis | null {
    const row = this.db
      .prepare('SELECT run_id, digest_ja, themes_json, created_at FROM run_synthesis WHERE run_id = @run_id')
      .get({ run_id: runId }) as SynthesisRow | undefined;
    if (!row) {
      return null;
    }
    let themes: SynthesisTheme[] = [];
    try {
      const parsed = JSON.parse(row.themes_json) as unknown;
      if (Array.isArray(parsed)) {
        themes = parsed as SynthesisTheme[];
      }
    } catch {
      themes = [];
    }
    return { run_id: row.run_id, digest_ja: row.digest_ja, themes, created_at: row.created_at };
  }

  runStatus(id: string, currentCountries: string[], failedCount: number): RunStatus | null {
    const row = this.db.prepare('SELECT * FROM research_runs WHERE id = @id').get({ id }) as RunRow | undefined;
    if (!row) {
      return null;
    }

    const topicCount = this.db
      .prepare('SELECT COUNT(*) AS count FROM country_updates WHERE run_id = @id')
      .get({ id }) as { count: number };
    const countryProgress = this.db
      .prepare(`
        SELECT
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
          COUNT(*) AS total
        FROM research_run_countries
        WHERE run_id = @id
      `)
      .get({ id }) as { completed: number | null; failed: number | null; total: number };
    const run = normalizeRun(row);
    const completedCountryCount = countryProgress.total > 0
      ? countryProgress.completed ?? 0
      : row.status === 'completed' ? run.country_count : 0;
    const failedCountryCount = countryProgress.total > 0 ? countryProgress.failed ?? 0 : failedCount;
    const finishedCountryCount = completedCountryCount + failedCountryCount;

    return {
      ...run,
      completed_country_count: completedCountryCount,
      topic_count: topicCount.count,
      failed_count: failedCountryCount,
      current_countries: currentCountries,
      progress: run.country_count === 0 ? 1 : Math.min(1, finishedCountryCount / run.country_count),
    };
  }
}

function normalizeRun(row: RunRow): ResearchRun {
  return {
    id: row.id,
    status: row.status,
    model: row.model,
    topics: JSON.parse(row.topics_json) as string[],
    country_count: row.country_count,
    started_at: row.started_at,
    finished_at: row.finished_at,
    error: row.error,
  };
}

function safeDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown-source';
  }
}
