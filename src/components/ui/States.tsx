"use client";
import { AlertTriangle, Info, OctagonAlert, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { Banner } from "@/lib/sources/snapshot";

const ICON = { info: Info, warn: AlertTriangle, error: OctagonAlert } as const;
const TONE = {
  info: "border-sky-600/40 bg-sky-500/10",
  warn: "border-amber-600/50 bg-amber-500/10",
  error: "border-red-600/50 bg-red-500/10",
} as const;

/** Non-blocking source/degradation notices. Always names the source and what is degraded. */
export function Banners({ banners }: { banners: Banner[] }) {
  if (!banners.length) return null;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      {banners.map((b) => {
        const Icon = ICON[b.severity];
        return (
          <div key={b.id} className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${TONE[b.severity]}`}>
            <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
            <p>
              <span className="font-semibold">{b.source}: </span>
              {b.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="card flex flex-col items-start gap-3 p-6">
      <div className="flex items-center gap-2">
        <OctagonAlert aria-hidden className="text-red-600" />
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      {message && <p className="text-sm text-[color:var(--muted)]">{message}</p>}
      {onRetry && (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--bg)]">
          <RefreshCw size={14} aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <h2 className="font-display text-xl">{title}</h2>
      {children && <div className="mt-2 text-sm text-[color:var(--muted)]">{children}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}
