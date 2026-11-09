import { z } from "zod";
import type { AdapterResult, PollutantId } from "../types";
import { cached, TTL } from "../net/cache";
import { fetchJson } from "../net/http";
import { haversineKm } from "../aqi/stats";
import { baseMeta, failResult, fromError, okResult, Tracker } from "./util";

/**
 * WAQI adapter (token via ?token=, server only).
 * Terms: do not redistribute cached/archived data. We cache minutes only (TTL.waqi) and never persist.
 * NOTE: `iaqi` values are per-pollutant AQI SUB-INDICES, not µg/m³.
 * Verified live: /feed/geo:lat;lon/, /v2/map/bounds, /v2/search.
 */
const BASE = "https://api.waqi.info";
const SOURCE = "WAQI";

const aqiNum = z
  .union([z.number(), z.string()])
  .nullable()
  .optional()
  .transform((v) => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    const n = Number(v);
    return v.trim() !== "" && v !== "-" && Number.isFinite(n) ? n : null;
  });

const Envelope = z.object({ status: z.string(), data: z.unknown() });

const ForecastDay = z.object({ avg: z.number(), day: z.string(), max: z.number(), min: z.number() });
const Feed = z.object({
  aqi: aqiNum,
  idx: z.number().optional(),
  city: z.object({ name: z.string(), geo: z.array(z.number()).length(2) }),
  dominentpol: z.string().optional(),
  iaqi: z.record(z.string(), z.object({ v: z.number() })).optional(),
  time: z.object({ v: z.number().optional(), iso: z.string().optional() }),
  forecast: z.object({ daily: z.record(z.string(), z.array(ForecastDay)).optional() }).optional(),
});
const MapBounds = z.array(
  z.object({
    lat: z.number(),
    lon: z.number(),
    uid: z.number(),
    aqi: aqiNum,
    station: z.object({ name: z.string(), time: z.string().optional() }),
  }),
);
const Search = z.array(
  z.object({
    uid: z.number(),
    aqi: aqiNum,
    time: z.object({ stime: z.string().optional() }).optional(),
    station: z.object({ name: z.string(), geo: z.array(z.number()).length(2).optional() }),
  }),
);

function token(): string | null {
  const t = process.env.WAQI_API_TOKEN;
  return t && t.trim() ? t.trim() : null;
}

async function waqi(path: string, tok: string, trk: Tracker): Promise<unknown> {
  const sep = path.includes("?") ? "&" : "?";
  const c = await cached(`waqi:${path}`, { ttlMs: TTL.waqi, maxStaleMs: TTL.waqiMaxStale }, async () => {
    const { json } = await fetchJson(`${BASE}${path}${sep}token=${encodeURIComponent(tok)}`, { source: SOURCE });
    const env = Envelope.parse(json);
    if (env.status !== "ok") throw Object.assign(new Error(typeof env.data === "string" ? env.data : "WAQI error"), { name: "WaqiError" });
    return env.data;
  });
  trk.add(c);
  return c.value;
}

const SUB_MAP: Record<string, PollutantId> = { pm25: "pm25", pm10: "pm10", no2: "no2", so2: "so2", co: "co", o3: "o3" };

export interface WaqiForecastDay {
  day: string;
  avg: number;
  min: number;
  max: number;
}

export interface WaqiFeed {
  uid: number | null;
  aqi: number | null;
  dominant: PollutantId | null;
  stationName: string;
  lat: number;
  lon: number;
  distanceKm: number | null;
  observedAt: string | null;
  /** per-pollutant AQI sub-indices (NOT µg/m³) */
  subIndices: Partial<Record<PollutantId, number>>;
  /** daily AQI sub-index forecasts from WAQI */
  forecast: Partial<Record<"pm25" | "pm10" | "o3" | "uvi", WaqiForecastDay[]>>;
}

function parseFeed(raw: unknown, from?: { lat: number; lon: number }): WaqiFeed {
  const f = Feed.parse(raw);
  const [lat, lon] = f.city.geo;
  const subIndices: WaqiFeed["subIndices"] = {};
  for (const [k, v] of Object.entries(f.iaqi ?? {})) {
    const id = SUB_MAP[k];
    if (id) subIndices[id] = v.v;
  }
  const observedAt = f.time.iso ?? (f.time.v ? new Date(f.time.v * 1000).toISOString() : null);
  const dom = f.dominentpol ? SUB_MAP[f.dominentpol] ?? null : null;
  return {
    uid: f.idx ?? null,
    aqi: f.aqi,
    dominant: dom,
    stationName: f.city.name,
    lat,
    lon,
    distanceKm: from ? Math.round(haversineKm(from.lat, from.lon, lat, lon) * 10) / 10 : null,
    observedAt: observedAt ? new Date(observedAt).toISOString() : null,
    subIndices,
    forecast: (f.forecast?.daily ?? {}) as WaqiFeed["forecast"],
  };
}

function feedResult(data: WaqiFeed, trk: Tracker): AdapterResult<WaqiFeed> {
  return okResult(data, baseMeta(SOURCE, "MEASURED", { ...trk.meta(), observedAt: data.observedAt, stationName: data.stationName, stationDistanceKm: data.distanceKm }));
}

export const WAQI_MAX_DISTANCE_KM = 50;

/**
 * Nearest WAQI station to a coordinate. We do NOT use /feed/geo: (it can return a station
 * hundreds of km away). Instead: map bounds box -> nearest station with a numeric AQI -> /feed/@uid.
 * Stations farther than WAQI_MAX_DISTANCE_KM are rejected as "no nearby station".
 */
export async function getWaqiFeedGeo(lat: number, lon: number): Promise<AdapterResult<WaqiFeed>> {
  const tok = token();
  if (!tok) return failResult(SOURCE, "MEASURED", "WAQI_API_TOKEN is not configured", "no_key");
  const trk = new Tracker();
  try {
    let best: { p: WaqiStationPoint; d: number } | null = null;
    for (const half of [0.25, 0.6]) {
      const b = await getWaqiBounds(lat - half, lon - half, lat + half, lon + half);
      if (!b.ok) return failResult(SOURCE, "MEASURED", b.error ?? "WAQI bounds lookup failed", b.code ?? "upstream", b.status);
      trk.add({ storedAt: Date.parse(b.meta.fetchedAt), fromCache: !!b.meta.cached, stale: !!b.meta.servedStale });
      const fresh = (b.data ?? []).filter((p) => !p.observedAt || Date.now() - Date.parse(p.observedAt) < 24 * 3_600_000);
      const scored = fresh.map((p) => ({ p, d: haversineKm(lat, lon, p.lat, p.lon) })).sort((x, y) => x.d - y.d);
      if (scored.length && scored[0].d <= WAQI_MAX_DISTANCE_KM) {
        best = scored[0];
        break;
      }
    }
    if (!best) return failResult(SOURCE, "MEASURED", `No WAQI station with current data within ${WAQI_MAX_DISTANCE_KM} km`, "empty");
    const raw = await waqi(`/feed/@${best.p.uid}/`, tok, trk);
    const data = parseFeed(raw, { lat, lon });
    if (data.aqi == null && !Object.keys(data.subIndices).length) return failResult(SOURCE, "MEASURED", "Nearest WAQI station reports no current values", "empty");
    return feedResult(data, trk);
  } catch (e) {
    if (e instanceof Error && e.name === "WaqiError") return failResult(SOURCE, "MEASURED", e.message, "empty");
    return fromError(SOURCE, "MEASURED", e);
  }
}

/** A specific WAQI station by uid (used by the map side panel). */
export async function getWaqiFeedByUid(uid: number): Promise<AdapterResult<WaqiFeed>> {
  const tok = token();
  if (!tok) return failResult(SOURCE, "MEASURED", "WAQI_API_TOKEN is not configured", "no_key");
  const trk = new Tracker();
  try {
    return feedResult(parseFeed(await waqi(`/feed/@${uid}/`, tok, trk)), trk);
  } catch (e) {
    if (e instanceof Error && e.name === "WaqiError") return failResult(SOURCE, "MEASURED", e.message, "empty");
    return fromError(SOURCE, "MEASURED", e);
  }
}

export interface WaqiStationPoint {
  uid: number;
  lat: number;
  lon: number;
  aqi: number;
  name: string;
  observedAt: string | null;
}

/** Stations inside a bounding box (map, heatmap, hotspots, clean-air finder). Stations without a numeric AQI are dropped. */
export async function getWaqiBounds(south: number, west: number, north: number, east: number): Promise<AdapterResult<WaqiStationPoint[]>> {
  const tok = token();
  if (!tok) return failResult(SOURCE, "MEASURED", "WAQI_API_TOKEN is not configured", "no_key");
  const trk = new Tracker();
  try {
    const q = [south, west, north, east].map((n) => n.toFixed(3)).join(",");
    const rows = MapBounds.parse(await waqi(`/v2/map/bounds?latlng=${q}&networks=all`, tok, trk));
    const pts: WaqiStationPoint[] = [];
    for (const r of rows) {
      if (r.aqi == null) continue;
      const t = r.station.time ? Date.parse(r.station.time) : NaN;
      pts.push({ uid: r.uid, lat: r.lat, lon: r.lon, aqi: r.aqi, name: r.station.name, observedAt: Number.isNaN(t) ? null : new Date(t).toISOString() });
    }
    const newest = pts.map((p) => p.observedAt).filter(Boolean).sort().at(-1) ?? null;
    return okResult(pts, baseMeta(SOURCE, "MEASURED", { ...trk.meta(), observedAt: newest }));
  } catch (e) {
    return fromError(SOURCE, "MEASURED", e);
  }
}

export async function searchWaqi(keyword: string): Promise<AdapterResult<{ uid: number; name: string; aqi: number | null; lat: number | null; lon: number | null }[]>> {
  const tok = token();
  if (!tok) return failResult(SOURCE, "MEASURED", "WAQI_API_TOKEN is not configured", "no_key");
  const trk = new Tracker();
  try {
    const rows = Search.parse(await waqi(`/v2/search/?keyword=${encodeURIComponent(keyword)}`, tok, trk));
    const data = rows.map((r) => ({ uid: r.uid, name: r.station.name, aqi: r.aqi, lat: r.station.geo?.[0] ?? null, lon: r.station.geo?.[1] ?? null }));
    return okResult(data, baseMeta(SOURCE, "MEASURED", trk.meta()));
  } catch (e) {
    return fromError(SOURCE, "MEASURED", e);
  }
}
