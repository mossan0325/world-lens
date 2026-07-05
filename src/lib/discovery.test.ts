import { describe, expect, it } from 'vitest';
import type { CountryUpdate, RarityTier } from '../../shared/types';
import { applyRareQuota, discoveryScore, pickSpotlight, sortByDiscovery } from './discovery';

let nextId = 1;

function makeUpdate(overrides: Partial<CountryUpdate> & { rarity_tier: RarityTier; importance_score: number }): CountryUpdate {
  const id = nextId;
  nextId += 1;
  return {
    id,
    run_id: 'run-test',
    country_code: overrides.country_code ?? `C${id}`,
    topic_rank: 1,
    country_name_ja: `国${id}`,
    country_name_en: `Country ${id}`,
    region: 'アジア',
    lat: 0,
    lng: 0,
    category: '経済',
    headline_ja: '見出し',
    summary_ja: '要約',
    why_it_matters_ja: '理由',
    local_context_ja: '文脈',
    confidence: 0.7,
    created_at: '2026-07-05T00:00:00.000Z',
    change_status: null,
    sources: [],
    ...overrides,
  };
}

describe('discovery score', () => {
  it('boosts rarely covered countries', () => {
    const rare = makeUpdate({ rarity_tier: 'rare', importance_score: 60 });
    const anchor = makeUpdate({ rarity_tier: 'anchor', importance_score: 80 });
    expect(discoveryScore(rare)).toBeCloseTo(90);
    expect(discoveryScore(anchor)).toBeCloseTo(80);
    expect(sortByDiscovery([anchor, rare])[0]).toBe(rare);
  });
});

describe('rare exposure quota', () => {
  it('promotes rare countries into the visible slots', () => {
    const anchors = Array.from({ length: 8 }, (_, index) =>
      makeUpdate({ rarity_tier: 'anchor', importance_score: 95 - index }),
    );
    const rares = [
      makeUpdate({ rarity_tier: 'rare', importance_score: 40 }),
      makeUpdate({ rarity_tier: 'rare', importance_score: 38 }),
    ];
    const sorted = sortByDiscovery([...anchors, ...rares]);
    const withQuota = applyRareQuota(sorted, 6, 2);

    const topSix = withQuota.slice(0, 6);
    expect(topSix.filter((update) => update.rarity_tier === 'rare')).toHaveLength(2);
    // 上位の並びは発見スコア順を維持する
    for (let i = 1; i < topSix.length; i += 1) {
      expect(discoveryScore(topSix[i - 1])).toBeGreaterThanOrEqual(discoveryScore(topSix[i]));
    }
    // 全件は保持される(消えるトピックはない)
    expect(withQuota).toHaveLength(10);
  });

  it('does nothing when the quota is already met or no rare exists', () => {
    const rares = [
      makeUpdate({ rarity_tier: 'rare', importance_score: 90 }),
      makeUpdate({ rarity_tier: 'rare', importance_score: 88 }),
    ];
    const anchors = Array.from({ length: 6 }, (_, index) =>
      makeUpdate({ rarity_tier: 'anchor', importance_score: 85 - index }),
    );
    const sorted = sortByDiscovery([...rares, ...anchors]);
    expect(applyRareQuota(sorted, 6, 2)).toEqual(sorted);

    const anchorsOnly = sortByDiscovery(anchors);
    expect(applyRareQuota(anchorsOnly, 6, 2)).toEqual(anchorsOnly);
  });
});

describe('daily spotlight', () => {
  it('prefers rare countries and rotates deterministically by date', () => {
    const updates = [
      makeUpdate({ rarity_tier: 'rare', importance_score: 50, country_code: 'BT' }),
      makeUpdate({ rarity_tier: 'rare', importance_score: 60, country_code: 'VU' }),
      makeUpdate({ rarity_tier: 'anchor', importance_score: 99, country_code: 'US' }),
    ];

    const day1 = pickSpotlight(updates, new Date(2026, 6, 5));
    const day2 = pickSpotlight(updates, new Date(2026, 6, 6));
    const day1Again = pickSpotlight(updates, new Date(2026, 6, 5));

    expect(day1?.rarity_tier).toBe('rare');
    expect(day1Again?.country_code).toBe(day1?.country_code);
    expect(day2?.country_code).not.toBe(day1?.country_code);
  });

  it('falls back to other tiers when no rare country has data', () => {
    const updates = [makeUpdate({ rarity_tier: 'anchor', importance_score: 70, country_code: 'US' })];
    expect(pickSpotlight(updates, new Date())?.country_code).toBe('US');
    expect(pickSpotlight([], new Date())).toBeNull();
  });
});
