import { cached } from "./net/cache";
import { fetchJson } from "./net/http";
import { getHealth, type SourceHealth } from "./net/health";

export interface SourceStatus extends SourceHealth {
  role: string;
  configured: boolean;
  /** result of the live probe made for this status request */
  probe: "up" | "down" | "not_configured";
  probeLatencyMs: number | null;
  probeError: string | null;
}

export interface StatusResponse {
  generatedAt: string;
  sources: SourceStatus[];
  env: { name: string; set: boolean; required: boolean }[];
  llm: { provider: string; geminiModel: string; groqModel: string; groqFallbackModel: string; whisperModel: string; dailyCap: number };
}

const set = (n: string) => Boolean(process.env[n]?.trim());

interface Def {
  source: string;
  role: string;
  configured: boolean;
  url: () => string;
  headers?: () => Record<string, string>;
}

const defs = (): Def[] => [
  {
    source: "OpenAQ",
    role: "Measured raw concentrations, hourly + daily history",
    configured: set("OPENAQ_API_KEY"),
    url: () => "https://api.openaq.org/v3/locations?limit=1",
    headers: () => ({ "X-API-Key": process.env.OPENAQ_API_KEY!.trim() }),
  },
  {
    source: "WAQI",
    role: "Station AQI, map bounds, forecast",
    configured: set("WAQI_API_TOKEN"),
    url: () => `https://api.waqi.info/search/?keyword=delhi&token=${encodeURIComponent(process.env.WAQI_API_TOKEN!.trim())}`,
  },
  { source: "Open-Meteo (CAMS)", role: "Modelled + forecast air quality (no key)", configured: true, url: () => "https://air-quality-api.open-meteo.com/v1/air-quality?latitude=28.6&longitude=77.2&current=us_aqi" },
  { source: "Open-Meteo Geocoding", role: "City search (no key)", configured: true, url: () => "https://geocoding-api.open-meteo.com/v1/search?name=Delhi&count=1" },
  {
    source: "Gemini",
    role: "AI assistant + insights (primary)",
    configured: set("GEMINI_API_KEY"),
    url: () => "https://generativelanguage.googleapis.com/v1beta/models?pageSize=1",
    headers: () => ({ "x-goog-api-key": process.env.GEMINI_API_KEY!.trim() }),
  },
  {
    source: "Groq",
    role: "AI failover + Whisper transcription",
    configured: set("GROQ_API_KEY"),
    url: () => "https://api.groq.com/openai/v1/models",
    headers: () => ({ Authorization: `Bearer ${process.env.GROQ_API_KEY!.trim()}` }),
  },
];

async function probe(d: Def): Promise<{ state: SourceStatus["probe"]; ms: number | null; error: string | null }> {
  if (!d.configured) return { state: "not_configured", ms: null, error: null };
  const t0 = Date.now();
  try {
    await fetchJson(d.url(), { source: d.source, headers: d.headers?.(), retries: 0, timeoutMs: 6000 });
    return { state: "up", ms: Date.now() - t0, error: null };
  } catch (e) {
    return { state: "down", ms: null, error: e instanceof Error ? e.message : "failed" };
  }
}

/** Live probe of every upstream (cached 60 s so the page cannot be used to hammer providers). Values of keys are never exposed. */
export async function getStatus(): Promise<StatusResponse> {
  const c = await cached("status", { ttlMs: 60_000 }, async () => {
    const list = defs();
    const probes = await Promise.all(list.map(probe));
    return { probes, at: Date.now() };
  });
  const list = defs();
  const health = getHealth(list.map((d) => d.source));
  return {
    generatedAt: new Date(c.value.at).toISOString(),
    sources: list.map((d, i) => ({
      ...health[i],
      role: d.role,
      configured: d.configured,
      probe: c.value.probes[i].state,
      probeLatencyMs: c.value.probes[i].ms,
      probeError: c.value.probes[i].error,
    })),
    env: [
      { name: "OPENAQ_API_KEY", set: set("OPENAQ_API_KEY"), required: true },
      { name: "WAQI_API_TOKEN", set: set("WAQI_API_TOKEN"), required: true },
      { name: "GEMINI_API_KEY", set: set("GEMINI_API_KEY"), required: false },
      { name: "GROQ_API_KEY", set: set("GROQ_API_KEY"), required: false },
      { name: "NEXT_PUBLIC_CARTO_KEY", set: set("NEXT_PUBLIC_CARTO_KEY"), required: false },
      { name: "NEXT_PUBLIC_SITE_URL", set: set("NEXT_PUBLIC_SITE_URL"), required: false },
    ],
    llm: {
      provider: process.env.LLM_PROVIDER?.trim() || "auto",
      geminiModel: process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash",
      groqModel: process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b",
      groqFallbackModel: process.env.GROQ_FALLBACK_MODEL?.trim() || "openai/gpt-oss-20b",
      whisperModel: process.env.GROQ_WHISPER_MODEL?.trim() || "whisper-large-v3-turbo",
      dailyCap: Number(process.env.AI_DAILY_CAP) || 500,
    },
  };
}
