/** In-memory (per server instance) upstream health registry, surfaced on /status. */
export interface SourceHealth {
  source: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  lastStatus: number | null;
  lastLatencyMs: number | null;
  /** exponential moving average of latency of successful calls */
  avgLatencyMs: number | null;
  successes: number;
  failures: number;
  rateLimitRemaining: number | null;
  rateLimitLimit: number | null;
}

const registry = new Map<string, SourceHealth>();

function entry(source: string): SourceHealth {
  let h = registry.get(source);
  if (!h) {
    h = {
      source,
      lastSuccessAt: null,
      lastFailureAt: null,
      lastError: null,
      lastStatus: null,
      lastLatencyMs: null,
      avgLatencyMs: null,
      successes: 0,
      failures: 0,
      rateLimitRemaining: null,
      rateLimitLimit: null,
    };
    registry.set(source, h);
  }
  return h;
}

export function recordSuccess(source: string, status: number, latencyMs: number, rl?: { remaining?: number | null; limit?: number | null }) {
  const h = entry(source);
  h.lastSuccessAt = new Date().toISOString();
  h.lastStatus = status;
  h.lastLatencyMs = latencyMs;
  h.avgLatencyMs = h.avgLatencyMs == null ? latencyMs : Math.round(h.avgLatencyMs * 0.7 + latencyMs * 0.3);
  h.successes++;
  if (rl?.remaining != null) h.rateLimitRemaining = rl.remaining;
  if (rl?.limit != null) h.rateLimitLimit = rl.limit;
}

export function recordFailure(source: string, error: string, status: number | null, rl?: { remaining?: number | null; limit?: number | null }) {
  const h = entry(source);
  h.lastFailureAt = new Date().toISOString();
  h.lastError = error;
  h.lastStatus = status;
  h.failures++;
  if (rl?.remaining != null) h.rateLimitRemaining = rl.remaining;
  if (rl?.limit != null) h.rateLimitLimit = rl.limit;
}

export function getHealth(sources: string[]): SourceHealth[] {
  return sources.map((s) => ({ ...entry(s) }));
}
