import type { ReactNode } from "react";

/** Card wrapper for every chart: title, provenance badge slot, description and a data-table alternative. */
export function ChartShell({
  title,
  description,
  badge,
  children,
  table,
  className = "",
}: {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
  table?: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`card p-4 sm:p-5 ${className}`}>
      <figcaption className="mb-3 space-y-1">
        <h3 className="font-display text-xl">{title}</h3>
        {description && <p className="text-sm text-[color:var(--muted)]">{description}</p>}
        {badge && <div className="pt-1">{badge}</div>}
      </figcaption>
      <div className="w-full">{children}</div>
      {table && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">View data as a table</summary>
          <div className="mt-2 max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </figure>
  );
}

export const AXIS_TICK = { fill: "var(--muted)", fontSize: 12 } as const;
export const GRID_STROKE = "color-mix(in srgb, var(--ink) 12%, transparent)";

/** Shared styled tooltip box (Recharts custom content). */
export function TipBox({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs shadow-lg">
      {title && <p className="mb-1 font-semibold">{title}</p>}
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
