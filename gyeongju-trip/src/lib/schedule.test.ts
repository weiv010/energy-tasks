import { describe, expect, it } from 'vitest';
import { createSeed } from './seed';
import { daysBetween, formatTripRange, groupByDay, moveSchedule, sortSchedule } from './schedule';
import type { ScheduleItem } from './types';

const apply = (items: ScheduleItem[], patches: ReturnType<typeof moveSchedule>) =>
  items.map((i) => ({ ...i, ...(patches.find((p) => p.id === i.id)?.patch ?? {}) }));

describe('schedule', () => {
  it('sorts by day then time', () => {
    const s = createSeed().schedule.reverse();
    const sorted = sortSchedule(s);
    expect(sorted[0].title).toBe('양산 출발');
    expect(sorted.at(-1)!.title).toBe('양산 도착');
    const days = groupByDay(s);
    expect(days.map((d) => d.day)).toEqual(['2026-11-29', '2026-11-30']);
  });

  it('moving an item swaps times so order remains chronological', () => {
    const s = createSeed().schedule;
    const lunch = s.find((i) => i.title === '점심 식사')!;
    const next = apply(s, moveSchedule(s, lunch.id, 1));
    const day1 = sortSchedule(next).filter((i) => i.day === '2026-11-29');
    expect(day1[2].title).toBe('꽃길 한복');
    expect(day1[3].title).toBe('점심 식사');
    expect(day1[3].time).toBe('11:40');
  });

  it('cannot move past the first item of the day', () => {
    const s = createSeed().schedule;
    expect(moveSchedule(s, s[0].id, -1)).toEqual([]);
  });

  it('swaps items with identical times', () => {
    const s = createSeed().schedule;
    s[1].time = s[0].time;
    s[1].sort_order = s[0].sort_order;
    const next = apply(s, moveSchedule(s, s[1].id, -1));
    expect(sortSchedule(next)[0].id).toBe(s[1].id);
  });

  it('formats dates', () => {
    expect(formatTripRange('2026-11-29', '2026-11-30')).toBe('2026.11.29 SUN - 11.30 MON');
    expect(daysBetween('2026-11-29', '2026-11-30')).toEqual(['2026-11-29', '2026-11-30']);
  });
});
