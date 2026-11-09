import { describe, expect, it } from "vitest";
import { buildReport, reportToText } from "./report";
import { addDays, toDayValues } from "./history";

const series = (start: string, pm25: number[], pm10: number[] = []) => {
  const a = new Map<string, number>();
  const b = new Map<string, number>();
  pm25.forEach((v, i) => a.set(addDays(start, i), v));
  pm10.forEach((v, i) => b.set(addDays(start, i), v));
  return toDayValues(a, b);
};

describe("buildReport", () => {
  const days = series("2026-11-01", [10, 20, 30, 40, 100, 20, 10], [30, 40, 50, 60, 150, 40, 30]);
  const r = buildReport(days, "2026-11-01", "2026-11-07");

  it("computes averages, best/worst and WHO exceedance days", () => {
    expect(r.validDays).toBe(7);
    expect(r.meanPm25).toBeCloseTo(32.857, 2);
    expect(r.worst?.date).toBe("2026-11-05");
    expect(r.best?.aqi).toBeLessThanOrEqual(r.worst!.aqi);
    expect(r.daysAboveWhoPm25).toBe(5); // 20,30,40,100,20 > 15
    expect(r.daysAboveWhoPm10).toBe(3); // 50, 60, 150 > 45
  });

  it("cigarette heuristic is sum of daily PM2.5 / 22", () => {
    expect(r.cigarettes).toBeCloseTo((10 + 20 + 30 + 40 + 100 + 20 + 10) / 22, 6);
    expect(r.cigarettesPerDay).toBeCloseTo(r.cigarettes! / 7, 6);
  });

  it("category day counts add up to the valid days", () => {
    expect(r.categoryDays.reduce((s, c) => s + c.days, 0)).toBe(r.validDays);
  });

  it("handles an empty period without inventing values", () => {
    const e = buildReport([], "2026-11-01", "2026-11-07");
    expect(e.validDays).toBe(0);
    expect(e.meanAqi).toBeNull();
    expect(e.cigarettes).toBeNull();
    expect(reportToText("X", e, "none")).toContain("No data available");
  });

  it("text export includes the key facts and the heuristic label", () => {
    const t = reportToText("Delhi", r, "OpenAQ station history");
    expect(t).toContain("POLLUTION IMPACT REPORT: Delhi");
    expect(t).toContain("rough heuristic");
    expect(t).toContain("Worst day: 2026-11-05");
  });
});
