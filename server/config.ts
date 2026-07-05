import path from 'node:path';
import dotenv from 'dotenv';

const rootDir = process.cwd();
const envPath = path.resolve(rootDir, '.env');

dotenv.config({ path: envPath, override: true });

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(rootDir, value);
}

export type SearchContextSize = 'low' | 'medium' | 'high';

function parseIntegerInRange(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function parseSearchContext(value: string | undefined): SearchContextSize {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'low' || normalized === 'high' ? normalized : 'medium';
}

// "HH:MM"(24時間表記)。不正・未設定なら null = 自動実行なし。
function parseDailyTime(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(normalized) ? normalized : null;
}

export const config = {
  port: Number.parseInt(process.env.PORT ?? '8787', 10),
  openaiApiKey: process.env.OPENAI_API_KEY?.trim() ?? '',
  openaiModel: process.env.OPENAI_MODEL?.trim() || 'gpt-5.5',
  dbPath: resolveFromRoot(process.env.WORLD_LENS_DB_PATH?.trim() || './data/world_lens.sqlite'),
  countryLimit: parseIntegerInRange(process.env.RESEARCH_COUNTRY_LIMIT, 20, 1, 193),
  researchConcurrency: parseIntegerInRange(process.env.RESEARCH_CONCURRENCY, 3, 1, 8),
  searchContextSize: parseSearchContext(process.env.RESEARCH_SEARCH_CONTEXT),
  researchAutoTime: parseDailyTime(process.env.RESEARCH_AUTO_TIME),
};

export function hasOpenAiKey(): boolean {
  return config.openaiApiKey.length > 0;
}
