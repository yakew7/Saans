import { describe, expect, it } from "vitest";
import { cleanest, parseLocs, serializeLocs } from "./compare";

describe("compare URL state", () => {
  it("round-trips places including commas in names", () => {
    const places = [
      { name: "Delhi", lat: 28.6139, lon: 77.209 },
      { name: "Paris, France", lat: 48.8566, lon: 2.3522 },
    ];
    const s = serializeLocs(places);
    expect(parseLocs(s)).toEqual([
      { name: "Delhi", lat: 28.614, lon: 77.209 },
      { name: "Paris, France", lat: 48.857, lon: 2.352 },
    ]);
  });
  it("rejects bad coordinates and caps at 4", () => {
    expect(parseLocs("999,10,X~abc,2,Y~10,20,Ok")).toEqual([{ name: "Ok", lat: 10, lon: 20 }]);
    expect(parseLocs("1,1,A~2,2,B~3,3,C~4,4,D~5,5,E")).toHaveLength(4);
    expect(parseLocs(null)).toEqual([]);
    expect(parseLocs(",,")).toEqual([]);
  });
});

describe("cleanest", () => {
  it("picks the lowest AQI among measured locations and ignores modelled ones when measured exist", () => {
    const r = cleanest([
      { name: "A", aqi: 120, measured: true },
      { name: "B", aqi: 60, measured: false },
      { name: "C", aqi: 90, measured: true },
      { name: "D", aqi: null, measured: false },
    ]);
    expect(r.winner?.name).toBe("C");
    expect(r.basis).toBe("measured");
    expect(r.missing).toEqual(["D"]);
    expect(r.considered).toBe(2);
  });
  it("falls back to modelled and reports no winner when nothing has data", () => {
    expect(cleanest([{ name: "A", aqi: 50, measured: false }]).basis).toBe("modelled");
    expect(cleanest([{ name: "A", aqi: null, measured: false }]).winner).toBeNull();
  });
});
