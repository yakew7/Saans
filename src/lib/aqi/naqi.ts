import type { PollutantId } from "../types";

/** CPCB National AQI breakpoints (24 h, µg/m³). Sub-index ranges 0-50-100-200-300-400-500. */
interface Bp {
  cLow: number;
  cHigh: number;
  iLow: number;
  iHigh: number;
}

export const NAQI_PM25: Bp[] = [
  { cLow: 0, cHigh: 30, iLow: 0, iHigh: 50 },
  { cLow: 31, cHigh: 60, iLow: 51, iHigh: 100 },
  { cLow: 61, cHigh: 90, iLow: 101, iHigh: 200 },
  { cLow: 91, cHigh: 120, iLow: 201, iHigh: 300 },
  { cLow: 121, cHigh: 250, iLow: 301, iHigh: 400 },
  { cLow: 251, cHigh: 380, iLow: 401, iHigh: 500 },
];

export const NAQI_PM10: Bp[] = [
  { cLow: 0, cHigh: 50, iLow: 0, iHigh: 50 },
  { cLow: 51, cHigh: 100, iLow: 51, iHigh: 100 },
  { cLow: 101, cHigh: 250, iLow: 101, iHigh: 200 },
  { cLow: 251, cHigh: 350, iLow: 201, iHigh: 300 },
  { cLow: 351, cHigh: 430, iLow: 301, iHigh: 400 },
  { cLow: 431, cHigh: 510, iLow: 401, iHigh: 500 },
];

function sub(table: Bp[], conc: number): number | null {
  if (!Number.isFinite(conc) || conc < 0) return null;
  const c = Math.floor(conc);
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

export const naqiPm25 = (c: number) => sub(NAQI_PM25, c);
export const naqiPm10 = (c: number) => sub(NAQI_PM10, c);

export interface NaqiResult {
  aqi: number;
  dominant: PollutantId;
  subIndices: Partial<Record<PollutantId, number>>;
}

/** PM-only NAQI from 24 h average PM2.5 / PM10 (µg/m³). */
export function computePmNaqi(avg24: { pm25?: number | null; pm10?: number | null }): NaqiResult | null {
  const subIndices: Partial<Record<PollutantId, number>> = {};
  if (avg24.pm25 != null) {
    const v = naqiPm25(avg24.pm25);
    if (v != null) subIndices.pm25 = v;
  }
  if (avg24.pm10 != null) {
    const v = naqiPm10(avg24.pm10);
    if (v != null) subIndices.pm10 = v;
  }
  const e = Object.entries(subIndices) as [PollutantId, number][];
  if (!e.length) return null;
  e.sort((a, b) => b[1] - a[1]);
  return { aqi: e[0][1], dominant: e[0][0], subIndices };
}

export const NAQI_FORMULA =
  "PM-only NAQI: linear interpolation on CPCB breakpoints for PM2.5 and PM10 24 h averages; NAQI = max of the two sub-indices (gases not included).";
