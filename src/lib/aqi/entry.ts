import type { PollutantEntry } from "../sources/snapshot";
import { toUgm3 } from "./convert";
import { WHO_2021, whoRatio } from "./who";

export interface WhoComparison {
  ratio: number;
  /** what the ratio is based on */
  basis: "24 h mean" | "latest reading";
  concentration: number;
}

/** WHO 2021 comparison for a pollutant card. Only concentrations (µg/m³-convertible) are comparable, never sub-indices. */
export function whoComparison(e: PollutantEntry): WhoComparison | null {
  if (e.basis !== "concentration") return null;
  const use24 = e.avg24 != null && (e.id === "pm25" || e.id === "pm10");
  const raw = use24 ? e.avg24! : e.value;
  if (raw == null) return null;
  const ug = use24 ? raw : toUgm3(e.id, raw, e.unit);
  if (ug == null) return null;
  const ratio = whoRatio(e.id, ug);
  return ratio == null ? null : { ratio, basis: use24 ? "24 h mean" : "latest reading", concentration: ug };
}

export const whoLabel = (id: PollutantEntry["id"]) => {
  const g = WHO_2021[id];
  return id === "co" ? `${g.shortTerm / 1000} mg/m³ ${g.shortTermLabel}` : `${g.shortTerm} µg/m³ ${g.shortTermLabel}`;
};
