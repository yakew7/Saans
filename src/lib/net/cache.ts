/**
 * Server-side TTL cache with in-flight request de-duplication.
 * Per server instance (serverless instances do not share memory).
 * Entries are kept past their TTL for `maxStaleMs` so a failing upstream can be
 * answered with the last good value labelled "cached N min ago".
 */
interface Entry<T> {
  value: T;
  storedAt: number;
  ttlMs: number;
  maxStaleMs: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();
const MAX_ENTRIES = 600;

export interface CacheOptions {
  ttlMs: number;
  /** how long after expiry the value may still be served if the loader fails */
  maxStaleMs?: number;
}

export interface Cached<T> {
  value: T;
  /** epoch ms when the value was obtained from upstream */
  storedAt: number;
  /** served from memory rather than fresh upstream call */
  fromCache: boolean;
  /** upstream failed; this is an expired-but-usable value */
  stale: boolean;
}

function evict() {
  if (store.size <= MAX_ENTRIES) return;
  const oldest = [...store.entries()].sort((a, b) => a[1].storedAt - b[1].storedAt).slice(0, 100);
  for (const [k] of oldest) store.delete(k);
}

export async function cached<T>(key: string, opts: CacheOptions, loader: () => Promise<T>): Promise<Cached<T>> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && now - hit.storedAt < hit.ttlMs) {
    return { value: hit.value, storedAt: hit.storedAt, fromCache: true, stale: false };
  }
  const pending = inflight.get(key) as Promise<Cached<T>> | undefined;
  if (pending) return pending;

  const p = (async (): Promise<Cached<T>> => {
    try {
      const value = await loader();
      const storedAt = Date.now();
      store.set(key, { value, storedAt, ttlMs: opts.ttlMs, maxStaleMs: opts.maxStaleMs ?? 0 });
      evict();
      return { value, storedAt, fromCache: false, stale: false };
    } catch (err) {
      const old = store.get(key) as Entry<T> | undefined;
      if (old && Date.now() - old.storedAt < old.ttlMs + old.maxStaleMs) {
        return { value: old.value, storedAt: old.storedAt, fromCache: true, stale: true };
      }
      throw err;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

export function clearCache() {
  store.clear();
  inflight.clear();
}

/** TTLs (ms). WAQI terms forbid redistributing cached/archived data: minutes only. */
export const TTL = {
  live: 8 * 60_000,
  waqi: 5 * 60_000,
  waqiMaxStale: 10 * 60_000,
  forecast: 30 * 60_000,
  history: 6 * 3_600_000,
  geocode: 24 * 3_600_000,
  staleFallback: 12 * 3_600_000,
} as const;
