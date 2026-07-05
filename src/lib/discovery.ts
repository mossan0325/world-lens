import { RARITY_WEIGHTS } from '../../shared/research';
import type { CountryUpdate, RarityTier } from '../../shared/types';

type Scorable = Pick<CountryUpdate, 'importance_score' | 'rarity_tier'>;

// 発見スコア = 重要度 × 露出補正。報道の少ない国ほど高く評価し、大国バイアスを補正する。
export function discoveryScore(update: Scorable): number {
  return update.importance_score * (RARITY_WEIGHTS[update.rarity_tier] ?? 1);
}

export function rarityWeight(tier: RarityTier): number {
  return RARITY_WEIGHTS[tier] ?? 1;
}

export function sortByDiscovery<T extends Scorable>(updates: T[]): T[] {
  return [...updates].sort((a, b) => discoveryScore(b) - discoveryScore(a));
}

// 表示上位 visibleSlots 件に rare 国が minRare 件以上入るよう並びを補正する(露出クォータ)。
// rare が足りない場合は可能な数だけ入れる。全体の順序は発見スコア順を維持する。
export function applyRareQuota<T extends Scorable>(sorted: T[], visibleSlots: number, minRare: number): T[] {
  if (sorted.length <= visibleSlots) {
    return sorted;
  }

  const top = sorted.slice(0, visibleSlots);
  const rest = sorted.slice(visibleSlots);
  const rareInTop = top.filter((update) => update.rarity_tier === 'rare').length;
  if (rareInTop >= minRare) {
    return sorted;
  }

  const promoted: T[] = [];
  const restRare = rest.filter((update) => update.rarity_tier === 'rare');
  let needed = Math.min(minRare - rareInTop, restRare.length);
  if (needed === 0) {
    return sorted;
  }

  // 上位から rare 以外を後ろから外し、rare の上位を繰り上げる。
  const demoted: T[] = [];
  const keptTop = [...top];
  while (needed > 0) {
    const promotedUpdate = restRare[promoted.length];
    if (!promotedUpdate) {
      break;
    }
    let demoteIndex = -1;
    for (let i = keptTop.length - 1; i >= 0; i -= 1) {
      if (keptTop[i].rarity_tier !== 'rare') {
        demoteIndex = i;
        break;
      }
    }
    if (demoteIndex < 0) {
      break;
    }
    demoted.push(keptTop[demoteIndex]);
    keptTop.splice(demoteIndex, 1);
    promoted.push(promotedUpdate);
    needed -= 1;
  }

  const newTop = [...keptTop, ...promoted].sort((a, b) => discoveryScore(b) - discoveryScore(a));
  const promotedSet = new Set(promoted);
  const newRest = [...demoted, ...rest.filter((update) => !promotedSet.has(update))].sort(
    (a, b) => discoveryScore(b) - discoveryScore(a),
  );
  return [...newTop, ...newRest];
}

// 今日のスポットライト: 報道の少ない国を日替わりでローテーション表示する。
// dateで決定的に選ぶため、同じ日は同じ国になる。
export function pickSpotlight(updates: CountryUpdate[], date: Date): CountryUpdate | null {
  if (updates.length === 0) {
    return null;
  }

  const pickFromTier = (tier: RarityTier): CountryUpdate | null => {
    const byCountry = new Map<string, CountryUpdate>();
    for (const update of updates) {
      if (update.rarity_tier !== tier) {
        continue;
      }
      const current = byCountry.get(update.country_code);
      if (!current || update.importance_score > current.importance_score) {
        byCountry.set(update.country_code, update);
      }
    }
    const codes = Array.from(byCountry.keys()).sort();
    if (codes.length === 0) {
      return null;
    }
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (24 * 60 * 60 * 1000),
    );
    return byCountry.get(codes[dayOfYear % codes.length]) ?? null;
  };

  return pickFromTier('rare') ?? pickFromTier('regional') ?? pickFromTier('anchor');
}
