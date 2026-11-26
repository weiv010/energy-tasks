import { describe, expect, it } from 'vitest';
import { normalizeAmount, summarizeBudget, won } from './budget';
import { createSeed } from './seed';

describe('budget', () => {
  it('seed plan totals exactly 300,000 and optional is excluded', () => {
    const s = createSeed();
    const sum = summarizeBudget(s.budget, s.trip.total_budget);
    expect(sum.planned).toBe(300000);
    expect(sum.optionalPlanned).toBe(7000);
    expect(sum.spent).toBe(0);
    expect(sum.remaining).toBe(300000);
    expect(s.budget.find((b) => b.is_optional)?.spent).toBe(false);
  });

  it('only checked items count as spent', () => {
    const s = createSeed();
    const hotel = s.budget.find((b) => b.title === '지베르니 호텔')!;
    hotel.spent = true;
    let sum = summarizeBudget(s.budget, 300000);
    expect(sum.spent).toBe(76500);
    expect(sum.remaining).toBe(223500);
    hotel.spent = false;
    sum = summarizeBudget(s.budget, 300000);
    expect(sum.spent).toBe(0);
    expect(sum.remaining).toBe(300000);
  });

  it('flags overspending and clamps percent', () => {
    const s = createSeed();
    s.budget.forEach((b) => (b.spent = true));
    s.budget[0].amount = 100000;
    const sum = summarizeBudget(s.budget, 300000);
    expect(sum.spent).toBe(300000 - 76500 + 100000 + 7000);
    expect(sum.overSpent).toBe(true);
    expect(sum.remaining).toBe(300000 - sum.spent);
    expect(sum.percent).toBe(100);
  });

  it('normalizes amounts', () => {
    expect(normalizeAmount('12,500원')).toBe(12500);
    expect(normalizeAmount(-5)).toBe(0);
    expect(normalizeAmount('abc')).toBe(0);
    expect(won(-1500)).toBe('-1,500원');
  });
});
