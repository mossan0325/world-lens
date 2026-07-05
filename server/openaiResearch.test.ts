import { describe, expect, it } from 'vitest';
import { collectResponseSources, parseResearchOutput } from './openaiResearch';
import { openWorldLensDatabase } from './database';
import { WorldLensRepository } from './repository';

describe('openai research parsing and persistence', () => {
  it('extracts fenced JSON topics and normalizes scalar fields', () => {
    const parsed = parseResearchOutput(`
      \`\`\`json
      {
        "topics": [
          {
            "topic_rank": 1,
            "category": "経済",
            "importance_score": 88.4,
            "headline_ja": "港湾投資計画が前進",
            "summary_ja": "政府が港湾投資の新計画を発表した。",
            "why_it_matters_ja": "物流網の再編を読む手がかりになる。",
            "local_context_ja": "現地紙は雇用創出を重視している。",
            "confidence": 0.76,
            "sources": [{ "title": "Local report", "url": "https://example.com/local", "language": "en" }]
          },
          {
            "topic_rank": 2,
            "category": "外交",
            "importance_score": 72,
            "headline_ja": "近隣国との協議が進展",
            "summary_ja": "政府間協議が進んだ。",
            "why_it_matters_ja": "地域安定の手がかりになる。",
            "local_context_ja": "現地では実務協議として扱われている。",
            "confidence": 0.62,
            "sources": []
          }
        ]
      }
      \`\`\`
    `);

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.importance_score).toBe(88);
    expect(parsed[0]?.confidence).toBe(0.76);
    expect(parsed[0]?.sources[0]?.url).toBe('https://example.com/local');
    expect(parsed[1]?.topic_rank).toBe(2);
  });

  it('collects url citations from a Responses-like object', () => {
    const sources = collectResponseSources({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              annotations: [
                { type: 'url_citation', title: 'Citation A', url: 'https://news.example/a' },
                { type: 'url_citation', title: 'Citation A duplicate', url: 'https://news.example/a' },
              ],
            },
          ],
        },
      ],
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.title).toBe('Citation A');
  });

  it('saves parsed updates and sources to SQLite', () => {
    const db = openWorldLensDatabase(':memory:');
    const repository = new WorldLensRepository(db);
    const run = repository.createRun('mock-model', ['経済'], 1);
    const updateId = repository.saveCountryUpdate(run.id, 'JP', {
      category: '経済',
      topic_rank: 1,
      importance_score: 80,
      headline_ja: '新しい産業政策を発表',
      summary_ja: '政府が産業政策の方針を示した。',
      why_it_matters_ja: '地域サプライチェーンに影響する。',
      local_context_ja: '国内では雇用への期待が語られている。',
      confidence: 0.8,
      raw_json: '{}',
      sources: [{ title: 'Mock source', url: 'https://example.com/japan-policy', language: 'ja' }],
    });

    const latest = repository.latestUpdatesPerCountry();
    const japan = latest.find((update) => update.country_code === 'JP');
    expect(updateId).toBeGreaterThan(0);
    expect(japan?.topic_rank).toBe(1);
    expect(japan?.rarity_tier).toBe('anchor');
    expect(japan?.sources[0]?.domain).toBe('example.com');
  });
});

describe('per-country latest view', () => {
  const basePayload = {
    topic_rank: 1,
    importance_score: 80,
    headline_ja: '見出し',
    summary_ja: '要約。',
    why_it_matters_ja: '理由。',
    local_context_ja: '文脈。',
    confidence: 0.8,
    raw_json: '{}',
    sources: [],
  };

  it('keeps older successful data when other countries update later', () => {
    const db = openWorldLensDatabase(':memory:');
    const repository = new WorldLensRepository(db);

    const run1 = repository.createRun('mock-model', ['経済'], 1);
    repository.saveCountryUpdate(run1.id, 'JP', { ...basePayload, category: '経済' });

    const latest = repository.latestUpdatesPerCountry();
    const japan = latest.find((update) => update.country_code === 'JP');
    // 初回データは新規/継続の判定対象外
    expect(japan?.change_status).toBeNull();
    // シードデモの他国データも消えずに共存する(国別履歴保持)
    expect(latest.some((update) => update.country_code === 'NG')).toBe(true);
  });

  it('marks topics as new or continuing versus the previous run', () => {
    const db = openWorldLensDatabase(':memory:');
    const repository = new WorldLensRepository(db);

    const run1 = repository.createRun('mock-model', ['経済'], 1);
    repository.saveCountryUpdate(run1.id, 'JP', { ...basePayload, category: '経済' });

    const run2 = repository.createRun('mock-model', ['経済'], 1);
    repository.saveCountryUpdate(run2.id, 'JP', { ...basePayload, category: '経済' });
    repository.saveCountryUpdate(run2.id, 'JP', { ...basePayload, category: '外交', topic_rank: 2 });

    const japanUpdates = repository.latestUpdatesPerCountry().filter((update) => update.country_code === 'JP');
    expect(japanUpdates).toHaveLength(2);
    expect(japanUpdates.every((update) => update.run_id === run2.id)).toBe(true);
    expect(japanUpdates.find((update) => update.category === '経済')?.change_status).toBe('continuing');
    expect(japanUpdates.find((update) => update.category === '外交')?.change_status).toBe('new');
  });

  it('stores and reads synthesis and coverage', () => {
    const db = openWorldLensDatabase(':memory:');
    const repository = new WorldLensRepository(db);

    const seeded = repository.getSynthesis('seed-demo');
    expect(seeded?.themes.length).toBeGreaterThan(0);

    const run = repository.createRun('mock-model', ['経済'], 2);
    repository.saveSynthesis(run.id, '今日のダイジェスト。', [
      { title_ja: '共通テーマ', description_ja: '説明', country_codes: ['JP', 'US'], category: '経済' },
    ]);
    const synthesis = repository.getSynthesis(run.id);
    expect(synthesis?.digest_ja).toBe('今日のダイジェスト。');
    expect(synthesis?.themes[0]?.country_codes).toEqual(['JP', 'US']);

    expect(repository.runCoverage('seed-demo')).toHaveLength(20);
  });
});
