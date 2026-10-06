import { addDays, daysBetween, toDayNumber } from './dates.ts';
import type { Sore } from './types.ts';

export interface GroupStat {
  key: string;
  count: number;
  avgDuration: number | null;
}

export interface MonthStat {
  month: string;
  started: number;
  daysAffected: number;
  daysInMonth: number;
}

export interface Stats {
  total: number;
  active: number;
  thisYear: number;
  last30: number;
  avgDuration: number | null;
  medianDuration: number | null;
  longest: { id: number; days: number } | null;
  avgPain: number | null;
  avgGapDays: number | null;
  daysSinceLastHealed: number | null;
  yearDaysAffected: number;
  yearDaysElapsed: number;
  months: MonthStat[];
  byLocation: GroupStat[];
  byCause: GroupStat[];
  byTreatment: GroupStat[];
}

/** Days from appearance to healing, or to today for an active sore. */
export function durationDays(sore: Pick<Sore, 'startedOn' | 'healedOn'>, today: string): number {
  return daysBetween(sore.startedOn, sore.healedOn ?? today);
}

/** Inclusive day-number range a sore occupied; the healing day itself is not counted. */
function occupiedRange(sore: Sore, today: string): [number, number] | null {
  const start = toDayNumber(sore.startedOn);
  const end = sore.healedOn ? toDayNumber(sore.healedOn) - 1 : toDayNumber(today);
  return end < start ? null : [start, end];
}

/** Set of day numbers on which at least one sore was present. */
export function affectedDays(sores: Sore[], today: string): Set<number> {
  const days = new Set<number>();
  for (const sore of sores) {
    const range = occupiedRange(sore, today);
    if (!range) continue;
    for (let d = range[0]; d <= range[1]; d++) days.add(d);
  }
  return days;
}

function mean(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function groupBy(sores: Sore[], pick: (s: Sore) => string | null): GroupStat[] {
  const groups = new Map<string, number[]>();
  const counts = new Map<string, number>();
  for (const sore of sores) {
    const key = pick(sore);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (sore.healedOn) {
      const list = groups.get(key) ?? [];
      list.push(daysBetween(sore.startedOn, sore.healedOn));
      groups.set(key, list);
    }
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count, avgDuration: mean(groups.get(key) ?? []) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function lastMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number);
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const date = new Date(Date.UTC(y, m - 1 - i, 1));
    result.push(date.toISOString().slice(0, 7));
  }
  return result;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function computeStats(sores: Sore[], today: string, monthCount = 12): Stats {
  const healed = sores.filter((s) => s.healedOn);
  const durations = healed.map((s) => durationDays(s, today));
  const year = today.slice(0, 4);
  const yearStart = `${year}-01-01`;
  const days = affectedDays(sores, today);

  let longest: Stats['longest'] = null;
  for (const sore of healed) {
    const d = durationDays(sore, today);
    if (!longest || d > longest.days) longest = { id: sore.id, days: d };
  }

  const starts = sores.map((s) => toDayNumber(s.startedOn)).sort((a, b) => a - b);
  const gaps = starts.slice(1).map((d, i) => d - starts[i]);

  const active = sores.filter((s) => !s.healedOn).length;
  const lastHealed = healed.map((s) => s.healedOn!).sort().at(-1);

  const todayDay = toDayNumber(today);
  const yearStartDay = toDayNumber(yearStart);
  let yearDaysAffected = 0;
  for (const d of days) if (d >= yearStartDay && d <= todayDay) yearDaysAffected++;

  const months = lastMonths(today, monthCount).map((month) => {
    const total = daysInMonth(month);
    const first = toDayNumber(`${month}-01`);
    let affected = 0;
    for (let d = first; d < first + total; d++) if (days.has(d)) affected++;
    return {
      month,
      started: sores.filter((s) => s.startedOn.startsWith(month)).length,
      daysAffected: affected,
      daysInMonth: total,
    };
  });

  return {
    total: sores.length,
    active,
    thisYear: sores.filter((s) => s.startedOn.startsWith(year)).length,
    last30: sores.filter((s) => s.startedOn > addDays(today, -30) && s.startedOn <= today).length,
    avgDuration: mean(durations),
    medianDuration: median(durations),
    longest,
    avgPain: mean(sores.flatMap((s) => (s.pain ? [s.pain] : []))),
    avgGapDays: mean(gaps),
    daysSinceLastHealed: active || !lastHealed ? null : daysBetween(lastHealed, today),
    yearDaysAffected,
    yearDaysElapsed: todayDay - yearStartDay + 1,
    months,
    byLocation: groupBy(sores, (s) => s.location),
    byCause: groupBy(sores, (s) => s.cause),
    byTreatment: groupBy(sores, (s) => s.treatment),
  };
}
