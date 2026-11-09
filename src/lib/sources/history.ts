import type { BadgeKind, Meta } from "../types";
import { addDays, comparePeriods, summarisePeriod, toDayValues, type Comparison, type DayValue, type PeriodSummary, MIN_VALID_DAYS } from "../history";
import { getOpenAqDaily } from "./openaq";
import { getOpenMeteoRange } from "./openmeteo";
import type { Banner } from "./snapshot";

export type HistoryMode = "auto" | "measured" | "modelled";

export interface HistoryRequest {
  lat: number;
  lon: number;
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
  mode: HistoryMode;
}

export interface HistoryResponse {
  source: "openaq" | "open-meteo" | null;
  badge: BadgeKind | null;
  meta: Meta | null;
  periodA: PeriodSummary | null;
  periodB: PeriodSummary | null;
  comparison: Comparison | null;
  banners: Banner[];
}

const WARM_DAYS = 7;

function daily(map: Map<string, number[]>, minHours: number): Map<string, number> {
  const out = new Map<string, number>();
  for (const [d, v] of map) if (v.length >= minHours) out.set(d, v.reduce((a, b) => a + b, 0) / v.length);
  return out;
}

function sufficient(days: DayValue[], r: HistoryRequest): { a: PeriodSummary; b: PeriodSummary; ok: boolean } {
  const a = summarisePeriod(days, r.aStart, r.aEnd);
  const b = summarisePeriod(days, r.bStart, r.bEnd);
  return { a, b, ok: a.validDays >= MIN_VALID_DAYS && b.validDays >= MIN_VALID_DAYS };
}

export interface DailySeries {
  source: "openaq" | "open-meteo" | null;
  badge: BadgeKind | null;
  meta: Meta | null;
  /** all days fetched, including warm-up days before the requested start */
  days: DayValue[];
  banners: Banner[];
  /** why measured history was not used (empty when it was) */
  measuredWhy: string;
}

/**
 * One continuous daily series from ONE source for [from, to] (inclusive).
 * mode auto: OpenAQ station history if it has at least `minDays` valid days within [checkFrom, to], else CAMS model.
 */
export async function getDailySeries(lat: number, lon: number, from: string, to: string, mode: HistoryMode, checkFrom: string = from, minDays: number = MIN_VALID_DAYS): Promise<DailySeries> {
  const banners: Banner[] = [];
  const empty: DailySeries = { source: null, badge: null, meta: null, days: [], banners, measuredWhy: "" };
  let measuredWhy = "";
  if (mode !== "modelled") {
    const o = await getOpenAqDaily(lat, lon, from, to);
    if (o.ok && o.data) {
      const days = toDayValues(new Map(o.data.pm25.map((p) => [p.date, p.value])), new Map(o.data.pm10.map((p) => [p.date, p.value])));
      const valid = days.filter((d) => d.date >= checkFrom && d.date <= to && d.aqi != null).length;
      if (valid >= minDays) return { source: "openaq", badge: "HISTORICAL-MEASURED", meta: o.meta, days, banners, measuredWhy: "" };
      measuredWhy = `The nearest OpenAQ station (${o.data.stationName}) has too few valid days in this range.`;
    } else {
      measuredWhy = o.code === "no_key" ? "OpenAQ is not configured on this server." : o.error ?? "OpenAQ history is unavailable.";
    }
    if (mode === "measured") {
      banners.push({ id: "no-measured", severity: "warn", source: "OpenAQ", message: `${measuredWhy} No measured history to show. Switch to “Modelled” to see CAMS model data.` });
      return { ...empty, measuredWhy };
    }
  }

  const m = await getOpenMeteoRange(lat, lon, from, to);
  if (!m.ok || !m.data) {
    banners.push({ id: "om-fail", severity: "error", source: "Open-Meteo (CAMS)", message: `Modelled history is unavailable: ${m.error}` });
    return { ...empty, measuredWhy };
  }
  const now = Date.now();
  const pm25 = new Map<string, number[]>();
  const pm10 = new Map<string, number[]>();
  m.data.localTimes.forEach((lt, i) => {
    if (Date.parse(m.data!.times[i]) > now) return; // never include forecast hours in history
    const d = lt.slice(0, 10);
    const a = m.data!.pm25[i];
    const b = m.data!.pm10[i];
    if (a != null) (pm25.get(d) ?? pm25.set(d, []).get(d)!).push(a);
    if (b != null) (pm10.get(d) ?? pm10.set(d, []).get(d)!).push(b);
  });
  if (mode === "auto") {
    banners.push({
      id: "modelled-history",
      severity: "info",
      source: "Open-Meteo (CAMS)",
      message: `${measuredWhy} Showing MODELLED CAMS data instead. It is a model estimate, not station measurements.`.trim(),
    });
  }
  return { source: "open-meteo", badge: "MODELLED", meta: m.meta, days: toDayValues(daily(pm25, 18), daily(pm10, 18)), banners, measuredWhy };
}

/** Historical series for two periods from ONE source (never spliced). */
export async function getHistory(r: HistoryRequest): Promise<HistoryResponse> {
  const from = addDays([r.aStart, r.bStart].sort()[0], -WARM_DAYS);
  const to = [r.aEnd, r.bEnd].sort().at(-1)!;
  const checkFrom = [r.aStart, r.bStart].sort()[0];
  let series = await getDailySeries(r.lat, r.lon, from, to, r.mode, checkFrom, MIN_VALID_DAYS);
  let s = series.days.length ? sufficient(series.days, r) : null;
  // measured data existed overall but one period was too thin: fall back (auto) so both periods use the same source
  if (r.mode === "auto" && series.source === "openaq" && s && !s.ok) {
    const fb = await getDailySeries(r.lat, r.lon, from, to, "modelled");
    series = { ...fb, banners: [{ id: "modelled-history", severity: "info", source: "Open-Meteo (CAMS)", message: "The nearest station has too few valid days in one period. Showing MODELLED CAMS data for both periods instead. It is a model estimate, not station measurements." }, ...fb.banners.filter((b) => b.id !== "modelled-history")] };
    s = series.days.length ? sufficient(series.days, r) : null;
  }
  if (!series.source || !s) return { source: null, badge: null, meta: null, periodA: null, periodB: null, comparison: null, banners: series.banners };
  return { source: series.source, badge: series.badge, meta: series.meta, periodA: s.a, periodB: s.b, comparison: comparePeriods(s.a, s.b), banners: series.banners };
}
