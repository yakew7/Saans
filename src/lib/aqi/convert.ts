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

/**
 * Normalise a provider-reported value to µg/m³ so it can be compared with WHO guidelines.
 * Returns null when the unit is unknown or not convertible (never guesses).
 */
export function toUgm3(pollutant: PollutantId, value: number, unit: string | null | undefined): number | null {
  const u = (unit ?? "").toLowerCase().replace("µ", "u").replace(/\s/g, "");
  if (u === "ug/m3" || u === "ug/m³") return value;
  if (u === "mg/m3" || u === "mg/m³") return value * 1000;
  // CO reported in "ppb" by some providers is implausibly small (likely mislabelled ppm): don't convert.
  if (pollutant === "co" && u === "ppb") return null;
  if (u === "ppb") return ppbToUgm3(pollutant, value);
  if (u === "ppm") return ppbToUgm3(pollutant, value * 1000);
  return null;
}
