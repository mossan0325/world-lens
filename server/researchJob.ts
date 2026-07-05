import { DEFAULT_RESEARCH_TOPICS } from '../shared/research';
import type { Country } from '../shared/types';
import { researchCountry } from './openaiResearch';
import type { ResearchPayload, WorldLensRepository } from './repository';
import { generateRunSynthesis, type SynthesisInputTopic } from './synthesis';

export type ResearchJobProgress = {
  currentCountries: Set<string>;
  failedCount: number;
};

export type ResearchJobResult = {
  status: string;
  topicCount: number;
  failures: string[];
};

export function createJobProgress(): ResearchJobProgress {
  return { currentCountries: new Set(), failedCount: 0 };
}

export function normalizeTopics(topics: string[] | undefined): string[] {
  const cleanTopics = (topics ?? [])
    .map((topic) => topic.trim())
    .filter((topic) => topic.length > 0)
    .slice(0, 4);
  return cleanTopics.length > 0 ? cleanTopics : [...DEFAULT_RESEARCH_TOPICS];
}

// 1回目は structured outputs、失敗したら従来のテキスト抽出モードでもう1回だけ試す。
async function researchCountryWithRetry(country: Country, topics: string[]): Promise<ResearchPayload[]> {
  try {
    return await researchCountry(country, topics, { structured: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Research retrying for ${country.name_en} (structured attempt failed: ${message})`);
    return await researchCountry(country, topics, { structured: false });
  }
}

export async function executeResearchRun(args: {
  repository: WorldLensRepository;
  runId: string;
  countries: Country[];
  topics: string[];
  concurrency: number;
  progress?: ResearchJobProgress;
}): Promise<ResearchJobResult> {
  const { repository, runId, countries, topics } = args;
  const progress = args.progress ?? createJobProgress();
  const failures: string[] = [];
  const synthesisInput: SynthesisInputTopic[] = [];

  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(args.concurrency, countries.length));

  async function worker(): Promise<void> {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= countries.length) {
        return;
      }
      const country = countries[index];
      progress.currentCountries.add(country.name_ja);
      repository.markRunCountry(runId, country.code, 'running');
      try {
        const payloads = await researchCountryWithRetry(country, topics);
        if (payloads.length === 0) {
          throw new Error('No major topics were returned.');
        }
        for (const payload of payloads) {
          repository.saveCountryUpdate(runId, country.code, payload);
          synthesisInput.push({
            country_code: country.code,
            country_name_ja: country.name_ja,
            region: country.region,
            category: payload.category,
            importance_score: payload.importance_score,
            headline_ja: payload.headline_ja,
            summary_ja: payload.summary_ja,
          });
        }
        repository.markRunCountry(runId, country.code, 'completed');
        console.log(`Research completed for ${country.name_en} (${payloads.length} topics)`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        progress.failedCount += 1;
        failures.push(`${country.name_en}: ${message}`);
        repository.markRunCountry(runId, country.code, 'failed', message);
        console.error(`Research failed for ${country.name_en}:`, error);
      } finally {
        progress.currentCountries.delete(country.name_ja);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  progress.currentCountries.clear();

  // 2か国以上の結果が揃ったときだけ横断統合を実行する(失敗してもラン自体は落とさない)。
  if (synthesisInput.length > 0 && new Set(synthesisInput.map((topic) => topic.country_code)).size >= 2) {
    try {
      const synthesis = await generateRunSynthesis(synthesisInput);
      repository.saveSynthesis(runId, synthesis.digest_ja, synthesis.themes);
      console.log(`Synthesis completed for run ${runId} (${synthesis.themes.length} themes)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`横断テーマ統合: ${message}`);
      console.error('Synthesis failed:', error);
    }
  }

  const status = repository.runStatus(runId, [], progress.failedCount);
  if (!status || status.topic_count === 0) {
    repository.markRun(runId, 'failed', failures.join('\n') || 'No country research completed.');
    return { status: 'failed', topicCount: 0, failures };
  }

  const finalStatus = failures.length > 0 ? 'completed_with_errors' : 'completed';
  repository.markRun(runId, finalStatus, failures.join('\n') || null);
  return { status: finalStatus, topicCount: status.topic_count, failures };
}
