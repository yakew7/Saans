import { describe, expect, it } from "vitest";
import { aqiPm10, aqiPm25, computeEpaAqi } from "./epa";
import { computePmNaqi, naqiPm10, naqiPm25 } from "./naqi";
import { categoryFor, naqiCategoryFor } from "./categories";
import { cigaretteEquivalent, whoRatio } from "./who";
import { ppbToUgm3, toUgm3, ugm3ToPpb } from "./convert";
import { bearingLabel, dailyMeans, detectSpikes, haversineKm, mad, median, percentChange, trendOf } from "./stats";

describe("EPA PM2.5 (2024 breakpoints)", () => {
  it("hits the category boundaries", () => {
    expect(aqiPm25(0)).toBe(0);
    expect(aqiPm25(9.0)).toBe(50);
    expect(aqiPm25(9.1)).toBe(51);
    expect(aqiPm25(35.4)).toBe(100);
    expect(aqiPm25(35.5)).toBe(101);
    expect(aqiPm25(55.4)).toBe(150);
    expect(aqiPm25(55.5)).toBe(151);
    expect(aqiPm25(125.4)).toBe(200);
    expect(aqiPm25(125.5)).toBe(201);
    expect(aqiPm25(225.4)).toBe(300);
    expect(aqiPm25(225.5)).toBe(301);
    expect(aqiPm25(325.4)).toBe(500);
  });
  it("interpolates and truncates to 0.1", () => {
    expect(aqiPm25(84.1)).toBe(171);
    expect(aqiPm25(35.46)).toBe(100); // truncated to 35.4
  });
  it("caps at 500 and rejects invalid", () => {
    expect(aqiPm25(900)).toBe(500);
    expect(aqiPm25(-1)).toBeNull();
    expect(aqiPm25(NaN)).toBeNull();
  });
});

describe("EPA PM10", () => {
  it("hits boundaries", () => {
    expect(aqiPm10(54)).toBe(50);
    expect(aqiPm10(55)).toBe(51);
    expect(aqiPm10(154)).toBe(100);
    expect(aqiPm10(254)).toBe(150);
    expect(aqiPm10(354)).toBe(200);
    expect(aqiPm10(424)).toBe(300);
    expect(aqiPm10(425)).toBe(301);
    expect(aqiPm10(604)).toBe(500);
  });
});

describe("computeEpaAqi", () => {
  it("returns the max sub-index with its dominant pollutant", () => {
    const r = computeEpaAqi({ pm25: 84.1, pm10: 108 });
    expect(r?.dominant).toBe("pm25");
    expect(r?.aqi).toBe(171);
  });
  it("returns null with no particulate data and never zero-fills", () => {
    expect(computeEpaAqi({ no2: 40 })).toBeNull();
    expect(computeEpaAqi({ pm25: null, pm10: null })).toBeNull();
  });
});

describe("categories", () => {
  it("maps values to the six official categories", () => {
    expect(categoryFor(50).id).toBe("good");
    expect(categoryFor(51).id).toBe("moderate");
    expect(categoryFor(150).id).toBe("usg");
    expect(categoryFor(200).id).toBe("unhealthy");
    expect(categoryFor(300).id).toBe("very-unhealthy");
    expect(categoryFor(301).id).toBe("hazardous");
    expect(categoryFor(999).id).toBe("hazardous");
  });
  it("maps NAQI categories", () => {
    expect(naqiCategoryFor(100).id).toBe("satisfactory");
    expect(naqiCategoryFor(350).id).toBe("very-poor");
  });
});

describe("CPCB NAQI (PM-only)", () => {
  it("PM2.5 boundaries", () => {
    expect(naqiPm25(30)).toBe(50);
    expect(naqiPm25(60)).toBe(100);
    expect(naqiPm25(90)).toBe(200);
    expect(naqiPm25(120)).toBe(300);
    expect(naqiPm25(250)).toBe(400);
    expect(naqiPm25(380)).toBe(500);
    expect(naqiPm25(600)).toBe(500);
  });
  it("PM10 boundaries", () => {
    expect(naqiPm10(50)).toBe(50);
    expect(naqiPm10(100)).toBe(100);
    expect(naqiPm10(250)).toBe(200);
    expect(naqiPm10(350)).toBe(300);
    expect(naqiPm10(430)).toBe(400);
  });
  it("takes the max and reports the dominant pollutant", () => {
    const r = computePmNaqi({ pm25: 120, pm10: 100 });
    expect(r?.aqi).toBe(300);
    expect(r?.dominant).toBe("pm25");
    expect(computePmNaqi({})).toBeNull();
  });
});

describe("WHO + cigarettes + conversion", () => {
  it("computes WHO ratios from the 2021 values", () => {
    expect(whoRatio("pm25", 30)).toBe(2);
    expect(whoRatio("pm10", 45)).toBe(1);
    expect(whoRatio("pm25", null)).toBeNull();
  });
  it("cigarette heuristic is 22 µg/m³ per cigarette", () => {
    expect(cigaretteEquivalent(44)).toBe(2);
    expect(cigaretteEquivalent(null)).toBeNull();
  });
  it("round-trips unit conversion", () => {
    const ppb = ugm3ToPpb("no2", 100)!;
    expect(ppb).toBeCloseTo(53.14, 1);
    expect(ppbToUgm3("no2", ppb)!).toBeCloseTo(100, 6);
    expect(ugm3ToPpb("pm25", 10)).toBeNull();
  });
});

describe("stats", () => {
  it("percent change", () => {
    expect(percentChange(100, 150)).toBe(50);
    expect(percentChange(200, 100)).toBe(-50);
    expect(percentChange(0, 5)).toBeNull();
    expect(percentChange(null, 5)).toBeNull();
  });
  it("median and MAD", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(mad([1, 1, 2, 2, 4, 6, 9])).toBe(1);
  });
  it("daily means skip nulls", () => {
    const d = dailyMeans([
      { t: "2026-11-01T00:00", v: 10 },
      { t: "2026-11-01T01:00", v: 20 },
      { t: "2026-11-01T02:00", v: null },
      { t: "2026-11-02T00:00", v: 5 },
    ]);
    expect(d).toEqual([
      { date: "2026-11-01", mean: 15, n: 2 },
      { date: "2026-11-02", mean: 5, n: 1 },
    ]);
  });
  it("detects an injected spike and ignores noise", () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({ t: `h${i}`, v: 40 + (i % 3) }));
    pts[40] = { t: "h40", v: 200 };
    const s = detectSpikes(pts);
    expect(s.map((x) => x.index)).toContain(40);
    expect(s.every((x) => x.value >= 100)).toBe(true);
  });
  it("does not flag a flat series", () => {
    const pts = Array.from({ length: 60 }, (_, i) => ({ t: `h${i}`, v: 50 }));
    expect(detectSpikes(pts)).toEqual([]);
  });
  it("trend classification", () => {
    expect(trendOf([10, 10, 10, 20, 20, 20])).toBe("worsening");
    expect(trendOf([20, 20, 20, 10, 10, 10])).toBe("improving");
    expect(trendOf([10, 10, 10, 10, 10, 10])).toBe("steady");
  });
  it("geo helpers", () => {
    expect(haversineKm(28.6139, 77.209, 28.6139, 77.209)).toBe(0);
    expect(haversineKm(28.6139, 77.209, 19.076, 72.8777)).toBeGreaterThan(1100);
    expect(haversineKm(28.6139, 77.209, 19.076, 72.8777)).toBeLessThan(1200);
    expect(bearingLabel(0, 0, 1, 0)).toBe("N");
    expect(bearingLabel(0, 0, 0, 1)).toBe("E");
  });
});

import { avg24h, nowcast } from "./nowcast";

describe("NowCast", () => {
  it("equals the value for a constant series", () => {
    expect(nowcast(new Array(12).fill(40))).toBeCloseTo(40, 9);
  });
  it("weights the newest hours more when concentrations are changing quickly", () => {
    // newest = 100, previous 11 hours = 10 -> w floored to 0.5, newest dominates
    const series = [...new Array(11).fill(10), 100];
    const nc = nowcast(series)!;
    expect(nc).toBeGreaterThan(50);
    expect(nc).toBeLessThan(100);
  });
  it("is null when fewer than 2 of the last 3 hours are valid", () => {
    expect(nowcast([20, 20, 20, 20, 20, 20, 20, 20, 20, null, null, 20])).toBeNull();
    expect(nowcast([20, 20, 20, 20, 20, 20, 20, 20, 20, 20, null, 20])).not.toBeNull();
  });
  it("handles all-zero and empty input", () => {
    expect(nowcast(new Array(12).fill(0))).toBe(0);
    expect(nowcast([])).toBeNull();
  });
});

describe("avg24h", () => {
  it("averages when coverage is sufficient", () => {
    expect(avg24h(new Array(24).fill(10))).toBe(10);
  });
  it("returns null when coverage is below 16 hours (no zero-filling)", () => {
    expect(avg24h([...new Array(10).fill(10), ...new Array(14).fill(null)])).toBeNull();
  });
});

describe("toUgm3", () => {
  it("normalises units and refuses to guess", () => {
    expect(toUgm3("pm25", 12, "µg/m³")).toBe(12);
    expect(toUgm3("co", 4, "mg/m3")).toBe(4000);
    expect(toUgm3("no2", 53.14, "ppb")!).toBeCloseTo(100, 0);
    expect(toUgm3("co", 0.27, "ppb")).toBeNull();
    expect(toUgm3("so2", 1, "furlongs")).toBeNull();
    expect(toUgm3("o3", 1, null)).toBeNull();
  });
});

import { isFlatlined } from "../sources/snapshot";
describe("flatline detection", () => {
  it("flags sensors stuck near zero but not clean-but-real readings", () => {
    expect(isFlatlined(new Array(20).fill(0))).toBe(true);
    expect(isFlatlined([...new Array(12).fill(0.2)])).toBe(true);
    expect(isFlatlined(new Array(20).fill(3))).toBe(false);
    expect(isFlatlined([0, 0, 0])).toBe(false); // too few points to judge
    expect(isFlatlined(undefined)).toBe(false);
  });
});

import { CATEGORIES, NAQI_CATEGORIES } from "./categories";
describe("category colour pairs meet WCAG AA (4.5:1)", () => {
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  it("US categories", () => {
    for (const c of CATEGORIES) expect(ratio(c.color, c.ink), c.label).toBeGreaterThanOrEqual(4.5);
  });
  it("NAQI categories", () => {
    for (const c of NAQI_CATEGORIES) expect(ratio(c.color, c.ink), c.label).toBeGreaterThanOrEqual(4.5);
  });
});
