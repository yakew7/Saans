import type { Meta } from "../types";
import { bearingLabel, haversineKm } from "../aqi/stats";
import { isStale } from "../format";
import { getWaqiBounds } from "./waqi";

export interface CleanStation {
  uid: number;
  name: string;
  aqi: number;
  distanceKm: number;
  /** compass direction from the search point to the station */
  direction: string;
  lat: number;
  lon: number;
  observedAt: string | null;
}

export interface CleanAirResponse {
  radiusKm: number;
  /** nearest live station to the search point, for comparison */
  nearest: CleanStation | null;
  cleanest: CleanStation[];
  /** live stations considered inside the radius */
  considered: number;
  meta: Meta | null;
  error?: string;
  code?: string;
}

/** Cleanest MEASURED stations (WAQI, last 3 h) within a radius of a point. */
export async function getCleanAir(lat: number, lon: number, radiusKm: number): Promise<CleanAirResponse> {
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const r = await getWaqiBounds(lat - dLat, lon - dLon, lat + dLat, lon + dLon);
  if (!r.ok || !r.data) return { radiusKm, nearest: null, cleanest: [], considered: 0, meta: r.meta, error: r.error, code: r.code };
  const inside: CleanStation[] = r.data
    .filter((s) => s.observedAt && !isStale(s.observedAt))
    .map((s) => ({
      uid: s.uid,
      name: s.name,
      aqi: Math.round(s.aqi),
      distanceKm: Math.round(haversineKm(lat, lon, s.lat, s.lon) * 10) / 10,
      direction: bearingLabel(lat, lon, s.lat, s.lon),
      lat: s.lat,
      lon: s.lon,
      observedAt: s.observedAt,
    }))
    .filter((s) => s.distanceKm <= radiusKm);
  const nearest = [...inside].sort((a, b) => a.distanceKm - b.distanceKm)[0] ?? null;
  const cleanest = [...inside].sort((a, b) => a.aqi - b.aqi || a.distanceKm - b.distanceKm).slice(0, 12);
  return { radiusKm, nearest, cleanest, considered: inside.length, meta: r.meta };
}
