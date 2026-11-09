import { describe, expect, it } from "vitest";
import { bestTimeToGoOut, dailyRanges, forecastTrend, predictedSpikes, type Hour } from "./forecast";

const hourly = (date: string, aqiByHour: (h: number) => number | null): Hour[] =>
  Array.from({ length: 24 }, (_, h) => ({ t: `${date}T${String(h).padStart(2, "0")}:00:00Z`, local: `${date}T${String(h).padStart(2, "0")}:00`, aqi: aqiByHour(h), pm25: null, pm10: null }));

describe("dailyRanges", () => {
  it("computes min, max, mean and peak hour per day, skipping nulls", () => {
    const d = dailyRanges(hourly("2026-11-10", (h) => (h === 5 ? null : h === 15 ? 220 : 100)));
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ date: "2026-11-10", min: 100, max: 220, peakLocal: "2026-11-10T15:00", hours: 23 });
  });
});

describe("bestTimeToGoOut", () => {
  it("finds the lowest 2 h window at or after now within daylight", () => {
    const hrs = hourly("2026-11-10", (h) => (h === 13 || h === 14 ? 60 : 150));
    const b = bestTimeToGoOut(hrs, "2026-11-10T09:20")!;
    expect(b.startLocal).toBe("2026-11-10T13:00");
    expect(b.endLocal).toBe("2026-11-10T15:00");
    expect(b.meanAqi).toBe(60);
    expect(b.dayLabel).toBe("today");
    expect(b.improvement).toBeGreaterThan(0);
  });
  it("ignores windows before now", () => {
    const hrs = hourly("2026-11-10", (h) => (h === 7 || h === 8 ? 30 : 120));
    const b = bestTimeToGoOut(hrs, "2026-11-10T10:00")!;
    expect(b.startLocal >= "2026-11-10T10:00").toBe(true);
  });
  it("falls back to tomorrow late in the evening", () => {
    const hrs = [...hourly("2026-11-10", () => 120), ...hourly("2026-11-11", (h) => (h === 10 || h === 11 ? 70 : 130))];
    const b = bestTimeToGoOut(hrs, "2026-11-10T21:00")!;
    expect(b.dayLabel).toBe("tomorrow");
    expect(b.startLocal).toBe("2026-11-11T10:00");
  });
  it("returns null when data is missing", () => {
    expect(bestTimeToGoOut([], "2026-11-10T09:00")).toBeNull();
  });
});

describe("forecast analytics", () => {
  it("classifies trend", () => {
    const rise = Array.from({ length: 48 }, (_, i) => ({ t: String(i), local: String(i), aqi: 100 + i * 3, pm25: null, pm10: null }));
    expect(forecastTrend(rise).trend).toBe("worsening");
    const flat = rise.map((h) => ({ ...h, aqi: 100 }));
    expect(forecastTrend(flat).trend).toBe("steady");
    expect(forecastTrend(rise.slice(0, 5)).trend).toBe("steady");
  });
  it("flags a predicted spike only in the forecast part", () => {
    const hrs: Hour[] = Array.from({ length: 96 }, (_, i) => ({ t: String(i), local: `h${i}`, aqi: 120 + (i % 3), pm25: null, pm10: null }));
    hrs[30] = { ...hrs[30], aqi: 400 }; // before "now"
    hrs[70] = { ...hrs[70], aqi: 380 }; // forecast
    const s = predictedSpikes(hrs, 48);
    expect(s.map((x) => x.local)).toEqual(["h70"]);
  });
});
