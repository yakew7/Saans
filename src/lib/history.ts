import { computeEpaAqi } from "./aqi/epa";
import { detectSpikes, linearTrend, mean, percentChange, type Point } from "./aqi/stats";

/** Pure helpers for the Historical Pollution Tracker (shared by server route and tests). */
export interface DayValue {
  date: string; // YYYY-MM-DD (location-local calendar day)
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
}

export interface DaySpike {
  date: string;
  aqi: number;
  baseline: number;
  robustZ: number;
}

export interface PeriodSummary {
  start: string;
  end: string;
  days: DayValue[];
  validDays: number;
  meanPm25: number | null;
  meanPm10: number | null;
  meanAqi: number | null;
  maxAqi: { date: string; aqi: number } | null;
  minAqi: { date: string; aqi: number } | null;
  /** slope of daily PM2.5 (µg/m³ per day) from a least-squares line */
  pm25TrendPerDay: number | null;
  /** fitted PM2.5 values aligned with `days` (null where a day has no PM2.5) */
  pm25Fitted: (number | null)[];
  spikes: DaySpike[];
}

export function toDayValues(pm25: Map<string, number>, pm10: Map<string, number>): DayValue[] {
  const dates = [...new Set([...pm25.keys(), ...pm10.keys()])].sort();
  return dates.map((date) => {
    const a = pm25.get(date) ?? null;
    const b = pm10.get(date) ?? null;
    const c = computeEpaAqi({ pm25: a, pm10: b });
    return { date, pm25: a, pm10: b, aqi: c?.aqi ?? null };
  });
}

/** Summarise `all` (which may include warm-up days before `start`) for the inclusive range [start, end]. */
export function summarisePeriod(all: DayValue[], start: string, end: string): PeriodSummary {
  const days = all.filter((d) => d.date >= start && d.date <= end);
  const nums = (f: (d: DayValue) => number | null) => days.map(f).filter((v): v is number => v != null);
  const aqiDays = days.filter((d) => d.aqi != null) as (DayValue & { aqi: number })[];
  const maxA = aqiDays.reduce<(typeof aqiDays)[number] | null>((m, d) => (!m || d.aqi > m.aqi ? d : m), null);
  const minA = aqiDays.reduce<(typeof aqiDays)[number] | null>((m, d) => (!m || d.aqi < m.aqi ? d : m), null);

  const pm25Vals = days.map((d) => d.pm25);
  const present = pm25Vals.map((v, i) => [v, i] as const).filter((x): x is [number, number] => x[0] != null);
  const trend = linearTrend(present.map(([v]) => v));
  const fitted: (number | null)[] = new Array(days.length).fill(null);
  if (trend) present.forEach(([, i], k) => (fitted[i] = trend.fitted[k]));

  // spikes over the warm-up-inclusive AQI series, reported only inside the period
  const series: Point[] = all.map((d) => ({ t: d.date, v: d.aqi }));
  const spikes = detectSpikes(series, { window: 7, threshold: 3.5, minScale: 8, minValue: 60 })
    .filter((s) => s.t >= start && s.t <= end)
    .map((s) => ({ date: s.t, aqi: s.value, baseline: s.baselineMedian, robustZ: s.robustZ }));

  return {
    start,
    end,
    days,
    validDays: aqiDays.length,
    meanPm25: mean(nums((d) => d.pm25)),
    meanPm10: mean(nums((d) => d.pm10)),
    meanAqi: mean(aqiDays.map((d) => d.aqi)),
    maxAqi: maxA ? { date: maxA.date, aqi: maxA.aqi } : null,
    minAqi: minA ? { date: minA.date, aqi: minA.aqi } : null,
    pm25TrendPerDay: trend?.slope ?? null,
    pm25Fitted: fitted,
    spikes,
  };
}

export interface Comparison {
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
  /** false when either period has fewer than 3 valid days: percentages are withheld */
  sufficient: boolean;
}

export const MIN_VALID_DAYS = 3;

/** % change from period A (baseline) to period B. */
export function comparePeriods(a: PeriodSummary, b: PeriodSummary): Comparison {
  const sufficient = a.validDays >= MIN_VALID_DAYS && b.validDays >= MIN_VALID_DAYS;
  if (!sufficient) return { pm25: null, pm10: null, aqi: null, sufficient };
  return {
    pm25: percentChange(a.meanPm25, b.meanPm25),
    pm10: percentChange(a.meanPm10, b.meanPm10),
    aqi: percentChange(a.meanAqi, b.meanAqi),
    sufficient,
  };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
