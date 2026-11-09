/**
 * Abuse protection for AI endpoints: per-IP rate limit + a global daily cap (env AI_DAILY_CAP).
 * In-memory per server instance (best effort on serverless; the provider's own free-tier limits are the hard backstop).
 */
const hits = new Map<string, number[]>();
let day = "";
let used = 0;

export const LIMITS = { perMinute: 8, perHour: 60 };

export function dailyCap(): number {
  const n = Number(process.env.AI_DAILY_CAP);
  return Number.isFinite(n) && n > 0 ? n : 500;
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim().slice(0, 64);
}

export type GuardResult = { ok: true } | { ok: false; reason: "rate" | "cap"; retryAfterSec: number };

/** Count a request against the caller's rate limit. Does NOT touch the daily cap (see countAi). */
export function rateLimit(ip: string, now = Date.now()): GuardResult {
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  const lastMin = arr.filter((t) => now - t < 60_000);
  if (lastMin.length >= LIMITS.perMinute) return { ok: false, reason: "rate", retryAfterSec: Math.ceil((60_000 - (now - lastMin[0])) / 1000) };
  if (arr.length >= LIMITS.perHour) return { ok: false, reason: "rate", retryAfterSec: Math.ceil((3_600_000 - (now - arr[0])) / 1000) };
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 3_600_000)) hits.delete(k);
  return { ok: true };
}

/** Count one AI/transcription call against the global daily cap (UTC day). */
export function countAi(now = new Date()): GuardResult {
  const d = now.toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    used = 0;
  }
  if (used >= dailyCap()) {
    const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
    return { ok: false, reason: "cap", retryAfterSec: Math.ceil((next - now.getTime()) / 1000) };
  }
  used++;
  return { ok: true };
}

export function aiUsage() {
  return { used, cap: dailyCap(), day };
}

export function resetGuardForTests() {
  hits.clear();
  day = "";
  used = 0;
}
