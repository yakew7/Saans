import { categoryFor } from "./aqi/categories";
import { detectSpikes, mean, trendOf, type Trend } from "./aqi/stats";

/** Pure forecast analytics (shared by the server route and tests). */
export interface Hour {
  /** ISO UTC instant */
  t: string;
  /** location-local wall-clock time, YYYY-MM-DDTHH:MM */
  local: string;
  aqi: number | null;
  pm25: number | null;
  pm10: number | null;
}

export interface DailyRange {
  date: string;
  min: number;
  max: number;
  mean: number;
  peakLocal: string;
  hours: number;
}

export function dailyRanges(hours: Hour[]): DailyRange[] {
  const by = new Map<string, Hour[]>();
  for (const h of hours) {
    if (h.aqi == null) continue;
    const d = h.local.slice(0, 10);
    (by.get(d) ?? by.set(d, []).get(d)!).push(h);
  }
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, hs]) => {
      const vals = hs.map((h) => h.aqi!);
      const peak = hs.reduce((m, h) => (h.aqi! > m.aqi! ? h : m));
      return { date, min: Math.min(...vals), max: Math.max(...vals), mean: mean(vals)!, peakLocal: peak.local, hours: hs.length };
    });
}

export interface BestWindow {
  startLocal: string;
  endLocal: string;
  meanAqi: number;
  categoryLabel: string;
  /** typical AQI of the remaining daylight hours, for context */
  dayMeanAqi: number;
  /** better than the daylight average by this many AQI points */
  improvement: number;
  dayLabel: "today" | "tomorrow";
}

const DAYLIGHT_START = 6;
const DAYLIGHT_END = 20; // window must end by 20:00 local

/**
 * Best 2-hour window to be outside: the lowest mean forecast AQI among windows between 06:00 and 20:00 local
 * that start at or after `nowLocal` (rounded up to the hour). Falls back to tomorrow if today has no full window left.
 */
export function bestTimeToGoOut(hours: Hour[], nowLocal: string, windowLen = 2): BestWindow | null {
  const hourOf = (l: string) => Number(l.slice(11, 13));
  const today = nowLocal.slice(0, 10);
  const nowHour = hourOf(nowLocal) + (Number(nowLocal.slice(14, 16)) > 0 ? 1 : 0);
  const byLocal = new Map(hours.map((h) => [h.local, h]));
  const pick = (date: string, fromHour: number, label: "today" | "tomorrow"): BestWindow | null => {
    const lo = Math.max(DAYLIGHT_START, fromHour);
    const dayHours: number[] = [];
    let best: { start: number; mean: number } | null = null;
    for (let h = lo; h + windowLen <= DAYLIGHT_END; h++) {
      const vals: number[] = [];
      for (let k = 0; k < windowLen; k++) {
        const v = byLocal.get(`${date}T${String(h + k).padStart(2, "0")}:00`)?.aqi;
        if (v != null) vals.push(v);
      }
      if (vals.length < windowLen) continue;
      const m = mean(vals)!;
      dayHours.push(m);
      if (!best || m < best.mean) best = { start: h, mean: m };
    }
    if (!best) return null;
    const dayMean = mean(dayHours)!;
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      startLocal: `${date}T${pad(best.start)}:00`,
      endLocal: `${date}T${pad(best.start + windowLen)}:00`,
      meanAqi: Math.round(best.mean),
      categoryLabel: categoryFor(best.mean).label,
      dayMeanAqi: Math.round(dayMean),
      improvement: Math.round(dayMean - best.mean),
      dayLabel: label,
    };
  };
  const t = pick(today, nowHour, "today");
  if (t) return t;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return pick(tomorrow.toISOString().slice(0, 10), DAYLIGHT_START, "tomorrow");
}

export interface PredictedSpike {
  local: string;
  aqi: number;
  baseline: number;
  categoryLabel: string;
}

/** Predicted spikes: robust (rolling median + MAD) outliers in the forecast part of the series. */
export function predictedSpikes(hours: Hour[], nowIndex: number): PredictedSpike[] {
  const pts = hours.map((h) => ({ t: h.local, v: h.aqi }));
  return detectSpikes(pts, { window: 24, threshold: 3.5, minScale: 6, minValue: 100 })
    .filter((s) => s.index > nowIndex)
    .map((s) => ({ local: s.t, aqi: s.value, baseline: Math.round(s.baselineMedian), categoryLabel: categoryFor(s.value).label }));
}

export interface TrendSummary {
  trend: Trend;
  /** mean AQI of the first third / last third of the horizon */
  early: number | null;
  late: number | null;
}

export function forecastTrend(forecastHours: Hour[]): TrendSummary {
  const vals = forecastHours.map((h) => h.aqi).filter((v): v is number => v != null);
  if (vals.length < 12) return { trend: "steady", early: null, late: null };
  const k = Math.max(1, Math.floor(vals.length / 3));
  return { trend: trendOf(vals, 0.1), early: mean(vals.slice(0, k)), late: mean(vals.slice(-k)) };
}
