import { describe, expect, it } from "vitest";
import { addDays, comparePeriods, daysBetween, summarisePeriod, toDayValues } from "./history";
import { linearTrend } from "./aqi/stats";

const mapOf = (start: string, vals: (number | null)[]) => {
  const m = new Map<string, number>();
  vals.forEach((v, i) => v != null && m.set(addDays(start, i), v));
  return m;
};

describe("history helpers", () => {
  it("computes daily AQI from daily mean PM via EPA breakpoints", () => {
    const d = toDayValues(mapOf("2026-01-01", [9, 35.4]), mapOf("2026-01-01", [20, 50]));
    expect(d.map((x) => x.aqi)).toEqual([50, 100]);
  });

  it("summarises a period and ignores warm-up days outside it", () => {
    const days = toDayValues(mapOf("2026-01-01", [10, 10, 10, 10, 10, 10, 10, 100, 100, 100]), mapOf("2026-01-01", []));
    const s = summarisePeriod(days, "2026-01-08", "2026-01-10");
    expect(s.days).toHaveLength(3);
    expect(s.meanPm25).toBe(100);
    expect(s.validDays).toBe(3);
  });

  it("flags an injected spike inside the period using warm-up context", () => {
    const pm = [30, 32, 31, 30, 33, 31, 30, 32, 150, 31];
    const days = toDayValues(mapOf("2026-02-01", pm), mapOf("2026-02-01", []));
    const s = summarisePeriod(days, "2026-02-08", "2026-02-10");
    expect(s.spikes.map((x) => x.date)).toContain("2026-02-09");
  });

  it("computes % change A -> B and withholds it when data is insufficient", () => {
    const a = summarisePeriod(toDayValues(mapOf("2026-03-01", [20, 20, 20, 20]), mapOf("2026-03-01", [40, 40, 40, 40])), "2026-03-01", "2026-03-04");
    const b = summarisePeriod(toDayValues(mapOf("2026-03-05", [40, 40, 40, 40]), mapOf("2026-03-05", [60, 60, 60, 60])), "2026-03-05", "2026-03-08");
    const c = comparePeriods(a, b);
    expect(c.sufficient).toBe(true);
    expect(c.pm25).toBe(100);
    expect(c.pm10).toBe(50);
    const thin = summarisePeriod(toDayValues(mapOf("2026-03-05", [40, null, null]), mapOf("2026-03-05", [])), "2026-03-05", "2026-03-07");
    expect(comparePeriods(a, thin)).toEqual({ pm25: null, pm10: null, aqi: null, sufficient: false });
  });

  it("linear trend and date math", () => {
    expect(linearTrend([1, 2, 3, 4])?.slope).toBeCloseTo(1, 9);
    expect(linearTrend([5, 5, 5])?.slope).toBe(0);
    expect(linearTrend([1, 2])).toBeNull();
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(daysBetween("2026-01-01", "2026-01-31")).toBe(30);
  });
});
