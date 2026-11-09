import { cached } from "../net/cache";
import { fmtLocal } from "../format";
import { buildFacts, type Facts } from "./facts";
import { completeText } from "./router";
import { countAi } from "./guard";

export interface Insight {
  text: string;
  /** true when written by an AI model from the computed stats; false for the deterministic template */
  ai: boolean;
  provider: string | null;
  model: string | null;
  /** the exact computed statistics the text is grounded in */
  stats: Record<string, unknown>;
  generatedAt: string;
}

/** Deterministic summary from computed statistics only (also the fallback when no AI model is available). */
export function templateInsight(f: Facts): string {
  const parts: string[] = [];
  const c = f.current;
  if (c) parts.push(`${f.place} is at AQI ${c.aqi} (${c.category}), ${c.modelled ? "a modelled estimate" : "from a station"}, with ${c.dominant ?? "no clear dominant pollutant"} leading.`);
  const h = f.history;
  if (h && h.changePct != null && h.last7Mean != null && h.prev7Mean != null) {
    const dir = h.changePct > 5 ? "higher than" : h.changePct < -5 ? "lower than" : "about the same as";
    parts.push(`The last 7 days averaged AQI ${h.last7Mean}, ${dir} the 7 days before (${h.prev7Mean}, ${h.changePct > 0 ? "+" : ""}${h.changePct}%).`);
  }
  if (h?.worst) parts.push(`The worst recent day was ${h.worst.date} (AQI ${h.worst.aqi}).`);
  const fc = f.forecast;
  if (fc) parts.push(`The model forecast expects air quality to be ${fc.trend} over the next five days${fc.best ? `, with the cleanest outdoor window ${fc.best.day} at ${fmtLocal(fc.best.start, "time")}–${fmtLocal(fc.best.end, "time")}` : ""}.`);
  return parts.join(" ") || `No data is available to summarise for ${f.place} right now.`;
}

const SYS =
  "You write a short (3 sentences, max 70 words) plain-language air quality summary for a dashboard card. " +
  "Use ONLY the numbers in the STATS JSON provided. Do not add numbers, causes or advice that are not in it. " +
  "Say which values are measured, modelled or forecast as the STATS indicate. Be calm and factual.";

/** AI-written insight grounded ONLY in computed stats, with a deterministic fallback. Cached 30 minutes per place. */
export async function getInsight(lat: number, lon: number, place: string): Promise<Insight> {
  const key = `insight:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const c = await cached(key, { ttlMs: 30 * 60_000, maxStaleMs: 60 * 60_000 }, async (): Promise<Insight> => {
    const facts = await buildFacts(lat, lon, place);
    const stats = { place: facts.place, current: facts.current && { aqi: facts.current.aqi, category: facts.current.category, type: facts.current.badge, dominant: facts.current.dominant }, history: facts.history, forecast: facts.forecast && { trend: facts.forecast.trend, peak: facts.forecast.peak, best: facts.forecast.best } };
    const fallback: Insight = { text: templateInsight(facts), ai: false, provider: null, model: null, stats, generatedAt: new Date().toISOString() };
    if (!facts.current) return fallback;
    if (!countAi().ok) return fallback;
    const r = await completeText(SYS, `STATS:\n${JSON.stringify(stats)}`, 160).catch(() => null);
    return r ? { ...fallback, text: r.text, ai: true, provider: r.provider, model: r.model } : fallback;
  });
  return c.value;
}
