import { z } from "zod";
import type { AdapterResult } from "../types";
import { cached, TTL } from "../net/cache";
import { fetchJson } from "../net/http";
import { baseMeta, fromError, okResult, Tracker } from "./util";
import { localToIso } from "./openmeteo";

/** Open-Meteo weather (no key): features for the experimental ML model. Past ~2 months of analysis + 3 forecast days. */
const SOURCE = "Open-Meteo Weather";
const nums = z.array(z.number().nullable());
const Resp = z.object({
  utc_offset_seconds: z.number(),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: nums,
    relative_humidity_2m: nums,
    wind_speed_10m: nums,
    boundary_layer_height: nums,
    precipitation: nums,
  }),
});

export interface WeatherHourly {
  /** ISO UTC instants */
  times: string[];
  utcOffsetSeconds: number;
  temp: (number | null)[];
  rh: (number | null)[];
  wind: (number | null)[];
  blh: (number | null)[];
  precip: (number | null)[];
}

export async function getWeatherHourly(lat: number, lon: number, pastDays: number, forecastDays: number): Promise<AdapterResult<WeatherHourly>> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,boundary_layer_height,precipitation&past_days=${Math.min(92, pastDays)}&forecast_days=${Math.min(7, forecastDays)}&timezone=auto`;
    const trk = new Tracker();
    const c = await cached(`wx:${url}`, { ttlMs: TTL.forecast, maxStaleMs: TTL.staleFallback }, async () => {
      const { json } = await fetchJson(url, { source: SOURCE });
      return Resp.parse(json);
    });
    trk.add(c);
    const r = c.value;
    const h = r.hourly;
    const data: WeatherHourly = {
      times: h.time.map((t) => localToIso(t, r.utc_offset_seconds)),
      utcOffsetSeconds: r.utc_offset_seconds,
      temp: h.temperature_2m,
      rh: h.relative_humidity_2m,
      wind: h.wind_speed_10m,
      blh: h.boundary_layer_height,
      precip: h.precipitation,
    };
    return okResult(data, baseMeta(SOURCE, "MODELLED", { ...trk.meta(), observedAt: data.times.at(-1) ?? null }));
  } catch (e) {
    return fromError(SOURCE, "MODELLED", e);
  }
}
