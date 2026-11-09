/**
 * Ridge regression implemented from scratch (no ML library): standardise features, solve (XᵀX + λI) w = Xᵀy
 * with Gaussian elimination and partial pivoting. The intercept is not penalised.
 */
export interface RidgeModel {
  mean: number[];
  std: number[];
  weights: number[];
  intercept: number;
  lambda: number;
}

function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[p][c])) p = r;
    if (Math.abs(m[p][c]) < 1e-12) throw new Error("singular matrix");
    [m[c], m[p]] = [m[p], m[c]];
    for (let r = c + 1; r < n; r++) {
      const f = m[r][c] / m[c][c];
      for (let k = c; k <= n; k++) m[r][k] -= f * m[c][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = m[r][n];
    for (let k = r + 1; k < n; k++) s -= m[r][k] * x[k];
    x[r] = s / m[r][r];
  }
  return x;
}

export function fitRidge(X: number[][], y: number[], lambda = 5): RidgeModel {
  const n = X.length;
  const p = X[0]?.length ?? 0;
  if (n < 2 || p === 0) throw new Error("not enough data to fit");
  const mean = new Array<number>(p).fill(0);
  const std = new Array<number>(p).fill(0);
  for (const row of X) row.forEach((v, j) => (mean[j] += v / n));
  for (const row of X) row.forEach((v, j) => (std[j] += (v - mean[j]) ** 2 / n));
  for (let j = 0; j < p; j++) std[j] = Math.sqrt(std[j]) || 1; // constant column -> std 1 (weight ends up 0)
  const ym = y.reduce((a, b) => a + b, 0) / n;
  const Z = X.map((row) => row.map((v, j) => (v - mean[j]) / std[j]));
  const A: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const b = new Array<number>(p).fill(0);
  for (let i = 0; i < n; i++) {
    const z = Z[i];
    const yc = y[i] - ym;
    for (let j = 0; j < p; j++) {
      b[j] += z[j] * yc;
      for (let k = j; k < p; k++) A[j][k] += z[j] * z[k];
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) A[j][k] = A[k][j];
    A[j][j] += lambda;
  }
  return { mean, std, weights: solve(A, b), intercept: ym, lambda };
}

export function predictRidge(model: RidgeModel, x: number[]): number {
  let s = model.intercept;
  for (let j = 0; j < x.length; j++) s += model.weights[j] * ((x[j] - model.mean[j]) / model.std[j]);
  return s;
}

export function mae(actual: number[], pred: number[]): number {
  return actual.reduce((s, a, i) => s + Math.abs(a - pred[i]), 0) / actual.length;
}

export function rmse(actual: number[], pred: number[]): number {
  return Math.sqrt(actual.reduce((s, a, i) => s + (a - pred[i]) ** 2, 0) / actual.length);
}
