import { describe, expect, it } from "vitest";
import { basicAnswer } from "./basic";
import { factsToText, type Facts } from "./facts";
import { templateInsight } from "./insights";

const facts = (over: Partial<Facts> = {}): Facts => ({
  place: "Testville",
  lat: 1,
  lon: 2,
  generatedAt: "2026-11-09T00:00:00Z",
  current: { aqi: 162, category: "Unhealthy", categoryId: "unhealthy", dominant: "PM2.5", badge: "COMPUTED", source: "OpenAQ", station: "Test St", distanceKm: 1.2, observedAt: "2026-11-09T10:00:00Z", minutesOld: 30, stale: false, modelled: false, pollutants: [{ symbol: "PM2.5", value: 70, unit: "µg/m³", basis: "concentration", avg24: 80, whoRatio: 5.3 }, { symbol: "O₃", value: null, unit: null, basis: "concentration", avg24: null, whoRatio: null }], naqi: null, crossCheck: null },
  forecast: { trend: "improving", peak: { aqi: 180, local: "2026-11-10T01:00" }, daily: [{ date: "2026-11-10", min: 120, max: 180 }], best: { day: "today", start: "2026-11-09T15:00", end: "2026-11-09T17:00", aqi: 140 }, bestTomorrow: null, spikes: [] },
  history: { source: "OpenAQ station history", badge: "HISTORICAL-MEASURED", days: 14, last7Mean: 190, prev7Mean: 150, changePct: 26.7, worst: { date: "2026-11-06", aqi: 240 }, best: { date: "2026-10-30", aqi: 120 } },
  notices: [],
  ...over,
});

describe("FACTS text", () => {
  it("contains the real numbers and labels missing values instead of zero-filling", () => {
    const t = factsToText(facts());
    expect(t).toContain("CURRENT US AQI: 162 (Unhealthy)");
    expect(t).toContain("PM2.5: 70 µg/m³; 24 h mean 80.0 µg/m³; 5.3x the WHO 2021 24 h guideline");
    expect(t).toContain("O₃: not reported by this source.");
    expect(t).toContain("FORECAST 2026-11-10: AQI min 120, max 180.");
  });
  it("flags modelled values and missing data explicitly", () => {
    expect(factsToText(facts({ current: { ...facts().current!, modelled: true, badge: "MODELLED" } }))).toContain("NOT a station measurement");
    const none = factsToText(facts({ current: null, forecast: null, history: null }));
    expect(none).toContain("no air quality data is available");
    expect(none).toContain("FORECAST: not available");
  });
});

describe("basic mode", () => {
  it("answers from FACTS only", () => {
    expect(basicAnswer("Should I wear a mask?", facts())).toContain("N95");
    expect(basicAnswer("best time to go outside", facts())).toContain("140");
    expect(basicAnswer("is it getting better?", facts())).toContain("improving");
    expect(basicAnswer("what is pm2.5 now", facts())).toContain("70");
  });
  it("says it has no data rather than inventing", () => {
    expect(basicAnswer("mask?", facts({ current: null }))).toMatch(/don't have current air quality data/);
    expect(basicAnswer("forecast tomorrow", facts({ forecast: null }))).toMatch(/don't have a forecast/);
  });
});

describe("template insight", () => {
  it("is deterministic and grounded in stats", () => {
    const t = templateInsight(facts());
    expect(t).toContain("AQI 162");
    expect(t).toContain("+26.7%");
    expect(t).toContain("2026-11-06");
  });
});
