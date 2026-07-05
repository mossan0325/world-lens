export type DailyTime = {
  hours: number;
  minutes: number;
};

export function parseDailyTime(value: string): DailyTime | null {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  return { hours: Number.parseInt(match[1], 10), minutes: Number.parseInt(match[2], 10) };
}

// 次にその時刻(ローカル時間)が来るまでのミリ秒。今日の時刻を過ぎていれば翌日。
export function msUntilNext(time: DailyTime, now: Date = new Date()): number {
  const next = new Date(now);
  next.setHours(time.hours, time.minutes, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

// 毎日 value("HH:MM")に task を実行する。戻り値は停止関数。value が不正なら null。
export function scheduleDailyTask(value: string, task: () => void): (() => void) | null {
  const time = parseDailyTime(value);
  if (!time) {
    return null;
  }

  let timer: NodeJS.Timeout | null = null;
  let cancelled = false;

  const scheduleNext = () => {
    if (cancelled) {
      return;
    }
    timer = setTimeout(() => {
      try {
        task();
      } catch (error) {
        console.error('Scheduled research task failed:', error);
      }
      scheduleNext();
    }, msUntilNext(time));
  };

  scheduleNext();

  return () => {
    cancelled = true;
    if (timer) {
      clearTimeout(timer);
    }
  };
}
