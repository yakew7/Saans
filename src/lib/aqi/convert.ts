import type { PollutantId } from "../types";

const MOLAR_MASS: Partial<Record<PollutantId, number>> = {
  o3: 48.0,
  no2: 46.01,
  so2: 64.07,
  co: 28.01,
};

/** µg/m³ -> ppb at 25 °C and 1 atm (molar volume 24.45 L/mol). */
export function ugm3ToPpb(pollutant: PollutantId, ugm3: number): number | null {
  const mw = MOLAR_MASS[pollutant];
  if (!mw) return null;
  return (ugm3 * 24.45) / mw;
}

export function ppbToUgm3(pollutant: PollutantId, ppb: number): number | null {
  const mw = MOLAR_MASS[pollutant];
  if (!mw) return null;
  return (ppb * mw) / 24.45;
}

export function ugm3ToMgm3(ugm3: number): number {
  return ugm3 / 1000;
}
