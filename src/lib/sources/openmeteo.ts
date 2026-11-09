import { z } from "zod";
import type { AdapterResult } from "../types";
import { cached, TTL } from "../net/cache";
import { fetchJson } from "../net/http";
import { haversineKm } from "../aqi/stats";
import { baseMeta, failResult, fromError, okResult, Tracker } from "./util";

/**
 * Open-Meteo Air Quality (CAMS) + Geocoding. No key. Free for non-commercial use.
 * All values here are MODELLED (past/current, CAMS analysis) or FORECAST - never MEASURED.
 * Verified live: current, hourly with past_days (<= 92) + forecast_days (<= 7), start_date/end_date back to 2022.
 */
const AQ = "https://air-quality-api.open-meteo.com/v1/air-quality";
const GEO = "https://geocoding-api.open-meteo.com/v1/search";
const SOURCE = "Open-Meteo (CAMS)";

const HOURLY_VARS = "pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone,us_aqi,european_aqi";
const nums = z.array(z.number().nullable());

const AirResponse = z.object({
  latitude: z.number(),
  longitude: z.number(),
  utc_offset_seconds: z.number(),
  timezone: z.string().optional(),
  current: z
    .object({
      time: z.string(),
      us_aqi: z.number().nullable().optional(),
      european_aqi: z.number().nullable().optional(),
      pm2_5: z.number().nullable().optional(),
      pm10: z.number().nullable().optional(),
      nitrogen_dioxide: z.number().nullable().optional(),
      sulphur_dioxide: z.number().nullable().optional(),
      carbon_monoxide: z.number().nullable().optional(),
      ozone: z.number().nullable().optional(),
    })
    .optional(),
  hourly: z
    .object({
      time: z.array(z.string()),
      pm2_5: nums.optional(),
      pm10: nums.optional(),
      nitrogen_dioxide: nums.optional(),
      sulphur_dioxide: nums.optional(),
      carbon_monoxide: nums.optional(),
      ozone: nums.optional(),
      us_aqi: nums.optional(),
      european_aqi: nums.optional(),
    })
    .optional(),
});

/** Convert Open-Meteo local-time string (timezone=auto) to an ISO UTC instant using utc_offset_seconds. */
export function localToIso(local: string, offsetSeconds: number): string {
  const asUtc = Date.parse(`${local.length === 16 ? local : local.slice(0, 16)}:00Z`);
  return new Date(asUtc - offsetSeconds * 1000).toISOString();
}

export interface ModelledCurrent {
  lat: number;
  lon: number;
  usAqi: number | null;
  euAqi: number | null;
  pollutants: { pm25: number | null; pm10: number | null; no2: number | null; so2: number | null; co: number | null; o3: number | null };
  observedAt: string;
  gridDistanceKm: number;
}

export interface HourlyAir {
  lat: number;
  lon: number;
  /** ISO UTC instants */
  times: string[];
  pm25: (number | null)[];
  pm10: (number | null)[];
  no2: (number | null)[];
  so2: (number | null)[];
  co: (number | null)[];
  o3: (number | null)[];
  usAqi: (number | null)[];
  euAqi: (number | null)[];
  utcOffsetSeconds: number;
}

async function om(url: string, ttlMs: number, trk: Tracker) {
  const c = await cached(`om:${url}`, { ttlMs, maxStaleMs: TTL.staleFallback }, async () => {
    const { json } = await fetchJson(url, { source: SOURCE });
    return AirResponse.parse(json);
  });
  trk.add(c);
  return c;
}

const coord = (n: number) => n.toFixed(2);

export async function getOpenMeteoCurrent(lat: number, lon: number): Promise<AdapterResult<ModelledCurrent>> {
  try {
    const url = `${AQ}?latitude=${coord(lat)}&longitude=${coord(lon)}&current=us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone&timezone=auto`;
    const trk = new Tracker();
    const { value: r } = await om(url, TTL.live, trk);
    if (!r.current) return failResult(SOURCE, "MODELLED", "Open-Meteo returned no current block", "empty");
    const c = r.current;
    const observedAt = localToIso(c.time, r.utc_offset_seconds);
    const data: ModelledCurrent = {
      lat: r.latitude,
      lon: r.longitude,
      usAqi: c.us_aqi ?? null,
      euAqi: c.european_aqi ?? null,
      pollutants: { pm25: c.pm2_5 ?? null, pm10: c.pm10 ?? null, no2: c.nitrogen_dioxide ?? null, so2: c.sulphur_dioxide ?? null, co: c.carbon_monoxide ?? null, o3: c.ozone ?? null },
      observedAt,
      gridDistanceKm: Math.round(haversineKm(lat, lon, r.latitude, r.longitude) * 10) / 10,
    };
    return okResult(data, baseMeta(SOURCE, "MODELLED", { ...trk.meta(), observedAt, stationName: "CAMS model grid cell", stationDistanceKm: data.gridDistanceKm }));
  } catch (e) {
    return fromError(SOURCE, "MODELLED", e);
  }
}

function toHourly(r: z.infer<typeof AirResponse>): HourlyAir | null {
  const h = r.hourly;
  if (!h) return null;
  const n = h.time.length;
  const pad = (a?: (number | null)[]) => a ?? new Array<number | null>(n).fill(null);
  return {
    lat: r.latitude,
    lon: r.longitude,
    times: h.time.map((t) => localToIso(t, r.utc_offset_seconds)),
    pm25: pad(h.pm2_5),
    pm10: pad(h.pm10),
    no2: pad(h.nitrogen_dioxide),
    so2: pad(h.sulphur_dioxide),
    co: pad(h.carbon_monoxide),
    o3: pad(h.ozone),
    usAqi: pad(h.us_aqi),
    euAqi: pad(h.european_aqi),
    utcOffsetSeconds: r.utc_offset_seconds,
  };
}

/**
 * Hourly series around now: `pastDays` of CAMS analysis (MODELLED) + `forecastDays` of CAMS forecast.
 * Result kind is FORECAST when forecastDays > 0; callers split on "now" to badge each part.
 */
export async function getOpenMeteoHourly(lat: number, lon: number, pastDays: number, forecastDays: number): Promise<AdapterResult<HourlyAir>> {
  const kind = forecastDays > 0 ? "FORECAST" : "MODELLED";
  try {
    const url = `${AQ}?latitude=${coord(lat)}&longitude=${coord(lon)}&hourly=${HOURLY_VARS}&past_days=${Math.min(92, pastDays)}&forecast_days=${Math.min(7, Math.max(1, forecastDays))}&timezone=auto`;
    const trk = new Tracker();
    const c = await om(url, forecastDays > 0 ? TTL.forecast : TTL.history, trk);
    const data = toHourly(c.value);
    if (!data || !data.times.length) return failResult(SOURCE, kind, "Open-Meteo returned no hourly data", "empty");
    const issued = new Date(c.storedAt).toISOString();
    return okResult(data, baseMeta(SOURCE, kind, { ...trk.meta(), observedAt: issued, stationName: "CAMS model grid cell", stationDistanceKm: Math.round(haversineKm(lat, lon, data.lat, data.lon) * 10) / 10 }));
  } catch (e) {
    return fromError(SOURCE, kind, e);
  }
}

/** MODELLED hourly history for an explicit date range (YYYY-MM-DD, inclusive). */
export async function getOpenMeteoRange(lat: number, lon: number, start: string, end: string): Promise<AdapterResult<HourlyAir>> {
  try {
    const url = `${AQ}?latitude=${coord(lat)}&longitude=${coord(lon)}&hourly=${HOURLY_VARS}&start_date=${start}&end_date=${end}&timezone=auto`;
    const trk = new Tracker();
    const c = await om(url, TTL.history, trk);
    const data = toHourly(c.value);
    if (!data || !data.times.length) return failResult(SOURCE, "MODELLED", "Open-Meteo returned no data for this range", "empty");
    return okResult(data, baseMeta(SOURCE, "MODELLED", { ...trk.meta(), observedAt: data.times.at(-1) ?? null, stationName: "CAMS model grid cell", stationDistanceKm: Math.round(haversineKm(lat, lon, data.lat, data.lon) * 10) / 10 }));
  } catch (e) {
    return fromError(SOURCE, "MODELLED", e);
  }
}

const GeoResponse = z.object({
  results: z
    .array(
      z.object({
        id: z.number(),
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        country_code: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
        population: z.number().optional(),
      }),
    )
    .optional(),
});

export interface Place {
  id: number;
  name: string;
  lat: number;
  lon: number;
  country: string | null;
  countryCode: string | null;
  admin1: string | null;
  label: string;
}

export async function geocode(query: string, count = 8): Promise<AdapterResult<Place[]>> {
  const q = query.trim();
  if (q.length < 2) return okResult([], baseMeta("Open-Meteo Geocoding", "MEASURED"));
  try {
    const url = `${GEO}?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;
    const c = await cached(`geo:${url}`, { ttlMs: TTL.geocode, maxStaleMs: TTL.geocode }, async () => {
      const { json } = await fetchJson(url, { source: "Open-Meteo Geocoding" });
      return GeoResponse.parse(json);
    });
    const places: Place[] = (c.value.results ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      lat: r.latitude,
      lon: r.longitude,
      country: r.country ?? null,
      countryCode: r.country_code ?? null,
      admin1: r.admin1 ?? null,
      label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    }));
    return okResult(places, baseMeta("Open-Meteo Geocoding", "MEASURED"));
  } catch (e) {
    return fromError("Open-Meteo Geocoding", "MEASURED", e);
  }
}
