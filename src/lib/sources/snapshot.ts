import type { AdapterResult, BadgeKind, Meta, PollutantId } from "../types";
import { POLLUTANTS } from "../types";
import { computeEpaAqi, EPA_FORMULA } from "../aqi/epa";
import { computePmNaqi } from "../aqi/naqi";
import { avg24h, NOWCAST_FORMULA, nowcast } from "../aqi/nowcast";
import { agoLabel, minutesAgo } from "../format";
import { getOpenAqLatest, type StationReading } from "./openaq";
import { getWaqiFeedGeo, WAQI_MAX_DISTANCE_KM, type WaqiFeed } from "./waqi";
import { getOpenMeteoCurrent, type ModelledCurrent } from "./openmeteo";

export interface PollutantEntry {
  id: PollutantId;
  value: number | null;
  unit: string | null;
  /** "concentration" = µg/m³ style raw value; "subindex" = WAQI per-pollutant AQI sub-index (NOT a concentration) */
  basis: "concentration" | "subindex";
  observedAt: string | null;
  /** 24 h mean (PM only, OpenAQ) */
  avg24?: number | null;
}

export interface NaqiInfo {
  aqi: number;
  dominant: PollutantId;
  basis: string;
}

export interface Primary {
  key: "openaq" | "waqi" | "open-meteo";
  /** badge for the pollutant values */
  valueBadge: BadgeKind;
  aqi: number | null;
  aqiBadge: BadgeKind;
  aqiDetail: string;
  dominant: PollutantId | null;
  pollutants: PollutantEntry[];
  naqi: NaqiInfo | null;
  euAqi?: number | null;
  meta: Meta;
}

export interface Banner {
  id: string;
  severity: "info" | "warn" | "error";
  source: string;
  message: string;
}

export interface ChainStep {
  source: string;
  status: "ok" | "empty" | "error" | "no_key" | "not_needed";
  message?: string;
}

export interface CrossCheck {
  openaqAqi: number;
  waqiAqi: number;
  diffPct: number;
  disagree: boolean;
  openaqStation: string;
  waqiStation: string;
  sameStation: boolean;
}

export interface AirSnapshot {
  location: { lat: number; lon: number };
  primary: Primary | null;
  /** every source that returned data (primary included), for side-by-side views */
  alternatives: Primary[];
  crossCheck: CrossCheck | null;
  banners: Banner[];
  chain: ChainStep[];
  generatedAt: string;
}

const EMPTY_ENTRIES = (basis: PollutantEntry["basis"]): PollutantEntry[] =>
  POLLUTANTS.map((id) => ({ id, value: null, unit: null, basis, observedAt: null }));

/** Latest-hour -> NowCast AQI for OpenAQ raw particulates. Returns computed AQI + dominant pollutant. */
export function buildOpenAqPrimary(r: AdapterResult<StationReading>): Primary | null {
  if (!r.ok || !r.data) return null;
  const d = r.data;
  const entries = EMPTY_ENTRIES("concentration");
  for (const e of entries) {
    const p = d.pollutants[e.id];
    if (p) {
      e.value = p.value;
      e.unit = p.unit;
      e.observedAt = p.observedAt;
    }
    if (e.id === "pm25" || e.id === "pm10") {
      const series = d.recent[e.id]?.map((h) => h.v);
      if (series?.length) e.avg24 = avg24h(series);
    }
  }
  const nc: Partial<Record<PollutantId, number | null>> = {};
  const usedNowcast: string[] = [];
  for (const id of ["pm25", "pm10"] as const) {
    const series = d.recent[id]?.map((h) => h.v);
    const n = series?.length ? nowcast(series) : null;
    if (n != null) {
      nc[id] = n;
      usedNowcast.push(id);
    } else if (d.pollutants[id]) {
      nc[id] = d.pollutants[id]!.value; // fall back to latest hourly value
    }
  }
  const computed = computeEpaAqi(nc);
  const pm25 = entries.find((e) => e.id === "pm25")!;
  const pm10 = entries.find((e) => e.id === "pm10")!;
  const naqi = computePmNaqi({ pm25: pm25.avg24, pm10: pm10.avg24 });
  return {
    key: "openaq",
    valueBadge: "MEASURED",
    aqi: computed?.aqi ?? null,
    aqiBadge: "COMPUTED",
    aqiDetail: `${usedNowcast.length ? NOWCAST_FORMULA : "Latest hourly reading (NowCast needs more hourly data)."} ${EPA_FORMULA}`,
    dominant: computed?.dominant ?? null,
    pollutants: entries,
    naqi: naqi ? { aqi: naqi.aqi, dominant: naqi.dominant, basis: "24 h mean PM2.5 / PM10 (OpenAQ hourly)" } : null,
    meta: r.meta,
  };
}

export function buildWaqiPrimary(r: AdapterResult<WaqiFeed>): Primary | null {
  if (!r.ok || !r.data) return null;
  const d = r.data;
  const entries = EMPTY_ENTRIES("subindex");
  for (const e of entries) {
    const v = d.subIndices[e.id];
    if (v != null) {
      e.value = v;
      e.observedAt = d.observedAt;
    }
  }
  return {
    key: "waqi",
    valueBadge: "MEASURED",
    aqi: d.aqi,
    aqiBadge: "MEASURED",
    aqiDetail: "AQI as published by WAQI for this station (US EPA scale). Pollutant values are per-pollutant AQI sub-indices, not concentrations.",
    dominant: d.dominant,
    pollutants: entries,
    naqi: null,
    meta: r.meta,
  };
}

export function buildModelledPrimary(r: AdapterResult<ModelledCurrent>): Primary | null {
  if (!r.ok || !r.data) return null;
  const d = r.data;
  const entries = EMPTY_ENTRIES("concentration");
  for (const e of entries) {
    const v = d.pollutants[e.id];
    if (v != null) {
      e.value = v;
      e.unit = "µg/m³";
      e.observedAt = d.observedAt;
    }
  }
  const computed = computeEpaAqi({ pm25: d.pollutants.pm25, pm10: d.pollutants.pm10 });
  return {
    key: "open-meteo",
    valueBadge: "MODELLED",
    aqi: d.usAqi,
    aqiBadge: "MODELLED",
    aqiDetail: "US AQI from the CAMS atmospheric model via Open-Meteo. A model estimate for a ~11-40 km grid cell, not a station reading.",
    dominant: computed?.dominant ?? null,
    pollutants: entries,
    naqi: null,
    euAqi: d.euAqi,
    meta: r.meta,
  };
}

/** A measured source is usable as the headline if it has an AQI and the reading is < 6 h old. */
const USABLE_MAX_AGE_MIN = 360;
function usable(p: Primary | null): p is Primary {
  if (!p || p.aqi == null) return false;
  const age = minutesAgo(p.meta.observedAt, Date.now());
  return age == null || age <= USABLE_MAX_AGE_MIN;
}

function chainStep(source: string, r: AdapterResult<unknown>): ChainStep {
  if (r.ok) return { source, status: "ok" };
  if (r.code === "no_key") return { source, status: "no_key", message: r.error };
  if (r.code === "empty") return { source, status: "empty", message: r.error };
  return { source, status: "error", message: r.error };
}

export function buildCrossCheck(o: Primary | null, w: Primary | null): CrossCheck | null {
  if (!o || !w || o.aqi == null || w.aqi == null) return null;
  const mean = (o.aqi + w.aqi) / 2;
  const diffPct = mean === 0 ? 0 : (Math.abs(o.aqi - w.aqi) / mean) * 100;
  return {
    openaqAqi: o.aqi,
    waqiAqi: w.aqi,
    diffPct: Math.round(diffPct * 10) / 10,
    disagree: diffPct > 25,
    openaqStation: o.meta.stationName ?? "OpenAQ station",
    waqiStation: w.meta.stationName ?? "WAQI station",
    sameStation: false,
  };
}

export async function getAirSnapshot(lat: number, lon: number): Promise<AirSnapshot> {
  const [oaqR, waqiR] = await Promise.all([getOpenAqLatest(lat, lon), getWaqiFeedGeo(lat, lon)]);
  const oaq = buildOpenAqPrimary(oaqR);
  const waqi = buildWaqiPrimary(waqiR);
  const chain: ChainStep[] = [chainStep("OpenAQ", oaqR), chainStep("WAQI", waqiR)];
  const banners: Banner[] = [];

  let modelled: Primary | null = null;
  let primary: Primary | null = [oaq, waqi].find((p) => usable(p) && !p.meta.stale) ?? [oaq, waqi].find(usable) ?? null;

  if (!primary) {
    const omR = await getOpenMeteoCurrent(lat, lon);
    chain.push(chainStep("Open-Meteo (CAMS)", omR));
    modelled = buildModelledPrimary(omR);
    primary = modelled;
    if (modelled) {
      banners.push({
        id: "no-station",
        severity: "warn",
        source: "Open-Meteo (CAMS)",
        message: `No nearby station with a current reading was found (OpenAQ 25 km, WAQI ${WAQI_MAX_DISTANCE_KM} km). Showing a MODELLED CAMS estimate instead. It is a model, not a measurement.`,
      });
    } else {
      banners.push({ id: "no-data", severity: "error", source: "all", message: "No source could provide air quality data for this location right now." });
    }
  } else {
    chain.push({ source: "Open-Meteo (CAMS)", status: "not_needed", message: "A measured source was available" });
  }

  // Source problems, named explicitly
  for (const [name, r] of [["OpenAQ", oaqR], ["WAQI", waqiR]] as const) {
    if (!r.ok && r.code === "no_key") {
      banners.push({ id: `${name}-nokey`, severity: "info", source: name, message: `${name} is not configured on this server, so its data is unavailable.` });
    } else if (!r.ok && r.code === "upstream") {
      banners.push({ id: `${name}-down`, severity: "warn", source: name, message: `${name} is not responding${r.status ? ` (HTTP ${r.status})` : ""}: ${r.error}. ${primary ? `Showing ${primary.meta.source} instead.` : ""}` });
    } else if (!r.ok && r.code === "invalid") {
      banners.push({ id: `${name}-invalid`, severity: "warn", source: name, message: `${name} returned an unexpected response; its data is excluded.` });
    }
  }
  for (const p of [oaq, waqi, modelled]) {
    if (p?.meta.servedStale) {
      const mins = minutesAgo(p.meta.fetchedAt, Date.now());
      banners.push({ id: `${p.key}-cached`, severity: "warn", source: p.meta.source, message: `${p.meta.source} is unreachable. Showing its last cached data, fetched ${agoLabel(mins)}.` });
    }
  }
  if (primary?.meta.stale) {
    const mins = minutesAgo(primary.meta.observedAt, Date.now());
    banners.push({ id: "stale", severity: "warn", source: primary.meta.source, message: `The latest reading from ${primary.meta.stationName ?? primary.meta.source} is ${agoLabel(mins)} old (STALE, over 3 hours).` });
  }
  if (primary && primary.key !== "open-meteo" && (primary.meta.stationDistanceKm ?? 0) > 15) {
    banners.push({ id: "far", severity: "info", source: primary.meta.source, message: `The nearest station is ${primary.meta.stationDistanceKm} km away, so conditions at your exact spot may differ.` });
  }

  const alternatives = [oaq, waqi, modelled].filter((p): p is Primary => !!p);
  return {
    location: { lat, lon },
    primary,
    alternatives,
    crossCheck: buildCrossCheck(oaq && usable(oaq) ? oaq : null, waqi && usable(waqi) ? waqi : null),
    banners,
    chain,
    generatedAt: new Date().toISOString(),
  };
}
