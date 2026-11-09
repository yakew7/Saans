import type { Meta } from "../types";
import { CITIES, type City } from "../cities";
import { cached } from "../net/cache";
import { mean } from "../aqi/stats";
import { isStale } from "../format";
import { getOpenMeteoCurrentMany } from "./openmeteo";
import { getWaqiBounds } from "./waqi";

export interface LeaderboardRow {
  city: string;
  country: string;
  india: boolean;
  lat: number;
  lon: number;
  aqi: number;
  stations: number;
  /** newest station reading used */
  observedAt: string | null;
}

export interface LeaderboardResponse {
  /** ranked by MEASURED station AQI (mean of the city's fresh stations), worst first */
  measured: LeaderboardRow[];
  /** cities with no fresh station data: CAMS modelled estimate, ranked separately */
  modelled: LeaderboardRow[];
  /** cities with no data from either source */
  unavailable: string[];
  measuredMeta: Meta | null;
  modelledMeta: Meta | null;
  generatedAt: string;
}

const HALF = 0.3; // degrees around the city centre (~33 km)

async function build(): Promise<LeaderboardResponse> {
  const results = await Promise.all(
    CITIES.map(async (c: City) => ({ c, r: await getWaqiBounds(c.lat - HALF, c.lon - HALF, c.lat + HALF, c.lon + HALF) })),
  );
  const measured: LeaderboardRow[] = [];
  const need: City[] = [];
  let measuredMeta: Meta | null = null;
  for (const { c, r } of results) {
    // only stations reporting within the last 3 hours count as "live"
    const fresh = r.ok ? (r.data ?? []).filter((s) => s.observedAt && !isStale(s.observedAt)) : [];
    if (r.ok && fresh.length) {
      measuredMeta ??= r.meta;
      const newest = fresh.map((s) => s.observedAt!).sort().at(-1) ?? null;
      measured.push({ city: c.name, country: c.country, india: !!c.india, lat: c.lat, lon: c.lon, aqi: Math.round(mean(fresh.map((s) => s.aqi))!), stations: fresh.length, observedAt: newest });
    } else need.push(c);
  }
  measured.sort((a, b) => b.aqi - a.aqi);

  const modelled: LeaderboardRow[] = [];
  const unavailable: string[] = [];
  let modelledMeta: Meta | null = null;
  if (need.length) {
    const m = await getOpenMeteoCurrentMany(need);
    if (m.ok && m.data) {
      modelledMeta = m.meta;
      need.forEach((c, i) => {
        const d = m.data![i];
        if (d?.usAqi != null) modelled.push({ city: c.name, country: c.country, india: !!c.india, lat: c.lat, lon: c.lon, aqi: d.usAqi, stations: 0, observedAt: d.observedAt });
        else unavailable.push(c.name);
      });
    } else unavailable.push(...need.map((c) => c.name));
  }
  modelled.sort((a, b) => b.aqi - a.aqi);
  return { measured, modelled, unavailable, measuredMeta, modelledMeta, generatedAt: new Date().toISOString() };
}

/** Server-cached for 5 minutes (WAQI-derived data is cached for minutes only, never persisted). */
export async function getLeaderboard(): Promise<LeaderboardResponse> {
  const c = await cached("leaderboard", { ttlMs: 5 * 60_000, maxStaleMs: 5 * 60_000 }, build);
  return c.value;
}
