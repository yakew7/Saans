import type { PollutantId } from "../types";

/**
 * US EPA AQI breakpoints, from 40 CFR Part 58 Appendix G Table 2
 * (includes the February 2024 PM2.5 revision).
 * Concentrations in µg/m³ for particulates.
 */
interface Breakpoint {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

export const EPA_PM25: Breakpoint[] = [
  { cLow: 0.0, cHigh: 9.0, iLow: 0, iHigh: 50 },
  { cLow: 9.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
  { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
  { cLow: 55.5, cHigh: 125.4, iLow: 151, iHigh: 200 },
  { cLow: 125.5, cHigh: 225.4, iLow: 201, iHigh: 300 },
  { cLow: 225.5, cHigh: 325.4, iLow: 301, iHigh: 500 },
];

export const EPA_PM10: Breakpoint[] = [
  { cLow: 0, cHigh: 54, iLow: 0, iHigh: 50 },
  { cLow: 55, cHigh: 154, iLow: 51, iHigh: 100 },
  { cLow: 155, cHigh: 254, iLow: 101, iHigh: 150 },
  { cLow: 255, cHigh: 354, iLow: 151, iHigh: 200 },
  { cLow: 355, cHigh: 424, iLow: 201, iHigh: 300 },
  { cLow: 425, cHigh: 604, iLow: 301, iHigh: 500 },
];

function interpolate(table: Breakpoint[], conc: number, decimals: number): number | null {
  if (!Number.isFinite(conc) || conc < 0) return null;
  // EPA truncates (not rounds) concentrations to the breakpoint precision.
  const f = 10 ** decimals;
  const c = Math.floor(conc * f + 1e-9) / f;
  const top = table[table.length - 1];
  if (c > top.cHigh) return 500;
  for (const bp of table) {
    if (c <= bp.cHigh) {
      const lo = Math.max(c, bp.cLow);
      return Math.round(((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (lo - bp.cLow) + bp.iLow);
    }
  }
  return 500;
}

/** AQI sub-index for PM2.5 (24 h average, µg/m³). */
export function aqiPm25(conc: number): number | null {
  return interpolate(EPA_PM25, conc, 1);
}

/** AQI sub-index for PM10 (24 h average, µg/m³). */
export function aqiPm10(conc: number): number | null {
  return interpolate(EPA_PM10, conc, 0);
}

export interface ComputedAqi {
  aqi: number;
  dominant: PollutantId;
  subIndices: Partial<Record<PollutantId, number>>;
}

/** Overall computed AQI = max of the particulate sub-indices we can compute. */
export function computeEpaAqi(conc: Partial<Record<PollutantId, number | null>>): ComputedAqi | null {
  const subIndices: Partial<Record<PollutantId, number>> = {};
  if (conc.pm25 != null) {
    const v = aqiPm25(conc.pm25);
    if (v != null) subIndices.pm25 = v;
  }
  if (conc.pm10 != null) {
    const v = aqiPm10(conc.pm10);
    if (v != null) subIndices.pm10 = v;
  }
  const entries = Object.entries(subIndices) as [PollutantId, number][];
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { aqi: entries[0][1], dominant: entries[0][0], subIndices };
}

export const EPA_FORMULA =
  "I = (I_hi − I_lo)/(C_hi − C_lo) × (C − C_lo) + I_lo, using US EPA breakpoints (40 CFR 58 App. G, 2024 PM2.5 revision). AQI = max(PM2.5, PM10 sub-index).";
