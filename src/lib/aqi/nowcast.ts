/**
 * US EPA NowCast for PM2.5 / PM10 from hourly means (oldest -> newest).
 * Uses the latest 12 hours. Requires at least 2 valid values among the 3 most recent hours.
 * weight w = cmin / cmax, floored at 0.5; NowCast = sum(w^i * c_i) / sum(w^i), i = 0 for the newest hour.
 */
export function nowcast(hourlyOldestFirst: (number | null | undefined)[]): number | null {
  const last12 = hourlyOldestFirst.slice(-12).reverse(); // newest first
  const valid = (v: number | null | undefined): v is number => v != null && Number.isFinite(v) && v >= 0;
  const recent3 = last12.slice(0, 3).filter(valid).length;
  if (recent3 < 2) return null;
  const vals = last12.filter(valid);
  const cmax = Math.max(...vals);
  const cmin = Math.min(...vals);
  if (cmax === 0) return 0;
  const w = Math.max(cmin / cmax, 0.5);
  let num = 0;
  let den = 0;
  last12.forEach((c, i) => {
    if (!valid(c)) return;
    const f = w ** i;
    num += f * c;
    den += f;
  });
  return den ? num / den : null;
}

export const NOWCAST_FORMULA =
  "NowCast = Σ wⁱ·cᵢ ÷ Σ wⁱ over the last 12 hourly means (i = 0 newest); w = max(cmin ÷ cmax, 0.5). Then US EPA breakpoints.";

/** Mean of the last 24 hourly values; null unless at least `minValid` hours are present. */
export function avg24h(hourlyOldestFirst: (number | null | undefined)[], minValid = 16): number | null {
  const last24 = hourlyOldestFirst.slice(-24).filter((v): v is number => v != null && Number.isFinite(v) && v >= 0);
  if (last24.length < minValid) return null;
  return last24.reduce((a, b) => a + b, 0) / last24.length;
}
