import type { CountryUpdate, RarityTier } from '../../shared/types';
import { discoveryScore } from './discovery';

export type CountrySignalSummary = {
  country_code: string;
  country_name_ja: string;
  country_name_en: string;
  region: string;
  lat: number;
  lng: number;
  rarity_tier: RarityTier;
  topicCount: number;
  maxImportance: number;
  maxDiscovery: number;
  avgConfidence: number;
  categories: string[];
  latestCreatedAt: string;
  topUpdate: CountryUpdate;
};

export function buildCountrySummaries(updates: CountryUpdate[]): CountrySignalSummary[] {
  const byCountry = new Map<string, CountryUpdate[]>();
  for (const update of updates) {
    const current = byCountry.get(update.country_code) ?? [];
    current.push(update);
    byCountry.set(update.country_code, current);
  }

  return Array.from(byCountry.values())
    .map((countryUpdates) => {
      const sortedUpdates = countryUpdates.toSorted(
        (a, b) => b.importance_score - a.importance_score || a.topic_rank - b.topic_rank,
      );
      const topUpdate = sortedUpdates[0];
      const categories = Array.from(new Set(sortedUpdates.map((update) => update.category))).slice(0, 3);
      const avgConfidence = sortedUpdates.reduce((sum, update) => sum + update.confidence, 0) / sortedUpdates.length;
      const latestCreatedAt = sortedUpdates.reduce(
        (latest, update) => (update.created_at > latest ? update.created_at : latest),
        sortedUpdates[0].created_at,
      );
      return {
        country_code: topUpdate.country_code,
        country_name_ja: topUpdate.country_name_ja,
        country_name_en: topUpdate.country_name_en,
        region: topUpdate.region,
        lat: topUpdate.lat,
        lng: topUpdate.lng,
        rarity_tier: topUpdate.rarity_tier,
        topicCount: sortedUpdates.length,
        maxImportance: topUpdate.importance_score,
        maxDiscovery: discoveryScore(topUpdate),
        avgConfidence,
        categories,
        latestCreatedAt,
        topUpdate,
      };
    })
    .toSorted((a, b) => b.maxDiscovery - a.maxDiscovery || b.topicCount - a.topicCount);
}
