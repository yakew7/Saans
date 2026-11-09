import { afterEach, describe, expect, it, vi } from "vitest";
import { cached, clearCache } from "./cache";
import { fetchJson, UpstreamError } from "./http";
import { getHealth } from "./health";

afterEach(() => clearCache());

describe("cached()", () => {
  it("serves from memory within TTL", async () => {
    const loader = vi.fn(async () => 1);
    const a = await cached("k1", { ttlMs: 1000 }, loader);
    const b = await cached("k1", { ttlMs: 1000 }, loader);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(a.fromCache).toBe(false);
    expect(b.fromCache).toBe(true);
  });
  it("de-duplicates concurrent in-flight requests", async () => {
    const loader = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return "x";
    });
    const [a, b, c] = await Promise.all([cached("k2", { ttlMs: 1000 }, loader), cached("k2", { ttlMs: 1000 }, loader), cached("k2", { ttlMs: 1000 }, loader)]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect([a.value, b.value, c.value]).toEqual(["x", "x", "x"]);
  });
  it("serves expired value as stale when the loader fails (within maxStale)", async () => {
    await cached("k3", { ttlMs: 1, maxStaleMs: 10_000 }, async () => "old");
    await new Promise((r) => setTimeout(r, 5));
    const r = await cached("k3", { ttlMs: 1, maxStaleMs: 10_000 }, async () => {
      throw new Error("down");
    });
    expect(r.value).toBe("old");
    expect(r.stale).toBe(true);
  });
  it("rethrows when nothing usable is cached", async () => {
    await expect(
      cached("k4", { ttlMs: 1000 }, async () => {
        throw new Error("down");
      }),
    ).rejects.toThrow("down");
  });
});

const ok = (body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status: 200, headers });

describe("fetchJson()", () => {
  it("returns parsed JSON and records health + rate-limit headers", async () => {
    const f = vi.fn(async () => ok({ a: 1 }, { "x-ratelimit-remaining": "55", "x-ratelimit-limit": "60" }));
    const r = await fetchJson("https://x.test/a", { source: "t-ok", fetchImpl: f as unknown as typeof fetch });
    expect(r.json).toEqual({ a: 1 });
    const h = getHealth(["t-ok"])[0];
    expect(h.successes).toBe(1);
    expect(h.rateLimitRemaining).toBe(55);
  });
  it("retries on 429 honouring Retry-After, then succeeds", async () => {
    let n = 0;
    const f = vi.fn(async () => (n++ === 0 ? new Response("{}", { status: 429, headers: { "retry-after": "0" } }) : ok({ ok: true })));
    const r = await fetchJson("https://x.test/b", { source: "t-429", fetchImpl: f as unknown as typeof fetch, backoffMs: 1 });
    expect(r.json).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("gives up after max retries on 5xx", async () => {
    const f = vi.fn(async () => new Response("no", { status: 503 }));
    await expect(fetchJson("https://x.test/c", { source: "t-5xx", fetchImpl: f as unknown as typeof fetch, backoffMs: 1, retries: 2 })).rejects.toMatchObject({ status: 503 });
    expect(f).toHaveBeenCalledTimes(3);
  });
  it("does not retry 4xx", async () => {
    const f = vi.fn(async () => new Response("no", { status: 401 }));
    await expect(fetchJson("https://x.test/d", { source: "t-401", fetchImpl: f as unknown as typeof fetch, backoffMs: 1 })).rejects.toBeInstanceOf(UpstreamError);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("times out slow upstreams", async () => {
    const f = vi.fn((_u: string, init?: RequestInit) => new Promise<Response>((_res, rej) => init?.signal?.addEventListener("abort", () => rej(Object.assign(new Error("a"), { name: "AbortError" })))));
    await expect(fetchJson("https://x.test/e", { source: "t-to", fetchImpl: f as unknown as typeof fetch, timeoutMs: 10, retries: 0 })).rejects.toThrow(/timed out/);
  });
  it("reports malformed JSON without retrying", async () => {
    const f = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(fetchJson("https://x.test/f", { source: "t-bad", fetchImpl: f as unknown as typeof fetch })).rejects.toThrow(/malformed/);
    expect(f).toHaveBeenCalledTimes(1);
  });
});
