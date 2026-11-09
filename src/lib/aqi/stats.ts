export interface Point {
  /** ISO-like time string (local or UTC, as provided) */
  t: string;
  v: number | null;
}

export function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Median absolute deviation */
export function mad(values: number[]): number | null {
  const m = median(values);
  if (m == null) return null;
  return median(values.map((v) => Math.abs(v - m)));
}

/** (b − a) / a × 100, null when a is missing or 0. */
export function percentChange(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  return ((b - a) / a) * 100;
}

export const PERCENT_CHANGE_FORMULA = "% change = (B − A) ÷ A × 100, where A = first period mean and B = second period mean";

export function finite(values: (number | null | undefined)[]): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v));
}

/** Group points by calendar day (first 10 chars of the timestamp) and average. */
export function dailyMeans(points: Point[], minPerDay = 1): { date: string; mean: number; n: number }[] {
  const by = new Map<string, number[]>();
  for (const p of points) {
    if (p.v == null || !Number.isFinite(p.v)) continue;
    const d = p.t.slice(0, 10);
    const arr = by.get(d);
    if (arr) arr.push(p.v);
    else by.set(d, [p.v]);
  }
  return [...by.entries()]
    .filter(([, v]) => v.length >= minPerDay)
    .map(([date, v]) => ({ date, mean: v.reduce((a, b) => a + b, 0) / v.length, n: v.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface Spike {
  index: number;
  t: string;
  value: number;
  baselineMedian: number;
  robustZ: number;
}

/**
 * Anomaly detection: trailing rolling median + MAD robust z-score.
 * robustZ = 0.6745 × (x − median) ÷ max(MAD, minScale). Flags upward spikes only.
 */
export function detectSpikes(
  points: Point[],
  opts: { window?: number; threshold?: number; minScale?: number; minValue?: number } = {},
): Spike[] {
  const { window = 24, threshold = 3.5, minScale = 1, minValue = 0 } = opts;
  const out: Spike[] = [];
  for (let i = window; i < points.length; i++) {
    const cur = points[i].v;
    if (cur == null || !Number.isFinite(cur) || cur < minValue) continue;
    const win = finite(points.slice(i - window, i).map((p) => p.v));
    if (win.length < Math.max(6, Math.floor(window / 2))) continue;
    const med = median(win)!;
    const m = mad(win) ?? 0;
    const z = (0.6745 * (cur - med)) / Math.max(m, minScale);
    if (z >= threshold) out.push({ index: i, t: points[i].t, value: cur, baselineMedian: med, robustZ: z });
  }
  return out;
}

export const spikeFormula = (baseline: string, minScale = 1) =>
  `robust z = 0.6745 × (x − rolling median of ${baseline}) ÷ max(MAD, ${minScale}); flagged when z ≥ 3.5`;
export const SPIKE_FORMULA = spikeFormula("previous 24 h");

export type Trend = "improving" | "worsening" | "steady";

/** Compare mean of last-third vs first-third of a series; ±10% is "steady". */
export function trendOf(values: number[], tolerance = 0.1): Trend {
  if (values.length < 4) return "steady";
  const k = Math.max(1, Math.floor(values.length / 3));
  const a = mean(values.slice(0, k))!;
  const b = mean(values.slice(-k))!;
  if (a === 0) return "steady";
  const r = (b - a) / a;
  if (r > tolerance) return "worsening";
  if (r < -tolerance) return "improving";
  return "steady";
}

/** Great-circle distance in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Compass direction from point A to point B */
export function bearingLabel(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const rad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Least-squares line through (0..n-1, values). Returns slope per step and fitted values. */
export function linearTrend(values: number[]): { slope: number; intercept: number; fitted: number[] } | null {
  const n = values.length;
  if (n < 3) return null;
  const xm = (n - 1) / 2;
  const ym = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  values.forEach((y, x) => {
    num += (x - xm) * (y - ym);
    den += (x - xm) ** 2;
  });
  const slope = den === 0 ? 0 : num / den;
  const intercept = ym - slope * xm;
  return { slope, intercept, fitted: values.map((_, x) => intercept + slope * x) };
}
