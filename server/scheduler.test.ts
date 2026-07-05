import { describe, expect, it } from 'vitest';
import { msUntilNext, parseDailyTime } from './scheduler';

describe('daily scheduler', () => {
  it('parses valid HH:MM values', () => {
    expect(parseDailyTime('07:30')).toEqual({ hours: 7, minutes: 30 });
    expect(parseDailyTime('0:05')).toEqual({ hours: 0, minutes: 5 });
    expect(parseDailyTime('23:59')).toEqual({ hours: 23, minutes: 59 });
  });

  it('rejects invalid values', () => {
    expect(parseDailyTime('24:00')).toBeNull();
    expect(parseDailyTime('07:60')).toBeNull();
    expect(parseDailyTime('abc')).toBeNull();
    expect(parseDailyTime('')).toBeNull();
  });

  it('computes delay until the next occurrence today', () => {
    const now = new Date(2026, 6, 5, 6, 0, 0, 0);
    expect(msUntilNext({ hours: 7, minutes: 30 }, now)).toBe(90 * 60 * 1000);
  });

  it('rolls over to tomorrow when the time already passed', () => {
    const now = new Date(2026, 6, 5, 8, 0, 0, 0);
    expect(msUntilNext({ hours: 7, minutes: 30 }, now)).toBe((24 * 60 - 30) * 60 * 1000);
  });
});
