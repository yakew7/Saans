export function formatObserved(iso: string | null | undefined): string {
  if (!iso) return "time unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "time unknown";
  const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZoneName: "short" }).format(d);
  return `${date}, ${time}`;
}

export function minutesAgo(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 60000));
}

export function agoLabel(mins: number | null): string {
  if (mins == null) return "unknown";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 48) return `${h} h ${mins % 60} min ago`;
  return `${Math.floor(h / 24)} d ago`;
}

export const STALE_AFTER_MIN = 180;

export function isStale(observedAt: string | null | undefined, now = Date.now()): boolean {
  const m = minutesAgo(observedAt, now);
  return m != null && m > STALE_AFTER_MIN;
}

export function fmtNum(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
