import { describe, expect, it } from 'vitest';
import { affectedDays, computeStats, durationDays } from '../shared/stats.ts';
import { sore } from './helpers.ts';

const TODAY = '2026-10-06';

describe('durationDays', () => {
  it('counts healed sores from appearance to healing', () => {
    expect(durationDays(sore('2026-01-01', '2026-01-11'), TODAY)).toBe(10);
  });

  it('counts active sores up to today', () => {
    expect(durationDays(sore('2026-09-24', null), TODAY)).toBe(12);
  });
});

describe('affectedDays', () => {
  it('does not double count overlapping sores and excludes the healing day', () => {
    const days = affectedDays([sore('2026-07-20', '2026-07-30'), sore('2026-07-21', '2026-07-30')], TODAY);
    expect(days.size).toBe(10);
  });

  it('includes today for active sores', () => {
    expect(affectedDays([sore('2026-10-04', null)], TODAY).size).toBe(3);
  });
});

describe('computeStats', () => {
  const sores = [
    sore('2025-12-20', '2025-12-24', { location: 'Frenillo', cause: 'mordisco', pain: 2 }),
    sore('2026-01-01', '2026-01-11', { location: 'Labio inferior', cause: 'mordisco', pain: 4 }),
    sore('2026-09-04', '2026-09-12', { location: 'Labio inferior', treatment: 'gel' }),
    sore('2026-09-24', null, { location: 'Labio superior' }),
  ];
  const stats = computeStats(sores, TODAY);

  it('counts totals', () => {
    expect(stats.total).toBe(4);
    expect(stats.active).toBe(1);
    expect(stats.thisYear).toBe(3);
    expect(stats.last30).toBe(1);
  });

  it('averages only healed sores', () => {
    expect(stats.avgDuration).toBeCloseTo((4 + 10 + 8) / 3);
    expect(stats.medianDuration).toBe(8);
    expect(stats.longest?.days).toBe(10);
  });

  it('ignores missing pain values', () => {
    expect(stats.avgPain).toBe(3);
  });

  it('has no sore-free streak while a sore is active', () => {
    expect(stats.daysSinceLastHealed).toBeNull();
    const healedOnly = computeStats(sores.slice(0, 3), TODAY);
    expect(healedOnly.daysSinceLastHealed).toBe(24);
  });

  it('measures days affected this year', () => {
    expect(stats.yearDaysAffected).toBe(10 + 8 + 13);
    expect(stats.yearDaysElapsed).toBe(279);
  });

  it('builds the last 12 months ending in the current month', () => {
    expect(stats.months).toHaveLength(12);
    expect(stats.months[0].month).toBe('2025-11');
    expect(stats.months.at(-1)!.month).toBe('2026-10');
    const sept = stats.months.find((m) => m.month === '2026-09')!;
    expect(sept).toEqual({ month: '2026-09', started: 2, daysAffected: 8 + 7, daysInMonth: 30 });
    expect(stats.months.find((m) => m.month === '2025-12')!.daysAffected).toBe(4);
  });

  it('groups by location sorted by frequency and skips empty fields', () => {
    expect(stats.byLocation[0]).toEqual({ key: 'Labio inferior', count: 2, avgDuration: 9 });
    expect(stats.byCause).toEqual([{ key: 'mordisco', count: 2, avgDuration: 7 }]);
    expect(stats.byTreatment).toEqual([{ key: 'gel', count: 1, avgDuration: 8 }]);
  });

  it('handles an empty history', () => {
    const empty = computeStats([], TODAY);
    expect(empty.avgDuration).toBeNull();
    expect(empty.avgGapDays).toBeNull();
    expect(empty.longest).toBeNull();
  });
});
