import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { countAi, rateLimit, resetGuardForTests, LIMITS } from "./guard";
import { plan } from "./router";

beforeEach(() => resetGuardForTests());
afterEach(() => vi.unstubAllEnvs());

describe("rate limit and daily cap", () => {
  it("allows up to the per-minute limit then blocks with a retry hint", () => {
    const t = Date.now();
    for (let i = 0; i < LIMITS.perMinute; i++) expect(rateLimit("1.1.1.1", t + i).ok).toBe(true);
    const r = rateLimit("1.1.1.1", t + 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.retryAfterSec).toBeGreaterThan(0);
    expect(rateLimit("2.2.2.2", t).ok).toBe(true); // other IPs unaffected
  });
  it("window slides", () => {
    const t = Date.now();
    for (let i = 0; i < LIMITS.perMinute; i++) rateLimit("3.3.3.3", t);
    expect(rateLimit("3.3.3.3", t + 61_000).ok).toBe(true);
  });
  it("enforces AI_DAILY_CAP and resets on a new UTC day", () => {
    vi.stubEnv("AI_DAILY_CAP", "2");
    const d = new Date("2026-11-09T10:00:00Z");
    expect(countAi(d).ok).toBe(true);
    expect(countAi(d).ok).toBe(true);
    const blocked = countAi(d);
    expect(blocked.ok).toBe(false);
    expect(countAi(new Date("2026-11-10T00:00:01Z")).ok).toBe(true);
  });
});

describe("provider plan (failover order)", () => {
  const steps = () => plan("sys", [{ role: "user", content: "hi" }], 100).map((s) => `${s.provider}:${s.model}`);
  it("auto with both keys: Gemini first, then Groq 120b, then Groq 20b", () => {
    vi.stubEnv("LLM_PROVIDER", "auto");
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("GROQ_API_KEY", "y");
    expect(steps()).toEqual(["gemini:gemini-3.6-flash", "groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b"]);
  });
  it("auto with only one key uses only that provider", () => {
    vi.stubEnv("LLM_PROVIDER", "auto");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "y");
    expect(steps()).toEqual(["groq:openai/gpt-oss-120b", "groq:openai/gpt-oss-20b"]);
    vi.stubEnv("GEMINI_API_KEY", "x");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(steps()).toEqual(["gemini:gemini-3.6-flash"]);
  });
  it("none or no keys yields no providers (basic mode)", () => {
    vi.stubEnv("LLM_PROVIDER", "none");
    vi.stubEnv("GEMINI_API_KEY", "x");
    expect(steps()).toEqual([]);
    vi.stubEnv("LLM_PROVIDER", "auto");
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GROQ_API_KEY", "");
    expect(steps()).toEqual([]);
  });
  it("model ids are configurable via env", () => {
    vi.stubEnv("LLM_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "y");
    vi.stubEnv("GROQ_MODEL", "m-big");
    vi.stubEnv("GROQ_FALLBACK_MODEL", "m-small");
    expect(steps()).toEqual(["groq:m-big", "groq:m-small"]);
  });
});
