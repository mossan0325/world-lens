// 閲覧した国を localStorage に記録し、「今週の探索」メーターと未訪問国の提示に使う。
const STORAGE_KEY = 'world-lens-viewed-countries-v1';

export type ViewedMap = Record<string, string>;

export function loadViewedCountries(): ViewedMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    const result: ViewedMap = {};
    for (const [code, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        result[code] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function recordViewedCountry(viewed: ViewedMap, countryCode: string, now: Date = new Date()): ViewedMap {
  const next: ViewedMap = { ...viewed, [countryCode]: now.toISOString() };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorageが使えない環境では記録なしで動作継続する。
  }
  return next;
}

export function viewedWithinDays(viewed: ViewedMap, days: number, now: Date = new Date()): string[] {
  const threshold = now.getTime() - days * 24 * 60 * 60 * 1000;
  return Object.entries(viewed)
    .filter(([, iso]) => {
      const timestamp = Date.parse(iso);
      return Number.isFinite(timestamp) && timestamp >= threshold;
    })
    .map(([code]) => code);
}
