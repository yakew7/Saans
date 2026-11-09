import { fitRidge, mae, predictRidge, rmse, type RidgeModel } from "./ridge";

/** Hourly aligned series. Index i = one hour. Future hours (forecast) have pm = null. */
export interface Grid {
  /** epoch ms of hour index 0 (start of the hour bucket, UTC) */
  start: number;
  /** utc offset of the location, to derive the local hour-of-day */
  utcOffsetSeconds: number;
  pm: (number | null)[];
  cams: (number | null)[];
  temp: (number | null)[];
  rh: (number | null)[];
  wind: (number | null)[];
  blh: (number | null)[];
  precip: (number | null)[];
}

export const HORIZONS = [1, 3, 6, 12, 24, 36, 48] as const;
export const LAMBDA = 5;
export const FEATURE_NAMES = [
  "PM2.5 now (log)",
  "PM2.5 1 h ago",
  "PM2.5 3 h ago",
  "PM2.5 6 h ago",
  "PM2.5 12 h ago",
  "PM2.5 24 h ago",
  "PM2.5 24 h mean",
  "Recent model bias (measured − CAMS now)",
  "CAMS PM2.5 at target hour",
  "Temperature at target hour",
  "Humidity at target hour",
  "Wind speed at target hour",
  "Boundary layer height at target hour (log)",
  "Rain at target hour",
  "Hour of day (sin)",
  "Hour of day (cos)",
];

const lg = (v: number) => Math.log1p(Math.max(0, v));
const ok = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

/** Features for forecast origin t and horizon h. Returns null when required inputs are missing (never imputed with zeros). */
export function features(g: Grid, t: number, h: number): number[] | null {
  const pm = g.pm;
  if (!ok(pm[t]) || !ok(pm[t - 24])) return null;
  const k = t + h;
  const cams = g.cams[k];
  const temp = g.temp[k];
  const rh = g.rh[k];
  const wind = g.wind[k];
  const blh = g.blh[k];
  if (!ok(cams) || !ok(temp) || !ok(rh) || !ok(wind) || !ok(blh)) return null;
  const now = pm[t] as number;
  const lag = (d: number) => (ok(pm[t - d]) ? (pm[t - d] as number) : now); // missing lag falls back to the current value (persistence)
  const win = pm.slice(t - 23, t + 1).filter(ok);
  if (win.length < 12) return null;
  const mean24 = win.reduce((a, b) => a + b, 0) / win.length;
  const camsNow = g.cams[t];
  const hourLocal = (new Date(g.start + (k * 3600 + g.utcOffsetSeconds) * 1000).getUTCHours() + 24) % 24;
  const ang = (2 * Math.PI * hourLocal) / 24;
  return [
    lg(now),
    lg(lag(1)),
    lg(lag(3)),
    lg(lag(6)),
    lg(lag(12)),
    lg(lag(24)),
    lg(mean24),
    ok(camsNow) ? lg(now) - lg(camsNow) : 0,
    lg(cams),
    temp,
    rh,
    wind,
    Math.log(Math.max(blh, 10)),
    ok(g.precip[k]) && (g.precip[k] as number) > 0 ? 1 : 0,
    Math.sin(ang),
    Math.cos(ang),
  ];
}

export interface Sample {
  t: number;
  x: number[];
  /** log1p of the actual PM2.5 at t+h */
  y: number;
  actual: number;
  persistence: number;
  cams: number;
}

export function buildSamples(g: Grid, h: number): Sample[] {
  const out: Sample[] = [];
  for (let t = 24; t + h < g.pm.length; t++) {
    const actual = g.pm[t + h];
    if (!ok(actual)) continue;
    const x = features(g, t, h);
    if (!x) continue;
    out.push({ t, x, y: lg(actual), actual, persistence: g.pm[t] as number, cams: g.cams[t + h] as number });
  }
  return out;
}

export interface Scores {
  mae: number;
  rmse: number;
}
export interface HorizonResult {
  h: number;
  nTrain: number;
  nTest: number;
  ml: Scores;
  persistence: Scores;
  cams: Scores;
}

const scores = (a: number[], p: number[]): Scores => ({ mae: mae(a, p), rmse: rmse(a, p) });

/**
 * Walk-forward (expanding window) validation: train on the past only, test on the next block, repeat.
 * Origins whose target would fall inside the test block are purged from training (no leakage).
 */
export function backtestHorizon(g: Grid, h: number, lambda = LAMBDA): HorizonResult | null {
  const s = buildSamples(g, h);
  if (s.length < 300) return null;
  const n = s.length;
  const blocks: [number, number][] = [
    [Math.floor(n * 0.55), Math.floor(n * 0.7)],
    [Math.floor(n * 0.7), Math.floor(n * 0.85)],
    [Math.floor(n * 0.85), n],
  ];
  const A: number[] = [];
  const P: number[] = [];
  const Pers: number[] = [];
  const C: number[] = [];
  let nTrain = 0;
  for (const [a, b] of blocks) {
    const testStartT = s[a].t;
    const train = s.slice(0, a).filter((r) => r.t + h < testStartT);
    if (train.length < 150) continue;
    nTrain = Math.max(nTrain, train.length);
    const model = fitRidge(train.map((r) => r.x), train.map((r) => r.y), lambda);
    for (const r of s.slice(a, b)) {
      A.push(r.actual);
      P.push(Math.max(0, Math.expm1(predictRidge(model, r.x))));
      Pers.push(r.persistence);
      C.push(r.cams);
    }
  }
  if (A.length < 100) return null;
  return { h, nTrain, nTest: A.length, ml: scores(A, P), persistence: scores(A, Pers), cams: scores(A, C) };
}

export function fitFinal(g: Grid, h: number, lambda = LAMBDA): RidgeModel | null {
  const s = buildSamples(g, h);
  if (s.length < 200) return null;
  return fitRidge(s.map((r) => r.x), s.map((r) => r.y), lambda);
}

/** Prediction for target t+h from origin t with a fitted model, in µg/m³. */
export function predictAt(model: RidgeModel, g: Grid, t: number, h: number): number | null {
  const x = features(g, t, h);
  return x ? Math.max(0, Math.expm1(predictRidge(model, x))) : null;
}
