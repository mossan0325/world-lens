import type { RarityTier } from './types';

export const CATEGORIES = [
  '政治・規制',
  '経済',
  '社会',
  '災害・気候',
  '外交',
  '資源・環境',
  '技術・産業',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const DEFAULT_RESEARCH_TOPICS: string[] = ['政治・規制', '経済', '社会', '災害・気候'];

// メディア露出の少ない国ほど発見スコアを加点し、大国バイアスを補正する。
export const RARITY_WEIGHTS: Record<RarityTier, number> = {
  anchor: 1,
  regional: 1.2,
  rare: 1.5,
};

export const RARITY_LABELS: Record<RarityTier, string> = {
  anchor: '主要国',
  regional: '地域国',
  rare: '報道が少ない国',
};

// カテゴリは自由記述("経済・通貨"等)が混在するため、区切りごとの部分一致で照合する。
export function matchesCategory(category: string, topic: string): boolean {
  if (topic === '総合') {
    return true;
  }
  if (category === topic) {
    return true;
  }
  const categorySegments = splitSegments(category);
  const topicSegments = splitSegments(topic);
  return topicSegments.some((topicSegment) =>
    categorySegments.some(
      (categorySegment) => categorySegment.includes(topicSegment) || topicSegment.includes(categorySegment),
    ),
  );
}

function splitSegments(value: string): string[] {
  return value
    .split(/[・/｜|,、\s]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}
