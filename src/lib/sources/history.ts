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

/**
 * Historical series for two periods from ONE source (never spliced).
 * auto: OpenAQ station history (HISTORICAL-MEASURED) when both periods have enough days, else Open-Meteo CAMS (MODELLED).
 */
export async function getHistory(r: HistoryRequest): Promise<HistoryResponse> {
  const from = addDays([r.aStart, r.bStart].sort()[0], -WARM_DAYS);
  const to = [r.aEnd, r.bEnd].sort().at(-1)!;
  const banners: Banner[] = [];
  const empty: HistoryResponse = { source: null, badge: null, meta: null, periodA: null, periodB: null, comparison: null, banners };

  let measuredWhy = "";
  if (r.mode !== "modelled") {
    const o = await getOpenAqDaily(r.lat, r.lon, from, to);
    if (o.ok && o.data) {
      const days = toDayValues(new Map(o.data.pm25.map((p) => [p.date, p.value])), new Map(o.data.pm10.map((p) => [p.date, p.value])));
      const s = sufficient(days, r);
      if (s.ok) {
        return { source: "openaq", badge: "HISTORICAL-MEASURED", meta: o.meta, periodA: s.a, periodB: s.b, comparison: comparePeriods(s.a, s.b), banners };
      }
      measuredWhy = `The nearest OpenAQ station (${o.data.stationName}) has fewer than ${MIN_VALID_DAYS} valid days in one of the periods.`;
    } else {
      measuredWhy = o.code === "no_key" ? "OpenAQ is not configured on this server." : o.error ?? "OpenAQ history is unavailable.";
    }
    if (r.mode === "measured") {
      banners.push({ id: "no-measured", severity: "warn", source: "OpenAQ", message: `${measuredWhy} No measured history to show. Switch to “Modelled” to see CAMS model data.` });
      return empty;
    }
  }

  const m = await getOpenMeteoRange(r.lat, r.lon, from, to);
  if (!m.ok || !m.data) {
    banners.push({ id: "om-fail", severity: "error", source: "Open-Meteo (CAMS)", message: `Modelled history is unavailable: ${m.error}` });
    return empty;
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
  const days = toDayValues(daily(pm25, 18), daily(pm10, 18));
  const s = sufficient(days, r);
  if (r.mode === "auto") {
    banners.push({
      id: "modelled-history",
      severity: "info",
      source: "Open-Meteo (CAMS)",
      message: `${measuredWhy} Showing MODELLED CAMS data instead. It is a model estimate, not station measurements.`.trim(),
    });
  }
  return { source: "open-meteo", badge: "MODELLED", meta: m.meta, periodA: s.a, periodB: s.b, comparison: comparePeriods(s.a, s.b), banners };
}
