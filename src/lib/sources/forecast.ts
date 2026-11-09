import type { Meta } from "../types";
import { mean } from "../aqi/stats";
import { bestTimeToGoOut, dailyRanges, forecastTrend, predictedSpikes, type BestWindow, type DailyRange, type Hour, type PredictedSpike, type TrendSummary } from "../forecast";
import { getOpenAqLatest } from "./openaq";
import { getOpenMeteoHourly } from "./openmeteo";
import type { Banner } from "./snapshot";

export interface ForecastResponse {
  meta: Meta | null;
  /** hourly CAMS series: 48 h of analysis before now (MODELLED) + up to 120 h forecast */
  hours: Hour[];
  /** index in `hours` of the last hour that is not in the future */
  nowIndex: number;
  nowLocal: string | null;
  daily: DailyRange[];
  trend: TrendSummary | null;
  spikes: PredictedSpike[];
  best: BestWindow | null;
  /** best window tomorrow (always computed, useful when little of today is left) */
  bestTomorrow: BestWindow | null;
  /** last 24 h: measured station PM2.5 vs CAMS modelled PM2.5, for an honest model check */
  modelCheck: {
    station: string;
    distanceKm: number | null;
    meta: Meta;
    rows: { t: string; local: string; measured: number | null; modelled: number | null }[];
    meanAbsDiff: number | null;
    modelOverMeasuredPct: number | null;
  } | null;
  banners: Banner[];
}

function tomorrowBest(hours: Hour[], nowLocal: string): BestWindow | null {
  const d = new Date(`${nowLocal.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  const b = bestTimeToGoOut(hours, `${d.toISOString().slice(0, 10)}T00:00`);
  return b ? { ...b, dayLabel: "tomorrow" } : null;
}

export async function getForecast(lat: number, lon: number): Promise<ForecastResponse> {
  const banners: Banner[] = [];
  const [om, oaq] = await Promise.all([getOpenMeteoHourly(lat, lon, 2, 5), getOpenAqLatest(lat, lon)]);
  if (!om.ok || !om.data) {
    banners.push({ id: "forecast-down", severity: "error", source: "Open-Meteo (CAMS)", message: `Forecast is unavailable: ${om.error ?? "unknown error"}.` });
    return { meta: null, hours: [], nowIndex: -1, nowLocal: null, daily: [], trend: null, spikes: [], best: null, bestTomorrow: null, modelCheck: null, banners };
  }
  const d = om.data;
  const hours: Hour[] = d.times.map((t, i) => ({ t, local: d.localTimes[i], aqi: d.usAqi[i], pm25: d.pm25[i], pm10: d.pm10[i] }));
  const now = Date.now();
  let nowIndex = -1;
  hours.forEach((h, i) => {
    if (Date.parse(h.t) <= now) nowIndex = i;
  });
  const future = hours.slice(Math.max(0, nowIndex));
  const nowLocal = nowIndex >= 0 ? hours[nowIndex].local : null;

  if (om.meta.servedStale) banners.push({ id: "fc-cached", severity: "warn", source: "Open-Meteo (CAMS)", message: "Open-Meteo is unreachable. Showing the last cached forecast." });

  let modelCheck: ForecastResponse["modelCheck"] = null;
  const series = oaq.ok ? oaq.data?.recent.pm25 : undefined;
  if (oaq.ok && oaq.data && series?.length) {
    // full hourly grid (last 24 h of model hours): hours the station did not report stay null, so gaps show as gaps
    const measuredByHour = new Map(series.map((p) => [p.t.slice(0, 13), p.v]));
    const grid = hours.slice(Math.max(0, nowIndex - 23), nowIndex + 1);
    const rows = grid.map((h) => ({ t: h.t, local: h.local, measured: measuredByHour.get(h.t.slice(0, 13)) ?? null, modelled: h.pm25 }));
    const both = rows.filter((r) => r.measured != null && r.modelled != null) as { measured: number; modelled: number }[];
    if (both.length >= 8) {
      const mad = mean(both.map((r) => Math.abs(r.measured - r.modelled)))!;
      const mm = mean(both.map((r) => r.measured))!;
      const md = mean(both.map((r) => r.modelled))!;
      modelCheck = { station: oaq.data.stationName, distanceKm: oaq.data.distanceKm, meta: oaq.meta, rows, meanAbsDiff: mad, modelOverMeasuredPct: mm > 0 ? ((md - mm) / mm) * 100 : null };
    }
  }

  return {
    meta: om.meta,
    hours,
    nowIndex,
    nowLocal,
    daily: dailyRanges(future),
    trend: forecastTrend(hours.slice(nowIndex + 1)),
    spikes: predictedSpikes(hours, nowIndex),
    best: nowLocal ? bestTimeToGoOut(hours, nowLocal) : null,
    bestTomorrow: nowLocal ? tomorrowBest(hours, nowLocal) : null,
    modelCheck,
    banners,
  };
}
