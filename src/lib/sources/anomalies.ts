import type { BadgeKind, Meta } from "../types";
import { detectSpikes, spikeFormula } from "../aqi/stats";
import { getOpenAqHourlyPm25 } from "./openaq";
import { getOpenMeteoHourly } from "./openmeteo";
import type { Banner } from "./snapshot";

export interface AnomalyEvent {
  t: string;
  local: string;
  value: number;
  baseline: number;
  ratio: number;
  robustZ: number;
}

export interface AnomalyResponse {
  source: "openaq" | "open-meteo" | null;
  badge: BadgeKind | null;
  meta: Meta | null;
  points: { t: string; local: string; v: number | null }[];
  events: AnomalyEvent[];
  formula: string;
  banners: Banner[];
}

const FORMULA = spikeFormula("the previous 24 h", 5);

/** Hourly PM2.5 anomalies via rolling median + MAD. Measured (OpenAQ) when possible, else CAMS modelled. */
export async function getAnomalies(lat: number, lon: number, days: number): Promise<AnomalyResponse> {
  const banners: Banner[] = [];
  const oaq = await getOpenAqHourlyPm25(lat, lon, days);
  let source: AnomalyResponse["source"] = null;
  let badge: BadgeKind | null = null;
  let meta: Meta | null = null;
  let points: AnomalyResponse["points"] = [];

  if (oaq.ok && oaq.data) {
    source = "openaq";
    badge = "HISTORICAL-MEASURED";
    meta = oaq.meta;
    points = oaq.data.points;
  } else {
    const om = await getOpenMeteoHourly(lat, lon, Math.min(days, 92), 0);
    if (om.ok && om.data) {
      const now = Date.now();
      source = "open-meteo";
      badge = "MODELLED";
      meta = om.meta;
      points = om.data.times.map((t, i) => ({ t, local: om.data!.localTimes[i], v: om.data!.pm25[i] })).filter((p) => Date.parse(p.t) <= now);
      banners.push({ id: "anom-modelled", severity: "info", source: "Open-Meteo (CAMS)", message: `${oaq.error ?? "No station history."} Anomalies are detected on MODELLED CAMS data, which smooths over sharp local spikes.` });
    } else {
      banners.push({ id: "anom-none", severity: "error", source: "all", message: "No hourly PM2.5 history is available for this location right now." });
    }
  }
  const spikes = detectSpikes(points.map((p) => ({ t: p.t, v: p.v })), { window: 24, threshold: 3.5, minScale: 5, minValue: 30 });
  const events: AnomalyEvent[] = spikes
    .map((s) => ({ t: s.t, local: points[s.index].local, value: s.value, baseline: s.baselineMedian, ratio: s.baselineMedian > 0 ? s.value / s.baselineMedian : 0, robustZ: s.robustZ }))
    .sort((a, b) => b.robustZ - a.robustZ);
  return { source, badge, meta, points, events, formula: FORMULA, banners };
}
