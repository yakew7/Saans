import { describe, expect, it } from "vitest";
import { fitRidge, mae, predictRidge, rmse } from "./ridge";
import { backtestHorizon, buildSamples, features, type Grid } from "./model";

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe("ridge regression", () => {
  it("recovers a known linear relationship", () => {
    const r = rng(1);
    const X = Array.from({ length: 300 }, () => [r() * 10, r() * 5]);
    const y = X.map(([a, b]) => 2 * a - 3 * b + 1);
    const m = fitRidge(X, y, 1e-6);
    for (const x of [[1, 1], [7, 2], [3, 4]]) expect(predictRidge(m, x)).toBeCloseTo(2 * x[0] - 3 * x[1] + 1, 3);
  });
  it("shrinks weights as lambda grows", () => {
    const r = rng(2);
    const X = Array.from({ length: 200 }, () => [r(), r()]);
    const y = X.map(([a]) => 5 * a);
    const small = fitRidge(X, y, 0.01);
    const big = fitRidge(X, y, 1e5);
    expect(Math.abs(big.weights[0])).toBeLessThan(Math.abs(small.weights[0]) / 100);
  });
  it("copes with constant and collinear columns", () => {
    const r = rng(3);
    const X = Array.from({ length: 100 }, () => {
      const a = r();
      return [a, a * 2, 7];
    });
    const y = X.map(([a]) => 3 * a);
    const m = fitRidge(X, y, 1);
    expect(Number.isFinite(predictRidge(m, [0.5, 1, 7]))).toBe(true);
    expect(predictRidge(m, [0.5, 1, 7])).toBeCloseTo(1.5, 0);
  });
  it("mae and rmse", () => {
    expect(mae([1, 2, 3], [1, 2, 6])).toBe(1);
    expect(rmse([0, 0], [3, 4])).toBeCloseTo(Math.sqrt(12.5), 9);
  });
});

/** Synthetic grid: PM follows a weather-driven signal (wind low => PM high) plus noise, so a model using weather should beat persistence. */
function syntheticGrid(hours: number, seed: number): Grid {
  const r = rng(seed);
  const wind: number[] = [];
  const pm: number[] = [];
  const cams: number[] = [];
  let w = 3;
  for (let i = 0; i < hours + 60; i++) {
    w = Math.max(0.3, Math.min(10, w + (r() - 0.5) * 3)); // wind random walk changes quickly
    wind.push(w);
    const signal = 200 / (1 + w);
    pm.push(Math.max(1, signal + (r() - 0.5) * 10));
    cams.push(Math.max(1, 60 + (r() - 0.5) * 20)); // uninformative model baseline
  }
  const col = (a: number[]) => a.slice(0, hours + 60);
  return { start: Date.UTC(2026, 0, 1), utcOffsetSeconds: 0, pm: col(pm), cams: col(cams), temp: col(pm).map(() => 25), rh: col(pm).map(() => 50), wind: col(wind), blh: col(pm).map(() => 800), precip: col(pm).map(() => 0) };
}

describe("walk-forward backtest", () => {
  const g = syntheticGrid(1500, 7);
  it("builds samples only where every required input exists", () => {
    const withGap: Grid = { ...g, pm: g.pm.map((v, i) => (i === 100 ? null : v)) };
    expect(features(withGap, 100, 6)).toBeNull(); // origin value missing
    expect(buildSamples(withGap, 6).every((s) => Number.isFinite(s.actual))).toBe(true);
  });
  it("beats persistence when the target is driven by a known covariate, and reports all three scores", () => {
    const res = backtestHorizon(g, 6)!;
    expect(res).not.toBeNull();
    expect(res.nTest).toBeGreaterThan(100);
    expect(res.ml.mae).toBeLessThan(res.persistence.mae);
    expect(res.ml.mae).toBeLessThan(res.cams.mae);
    expect(res.ml.rmse).toBeGreaterThan(0);
  });
  it("honestly reports no advantage on pure noise (does not beat persistence)", () => {
    const r = rng(11);
    const noise: Grid = { ...g, pm: g.pm.map(() => 50 + r() * 40), wind: g.wind.map(() => 3) };
    const res = backtestHorizon(noise, 6)!;
    // on iid noise, persistence and any model are about equally bad; ML must not magically win by a large margin
    expect(res.ml.mae / res.persistence.mae).toBeGreaterThan(0.6);
  });
  it("returns null with too little data", () => {
    expect(backtestHorizon(syntheticGrid(200, 5), 6)).toBeNull();
  });
});
