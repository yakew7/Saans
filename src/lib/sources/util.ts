import type { AdapterResult, BadgeKind, ErrorCode, Meta } from "../types";
import { isStale } from "../format";
import { UpstreamError } from "../net/http";

export function baseMeta(source: string, kind: BadgeKind, extra: Partial<Meta> = {}): Meta {
  return {
    source,
    kind,
    observedAt: null,
    fetchedAt: new Date().toISOString(),
    stationName: null,
    stationDistanceKm: null,
    stale: false,
    ...extra,
  };
}

export function okResult<T>(data: T, meta: Meta): AdapterResult<T> {
  return { ok: true, data, meta: { ...meta, stale: meta.kind === "MEASURED" ? isStale(meta.observedAt) : false } };
}

export function failResult<T = never>(source: string, kind: BadgeKind, error: string, code: ErrorCode, status?: number): AdapterResult<T> {
  return { ok: false, error, code, status, meta: baseMeta(source, kind) };
}

export function fromError<T = never>(source: string, kind: BadgeKind, err: unknown): AdapterResult<T> {
  if (err instanceof UpstreamError) return failResult<T>(source, kind, err.message, "upstream", err.status ?? undefined);
  if (err instanceof Error && err.name === "ZodError") return failResult<T>(source, kind, "Unexpected response shape from upstream", "invalid");
  return failResult<T>(source, kind, err instanceof Error ? err.message : "Unknown error", "upstream");
}

export const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d;

/** Collects cache/freshness facts across the upstream calls behind one adapter result. */
export class Tracker {
  storedAt = Date.now();
  cached = false;
  servedStale = false;
  add(c: { storedAt: number; fromCache: boolean; stale: boolean }) {
    this.storedAt = Math.min(this.storedAt, c.storedAt);
    this.cached ||= c.fromCache;
    this.servedStale ||= c.stale;
  }
  meta(): Partial<Meta> {
    return { fetchedAt: new Date(this.storedAt).toISOString(), cached: this.cached, servedStale: this.servedStale };
  }
}
