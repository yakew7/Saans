import type { PollutantId } from "../types";

/** WHO global air quality guidelines 2021 (µg/m³; CO in mg/m³). */
export const WHO_SOURCE_URL = "https://www.who.int/publications/i/item/9789240034228";

export interface WhoGuideline {
  /** short-term (24 h unless noted) guideline value, µg/m³ */
  shortTerm: number;
  shortTermLabel: string;
  annual?: number;
  note?: string;
}

export const WHO_2021: Record<PollutantId, WhoGuideline> = {
  pm25: { shortTerm: 15, shortTermLabel: "24-hour", annual: 5 },
  pm10: { shortTerm: 45, shortTermLabel: "24-hour", annual: 15 },
  no2: { shortTerm: 25, shortTermLabel: "24-hour", annual: 10 },
  so2: { shortTerm: 40, shortTermLabel: "24-hour" },
  o3: { shortTerm: 100, shortTermLabel: "8-hour", note: "peak-season 60 µg/m³" },
  co: { shortTerm: 4000, shortTermLabel: "24-hour", note: "4 mg/m³" },
};

/** Ratio of a concentration (µg/m³) to the WHO short-term guideline. */
export function whoRatio(pollutant: PollutantId, conc: number | null | undefined): number | null {
  if (conc == null || !Number.isFinite(conc)) return null;
  return conc / WHO_2021[pollutant].shortTerm;
}

/**
 * Berkeley Earth rule of thumb: ~22 µg/m³ PM2.5 sustained over 24 h
 * is roughly equivalent to smoking one cigarette per day. A rough heuristic.
 */
export const CIGARETTE_SOURCE_URL = "https://berkeleyearth.org/air-pollution-and-cigarette-equivalence/";
export function cigaretteEquivalent(pm25Avg24: number | null | undefined): number | null {
  if (pm25Avg24 == null || !Number.isFinite(pm25Avg24) || pm25Avg24 < 0) return null;
  return pm25Avg24 / 22;
}
