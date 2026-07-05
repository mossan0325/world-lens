const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function formatJapaneseDate(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAYS_JA[date.getDay()]}）`;
}

export function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) {
    return null;
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const diffMs = now.getTime() - timestamp;
  if (diffMs < 0) {
    return 'たった今';
  }
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return 'たった今';
  }
  if (minutes < 60) {
    return `${minutes}分前`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}時間前`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}日前`;
  }
  const months = Math.floor(days / 30);
  return `${months}か月前`;
}

export function isFresh(iso: string | null | undefined, hours = 24, now: Date = new Date()): boolean {
  if (!iso) {
    return false;
  }
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return false;
  }
  return now.getTime() - timestamp < hours * 60 * 60 * 1000;
}
