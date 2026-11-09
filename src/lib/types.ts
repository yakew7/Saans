export type BadgeKind =
  | "MEASURED"
  | "FORECAST"
  | "MODELLED"
  | "HISTORICAL-MEASURED"
  | "COMPUTED"
  | "EXPERIMENTAL-ML";

export type PollutantId = "pm25" | "pm10" | "no2" | "so2" | "co" | "o3";

export const POLLUTANTS: PollutantId[] = ["pm25", "pm10", "no2", "so2", "co", "o3"];

export interface Meta {
  /** Human-readable source name, e.g. "OpenAQ" */
  source: string;
  kind: BadgeKind;
  /** ISO instant of the observation/forecast issue time, null if unknown */
  observedAt: string | null;
  /** ISO instant we fetched from the upstream */
  fetchedAt: string;
  stationName: string | null;
  stationDistanceKm: number | null;
  /** true when the observation is older than 3 hours */
  stale: boolean;
  /** true when served from our server cache */
  cached?: boolean;
}

export interface AdapterResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  /** upstream HTTP status when relevant */
  status?: number;
  meta: Meta;
}

export interface LatLon {
  lat: number;
  lon: number;
}
