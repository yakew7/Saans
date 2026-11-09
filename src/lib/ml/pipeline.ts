import type { Meta } from "../types";
import { cached } from "../net/cache";
import { getOpenAqHourlyPm25 } from "../sources/openaq";
import { getOpenMeteoHourly } from "../sources/openmeteo";
import { getWeatherHourly } from "../sources/weather";
import { fitFinal, backtestHorizon, HORIZONS, predictAt, FEATURE_NAMES, type Grid, type HorizonResult } from "./model";
import { rmse } from "./ridge";

export interface MlResponse {
  ok: boolean;
  reason?: string;
  station?: { name: string; distanceKm: number };
  training?: { days: number; hourlyRows: number; from: string; to: string };
  origin?: string;
  horizons: HorizonResult[];
  verdict?: {
    /** MAE at the 24 h horizon */
    beatsPersistence24h: boolean;
    beatsCams24h: boolean;
    improvementVsPersistence24hPct: number;
    horizonsBeatingPersistence: number;
    horizonsTested: number;
  };
  history: { t: string; local: string; measured: number | null; cams: number | null }[];
  forecast: { t: string; local: string; ml: number; cams: number | null; lo: number; hi: number }[];
  features: string[];
  meta: Meta | null;
  oaqMeta: Meta | null;
}

const TRAIN_DAYS = 60;
const hourKey = (iso: string) => Math.floor(Date.parse(iso) / 3_600_000);

function empty(reason: string): MlResponse {
  return { ok: false, reason, horizons: [], history: [], forecast: [], features: FEATURE_NAMES, meta: null, oaqMeta: null };
}

async function run(lat: number, lon: number): Promise<MlResponse> {
  const [oaq, cams, wx] = await Promise.all([getOpenAqHourlyPm25(lat, lon, 90), getOpenMeteoHourly(lat, lon, 70, 3), getWeatherHourly(lat, lon, 70, 3)]);
  if (!oaq.ok || !oaq.data) return empty(`Needs a nearby station with measured hourly PM2.5 history: ${oaq.error ?? "unavailable"}.`);
  if (!cams.ok || !cams.data) return empty(`The CAMS model data needed for features is unavailable: ${cams.error}.`);
  if (!wx.ok || !wx.data) return empty(`Weather data needed for features is unavailable: ${wx.error}.`);

  const camsD = cams.data;
  const wxD = wx.data;
  // build one hourly grid keyed by UTC hour bucket
  const lastObs = oaq.data.points.filter((p) => p.v != null).at(-1);
  if (!lastObs) return empty("The nearest station has no recent PM2.5 values.");
  const endKey = Math.max(hourKey(camsD.times.at(-1)!), hourKey(wxD.times.at(-1)!));
  const startKey = endKey - (TRAIN_DAYS + 4) * 24;
  const N = endKey - startKey + 1;
  const mk = () => new Array<number | null>(N).fill(null);
  const g: Grid = { start: startKey * 3_600_000, utcOffsetSeconds: camsD.utcOffsetSeconds, pm: mk(), cams: mk(), temp: mk(), rh: mk(), wind: mk(), blh: mk(), precip: mk() };
  const put = (arr: (number | null)[], iso: string, v: number | null) => {
    const i = hourKey(iso) - startKey;
    if (i >= 0 && i < N) arr[i] = v;
  };
  oaq.data.points.forEach((p) => put(g.pm, p.t, p.v));
  camsD.times.forEach((t, i) => put(g.cams, t, camsD.pm25[i]));
  wxD.times.forEach((t, i) => {
    put(g.temp, t, wxD.temp[i]);
    put(g.rh, t, wxD.rh[i]);
    put(g.wind, t, wxD.wind[i]);
    put(g.blh, t, wxD.blh[i]);
    put(g.precip, t, wxD.precip[i]);
  });

  const originIdx = hourKey(lastObs.t) - startKey;
  const nowIdx = Math.floor(Date.now() / 3_600_000) - startKey;
  if (nowIdx - originIdx > 6) return empty(`The latest measured hour at ${oaq.data.stationName} is ${nowIdx - originIdx} hours old, too stale for a short-term prediction.`);
  // hours after the last observation are unknown: blank them (training uses only real measurements)
  for (let i = originIdx + 1; i < N; i++) g.pm[i] = null;

  const trainPm = g.pm.filter((v) => v != null).length;
  if (trainPm < 24 * 25) return empty(`Only ${trainPm} measured hours are available in the last ${TRAIN_DAYS} days; at least ${24 * 25} are needed.`);

  const horizons: HorizonResult[] = [];
  const models = new Map<number, NonNullable<ReturnType<typeof fitFinal>>>();
  for (const h of HORIZONS) {
    const bt = backtestHorizon(g, h);
    const m = fitFinal(g, h);
    if (bt && m) {
      horizons.push(bt);
      models.set(h, m);
    }
  }
  if (!models.size) return empty("Too many gaps in the measured, CAMS or weather data to train a model with enough samples.");

  const modelHs = [...models.keys()];
  const nearest = (h: number) => modelHs.reduce((b, x) => (Math.abs(x - h) < Math.abs(b - h) ? x : b));
  const forecast: MlResponse["forecast"] = [];
  const rmseBy = new Map(horizons.map((r) => [r.h, r.ml.rmse]));
  for (let h = 1; h <= 48; h++) {
    const mh = nearest(h);
    const y = predictAt(models.get(mh)!, g, originIdx, h);
    if (y == null) continue;
    const e = rmseBy.get(mh) ?? 0;
    const k = originIdx + h;
    const iso = new Date((startKey + k) * 3_600_000).toISOString();
    const local = new Date((startKey + k) * 3_600_000 + camsD.utcOffsetSeconds * 1000).toISOString().slice(0, 16);
    forecast.push({ t: iso, local, ml: Math.round(y * 10) / 10, cams: g.cams[k], lo: Math.max(0, Math.round((y - e) * 10) / 10), hi: Math.round((y + e) * 10) / 10 });
  }

  const h24 = horizons.find((r) => r.h === 24) ?? horizons[Math.floor(horizons.length / 2)];
  const history = Array.from({ length: 48 }, (_, i) => {
    const k = originIdx - 47 + i;
    return {
      t: new Date((startKey + k) * 3_600_000).toISOString(),
      local: new Date((startKey + k) * 3_600_000 + camsD.utcOffsetSeconds * 1000).toISOString().slice(0, 16),
      measured: g.pm[k] ?? null,
      cams: g.cams[k] ?? null,
    };
  });
  void rmse;
  return {
    ok: true,
    station: { name: oaq.data.stationName, distanceKm: oaq.data.distanceKm },
    training: { days: TRAIN_DAYS, hourlyRows: trainPm, from: new Date(startKey * 3_600_000).toISOString().slice(0, 10), to: new Date((startKey + originIdx) * 3_600_000).toISOString().slice(0, 10) },
    origin: new Date((startKey + originIdx) * 3_600_000).toISOString(),
    horizons,
    verdict: {
      beatsPersistence24h: h24.ml.mae < h24.persistence.mae,
      beatsCams24h: h24.ml.mae < h24.cams.mae,
      improvementVsPersistence24hPct: ((h24.persistence.mae - h24.ml.mae) / h24.persistence.mae) * 100,
      horizonsBeatingPersistence: horizons.filter((r) => r.ml.mae < r.persistence.mae).length,
      horizonsTested: horizons.length,
    },
    history,
    forecast,
    features: FEATURE_NAMES,
    meta: cams.meta,
    oaqMeta: oaq.meta,
  };
}

/** Cached 3 h per location (training is cheap, but upstream data changes slowly). */
export async function getMlPrediction(lat: number, lon: number): Promise<MlResponse> {
  const c = await cached(`ml:${lat.toFixed(2)},${lon.toFixed(2)}`, { ttlMs: 3 * 3_600_000, maxStaleMs: 3 * 3_600_000 }, () => run(lat, lon));
  return c.value;
}
