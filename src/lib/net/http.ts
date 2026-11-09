import { recordFailure, recordSuccess } from "./health";

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly source: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = "UpstreamError";
  }
}

export interface FetchJsonOptions {
  source: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** max retries on 429 / 5xx / network errors */
  retries?: number;
  /** base backoff in ms (doubles each retry) */
  backoffMs?: number;
  /** don't wait longer than this for Retry-After (serverless time budget) */
  maxRetryAfterMs?: number;
  fetchImpl?: typeof fetch;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseRetryAfter(h: string | null, cap: number): number | null {
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, cap);
  const date = Date.parse(h);
  if (!Number.isNaN(date)) return Math.min(Math.max(0, date - Date.now()), cap);
  return null;
}

function rateLimit(res: Response) {
  const rem = res.headers.get("x-ratelimit-remaining");
  const lim = res.headers.get("x-ratelimit-limit");
  return {
    remaining: rem != null && rem !== "" && Number.isFinite(Number(rem)) ? Number(rem) : null,
    limit: lim != null && lim !== "" && Number.isFinite(Number(lim)) ? Number(lim) : null,
  };
}

/**
 * Fetch JSON with an 8 s timeout, Retry-After handling, exponential backoff
 * (max 2 retries by default) and health recording. Never logs URLs (they may contain tokens).
 */
export async function fetchJson(url: string, opts: FetchJsonOptions): Promise<{ json: unknown; status: number; latencyMs: number }> {
  const { source, headers, timeoutMs = 8000, retries = 2, backoffMs = 400, maxRetryAfterMs = 4000, fetchImpl = fetch } = opts;
  let lastErr: UpstreamError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let waitMs = backoffMs * 2 ** attempt;
    try {
      const res = await fetchImpl(url, { headers: { accept: "application/json", ...headers }, signal: ctrl.signal, cache: "no-store" });
      const latency = Date.now() - started;
      const rl = rateLimit(res);

      if (res.ok) {
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          recordFailure(source, "malformed JSON", res.status, rl);
          throw new UpstreamError("Upstream returned malformed JSON", res.status, source, false);
        }
        recordSuccess(source, res.status, latency, rl);
        return { json, status: res.status, latencyMs: latency };
      }

      const retryable = res.status === 429 || res.status >= 500;
      const msg = res.status === 429 ? "rate limited (HTTP 429)" : `HTTP ${res.status}`;
      recordFailure(source, msg, res.status, rl);
      lastErr = new UpstreamError(msg, res.status, source, retryable);
      if (res.status === 429) {
        const ra = parseRetryAfter(res.headers.get("retry-after"), maxRetryAfterMs);
        if (ra != null) waitMs = ra;
      }
      if (!retryable) throw lastErr;
    } catch (e) {
      if (e instanceof UpstreamError) {
        if (!e.retryable) throw e;
        lastErr = e;
      } else {
        const aborted = e instanceof Error && e.name === "AbortError";
        const msg = aborted ? `timed out after ${timeoutMs} ms` : "network error";
        recordFailure(source, msg, null);
        lastErr = new UpstreamError(msg, null, source, true);
      }
    } finally {
      clearTimeout(timer);
    }
    if (attempt < retries) await sleep(waitMs);
  }
  throw lastErr ?? new UpstreamError("unknown upstream failure", null, source);
}
