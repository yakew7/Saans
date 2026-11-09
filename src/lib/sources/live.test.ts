import { describe, expect, it } from "vitest";
import { getOpenAqDaily, getOpenAqLatest } from "./openaq";
import { getWaqiBounds, getWaqiFeedGeo, searchWaqi } from "./waqi";
import { geocode, getOpenMeteoCurrent, getOpenMeteoHourly, getOpenMeteoRange } from "./openmeteo";

/** Live integration tests. Opt-in: `npm run test:live` (needs keys in .env.local). They check shape and sanity, never fixed values. */
const live = process.env.RUN_LIVE ? describe : describe.skip;

const DELHI = { lat: 28.6139, lon: 77.209 };
const MUMBAI = { lat: 19.076, lon: 72.8777 };
const BERLIN = { lat: 52.52, lon: 13.405 };
const iso = (d: Date) => d.toISOString().slice(0, 10);

live("live upstreams", () => {
  for (const [name, p] of Object.entries({ Delhi: DELHI, Mumbai: MUMBAI, Berlin: BERLIN })) {
    it(`OpenAQ latest: ${name}`, async () => {
      const r = await getOpenAqLatest(p.lat, p.lon);
      if (!r.ok) {
        // acceptable outcome: a clean, typed failure (no station / rate limit), never a throw
        expect(["empty", "upstream"]).toContain(r.code);
        return;
      }
      expect(r.meta.kind).toBe("MEASURED");
      expect(r.data!.distanceKm).toBeLessThanOrEqual(25);
      const pm = r.data!.pollutants.pm25 ?? r.data!.pollutants.pm10;
      expect(pm && Number.isFinite(pm.value) && pm.value >= 0).toBe(true);
      expect(Date.parse(r.data!.observedAt)).toBeGreaterThan(Date.now() - 24 * 3_600_000);
    });

    it(`WAQI feed: ${name}`, async () => {
      const r = await getWaqiFeedGeo(p.lat, p.lon);
      if (!r.ok) {
        // e.g. Mumbai: WAQI has no station with current data nearby. That must be a clean typed "empty".
        expect(r.code).toBe("empty");
        return;
      }
      expect(r.meta.kind).toBe("MEASURED");
      expect(r.data!.distanceKm!).toBeLessThanOrEqual(50);
      expect(r.data!.stationName.length).toBeGreaterThan(0);
      expect(r.data!.aqi === null || r.data!.aqi >= 0).toBe(true);
    });

    it(`Open-Meteo current + hourly: ${name}`, async () => {
      const c = await getOpenMeteoCurrent(p.lat, p.lon);
      expect(c.ok).toBe(true);
      expect(c.meta.kind).toBe("MODELLED");
      const h = await getOpenMeteoHourly(p.lat, p.lon, 2, 5);
      expect(h.ok).toBe(true);
      expect(h.meta.kind).toBe("FORECAST");
      expect(h.data!.times.length).toBeGreaterThanOrEqual(24 * 6);
      expect(h.data!.pm25.some((v) => v != null)).toBe(true);
    });
  }

  it("WAQI map bounds returns stations over Delhi NCR", async () => {
    const r = await getWaqiBounds(28.4, 76.9, 28.9, 77.5);
    expect(r.ok).toBe(true);
    expect(r.data!.length).toBeGreaterThan(5);
  });

  it("WAQI search finds Mumbai stations", async () => {
    const r = await searchWaqi("mumbai");
    expect(r.ok).toBe(true);
    expect(r.data!.length).toBeGreaterThan(0);
  });

  it("Open-Meteo range history works for Delhi (modelled)", async () => {
    const to = new Date(Date.now() - 3 * 86400000);
    const from = new Date(to.getTime() - 14 * 86400000);
    const r = await getOpenMeteoRange(DELHI.lat, DELHI.lon, iso(from), iso(to));
    expect(r.ok).toBe(true);
    expect(r.meta.kind).toBe("MODELLED");
    expect(r.data!.times.length).toBeGreaterThan(14 * 24 - 1);
  });

  it("OpenAQ daily history for Delhi (historical-measured)", async () => {
    const to = new Date(Date.now() - 2 * 86400000);
    const from = new Date(to.getTime() - 20 * 86400000);
    const r = await getOpenAqDaily(DELHI.lat, DELHI.lon, iso(from), iso(to));
    if (!r.ok) {
      expect(["empty", "upstream"]).toContain(r.code);
      return;
    }
    expect(r.meta.kind).toBe("HISTORICAL-MEASURED");
    expect(r.data!.pm25.length + r.data!.pm10.length).toBeGreaterThan(5);
  });

  it("geocoding finds Pune", async () => {
    const r = await geocode("Pune");
    expect(r.ok).toBe(true);
    expect(r.data![0].lat).toBeCloseTo(18.5, 0);
  });
});
