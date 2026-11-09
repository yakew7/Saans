import type { Place } from "./places";

export const MAX_COMPARE = 4;

/** `?locs=lat,lon,name~lat,lon,name` (name is URI-encoded; max 4 places). */
export function serializeLocs(places: Place[]): string {
  return places
    .slice(0, MAX_COMPARE)
    .map((p) => `${p.lat.toFixed(3)},${p.lon.toFixed(3)},${encodeURIComponent(p.name)}`)
    .join("~");
}

export function parseLocs(value: string | null | undefined): Place[] {
  if (!value) return [];
  const out: Place[] = [];
  for (const part of value.split("~").slice(0, MAX_COMPARE)) {
    const [lat, lon, ...rest] = part.split(",");
    const la = Number(lat);
    const lo = Number(lon);
    if (!Number.isFinite(la) || !Number.isFinite(lo) || la < -90 || la > 90 || lo < -180 || lo > 180 || lat === "" || lon === "") continue;
    let name = "Place";
    try {
      name = decodeURIComponent(rest.join(",")).trim().slice(0, 60) || name;
    } catch {
      /* keep default name */
    }
    out.push({ name, lat: la, lon: lo });
  }
  return out;
}

export interface Rankable {
  name: string;
  aqi: number | null;
  /** true when the AQI comes from a station (measured or computed from measured values) */
  measured: boolean;
}

/**
 * "Relatively cleanest" among the locations that have data. Uses only measured-derived AQIs when
 * at least one location has one; otherwise falls back to modelled values and says so.
 */
export function cleanest(items: Rankable[]): { winner: Rankable | null; basis: "measured" | "modelled" | "none"; considered: number; missing: string[] } {
  const withData = items.filter((i) => i.aqi != null);
  const missing = items.filter((i) => i.aqi == null).map((i) => i.name);
  const measured = withData.filter((i) => i.measured);
  const pool = measured.length ? measured : withData;
  if (!pool.length) return { winner: null, basis: "none", considered: 0, missing };
  const winner = pool.reduce((m, i) => (i.aqi! < m.aqi! ? i : m));
  return { winner, basis: measured.length ? "measured" : "modelled", considered: pool.length, missing };
}
