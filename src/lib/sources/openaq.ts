import { z } from "zod";
import type { AdapterResult, PollutantId } from "../types";
import { cached, TTL } from "../net/cache";
import { fetchJson } from "../net/http";
import { haversineKm } from "../aqi/stats";
import { baseMeta, failResult, fromError, okResult } from "./util";

/**
 * OpenAQ v3 adapter. Header X-API-Key (server only). Rate limit 60 req/min (see x-ratelimit-* headers).
 * Verified live: /locations (coordinates+radius), /locations/{id}/latest, /sensors/{id}/days (date_from/date_to), /sensors/{id}/hours (datetime_from/datetime_to).
 */
const BASE = "https://api.openaq.org/v3";
const SOURCE = "OpenAQ";
export const OPENAQ_RADIUS_M = 25_000; // API maximum

const Sensor = z.object({
  id: z.number(),
  parameter: z.object({ id: z.number(), name: z.string(), units: z.string() }),
});
const Location = z.object({
  id: z.number(),
  name: z.string().nullable().optional(),
  coordinates: z.object({ latitude: z.number(), longitude: z.number() }),
  datetimeFirst: z.object({ utc: z.string() }).nullable().optional(),
  datetimeLast: z.object({ utc: z.string() }).nullable().optional(),
  provider: z.object({ name: z.string() }).nullable().optional(),
  sensors: z.array(Sensor),
});
const LocationsResponse = z.object({ results: z.array(Location) });
const LatestResponse = z.object({
  results: z.array(z.object({ datetime: z.object({ utc: z.string() }), value: z.number().nullable(), sensorsId: z.number() })),
});
const DaysResponse = z.object({
  results: z.array(
    z.object({
      value: z.number().nullable(),
      period: z.object({ datetimeFrom: z.object({ local: z.string() }) }),
      coverage: z.object({ percentComplete: z.number().nullable().optional() }).nullable().optional(),
    }),
  ),
});

type OaqLocation = z.infer<typeof Location>;

const PARAM_MAP: Record<string, PollutantId> = { pm25: "pm25", pm10: "pm10", no2: "no2", so2: "so2", co: "co", o3: "o3" };

export interface StationReading {
  stationId: number;
  stationName: string;
  lat: number;
  lon: number;
  distanceKm: number;
  provider: string | null;
  pollutants: Partial<Record<PollutantId, { value: number; unit: string; observedAt: string }>>;
  observedAt: string;
}

function apiKey(): string | null {
  const k = process.env.OPENAQ_API_KEY;
  return k && k.trim() ? k.trim() : null;
}

async function oaq(path: string, ttlMs: number, key: string): Promise<unknown> {
  const c = await cached(`oaq:${path}`, { ttlMs, maxStaleMs: TTL.staleFallback }, async () => {
    const { json } = await fetchJson(`${BASE}${path}`, { source: SOURCE, headers: { "X-API-Key": key } });
    return json;
  });
  return c.value;
}

const r2 = (n: number) => n.toFixed(2);

async function nearbyLocations(lat: number, lon: number, key: string): Promise<OaqLocation[]> {
  const path = `/locations?coordinates=${r2(lat)},${r2(lon)}&radius=${OPENAQ_RADIUS_M}&limit=100`;
  return LocationsResponse.parse(await oaq(path, TTL.live, key)).results;
}

async function latestFor(locationId: number, key: string) {
  return LatestResponse.parse(await oaq(`/locations/${locationId}/latest`, TTL.live, key)).results;
}

const hasPm = (l: OaqLocation) => l.sensors.some((s) => s.parameter.name === "pm25" || s.parameter.name === "pm10");

/** Nearest active OpenAQ station with fresh particulate data, with its latest value per pollutant. */
export async function getOpenAqLatest(lat: number, lon: number): Promise<AdapterResult<StationReading>> {
  const key = apiKey();
  if (!key) return failResult(SOURCE, "MEASURED", "OPENAQ_API_KEY is not configured", "no_key");
  try {
    const locs = await nearbyLocations(lat, lon, key);
    const dayAgo = Date.now() - 24 * 3_600_000;
    const candidates = locs
      .filter((l) => hasPm(l) && l.datetimeLast && Date.parse(l.datetimeLast.utc) > dayAgo)
      .map((l) => ({ l, d: haversineKm(lat, lon, l.coordinates.latitude, l.coordinates.longitude) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    if (!candidates.length) return failResult(SOURCE, "MEASURED", "No active OpenAQ station with particulate data within 25 km", "empty");

    for (const { l, d } of candidates) {
      const latest = await latestFor(l.id, key);
      const sensorParam = new Map(l.sensors.map((s) => [s.id, s.parameter]));
      const pollutants: StationReading["pollutants"] = {};
      for (const rec of latest) {
        const p = sensorParam.get(rec.sensorsId);
        const id = p ? PARAM_MAP[p.name] : undefined;
        if (!p || !id || rec.value == null || rec.value < 0) continue;
        const prev = pollutants[id];
        if (!prev || Date.parse(rec.datetime.utc) > Date.parse(prev.observedAt)) {
          pollutants[id] = { value: rec.value, unit: p.units, observedAt: rec.datetime.utc };
        }
      }
      const pm = pollutants.pm25 ?? pollutants.pm10;
      // ignore ancient values: require the particulate reading to be < 24 h old
      if (!pm || Date.parse(pm.observedAt) < dayAgo) continue;
      for (const [k, v] of Object.entries(pollutants) as [PollutantId, { observedAt: string }][]) {
        if (Date.parse(v.observedAt) < dayAgo) delete pollutants[k];
      }
      const data: StationReading = {
        stationId: l.id,
        stationName: l.name ?? `Station ${l.id}`,
        lat: l.coordinates.latitude,
        lon: l.coordinates.longitude,
        distanceKm: Math.round(d * 10) / 10,
        provider: l.provider?.name ?? null,
        pollutants,
        observedAt: pm.observedAt,
      };
      return okResult(data, baseMeta(SOURCE, "MEASURED", { observedAt: data.observedAt, stationName: data.stationName, stationDistanceKm: data.distanceKm }));
    }
    return failResult(SOURCE, "MEASURED", "Nearby OpenAQ stations have no recent particulate readings", "empty");
  } catch (e) {
    return fromError(SOURCE, "MEASURED", e);
  }
}

export interface DailyPoint {
  date: string;
  value: number;
  coveragePct: number | null;
}
export interface OpenAqDaily {
  stationId: number;
  stationName: string;
  distanceKm: number;
  provider: string | null;
  pm25: DailyPoint[];
  pm10: DailyPoint[];
}

/**
 * HISTORICAL-MEASURED daily means from the nearest OpenAQ station that has data in [from, to].
 * Days with < 50 % hourly coverage are dropped. Dates are station-local calendar days.
 */
export async function getOpenAqDaily(lat: number, lon: number, from: string, to: string): Promise<AdapterResult<OpenAqDaily>> {
  const key = apiKey();
  if (!key) return failResult(SOURCE, "HISTORICAL-MEASURED", "OPENAQ_API_KEY is not configured", "no_key");
  try {
    const locs = await nearbyLocations(lat, lon, key);
    const fromMs = Date.parse(from);
    const toMs = Date.parse(to);
    const candidates = locs
      .filter((l) => {
        const first = l.datetimeFirst ? Date.parse(l.datetimeFirst.utc) : NaN;
        const last = l.datetimeLast ? Date.parse(l.datetimeLast.utc) : NaN;
        return l.sensors.some((s) => s.parameter.name === "pm25") && first <= toMs && last >= fromMs;
      })
      .map((l) => ({ l, d: haversineKm(lat, lon, l.coordinates.latitude, l.coordinates.longitude) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    if (!candidates.length) return failResult(SOURCE, "HISTORICAL-MEASURED", "No OpenAQ station within 25 km has data for this period", "empty");

    for (const { l, d } of candidates) {
      const out: OpenAqDaily = { stationId: l.id, stationName: l.name ?? `Station ${l.id}`, distanceKm: Math.round(d * 10) / 10, provider: l.provider?.name ?? null, pm25: [], pm10: [] };
      const latest = await latestFor(l.id, key).catch(() => []);
      const freshness = new Map(latest.map((r) => [r.sensorsId, Date.parse(r.datetime.utc)]));
      for (const name of ["pm25", "pm10"] as const) {
        const sensors = l.sensors.filter((s) => s.parameter.name === name).sort((a, b) => (freshness.get(b.id) ?? 0) - (freshness.get(a.id) ?? 0));
        for (const s of sensors.slice(0, 2)) {
          // NB: /days filters with date_from/date_to (datetime_* is silently ignored; only /hours uses datetime_*)
          const path = `/sensors/${s.id}/days?date_from=${from}&date_to=${to}&limit=1000`;
          const res = DaysResponse.parse(await oaq(path, TTL.history, key));
          const pts = res.results
            .filter((r) => r.value != null && r.value >= 0 && (r.coverage?.percentComplete ?? 100) >= 50)
            .map((r) => ({ date: r.period.datetimeFrom.local.slice(0, 10), value: r.value as number, coveragePct: r.coverage?.percentComplete ?? null }));
          if (pts.length) {
            out[name] = pts;
            break;
          }
        }
      }
      if (out.pm25.length || out.pm10.length) {
        const observedAt = [...out.pm25, ...out.pm10].map((p) => p.date).sort().at(-1) ?? null;
        return okResult(out, baseMeta(SOURCE, "HISTORICAL-MEASURED", { observedAt: observedAt ? `${observedAt}T00:00:00Z` : null, stationName: out.stationName, stationDistanceKm: out.distanceKm }));
      }
    }
    return failResult(SOURCE, "HISTORICAL-MEASURED", "No daily particulate data from nearby OpenAQ stations for this period", "empty");
  } catch (e) {
    return fromError(SOURCE, "HISTORICAL-MEASURED", e);
  }
}
