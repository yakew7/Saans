"use client";

import * as Tooltip from "@radix-ui/react-tooltip";
import { TriangleAlert } from "lucide-react";
import type { BadgeKind } from "@/lib/types";
import { BADGE_INFO } from "./badge-info";
import { agoLabel, formatObserved, isStale, minutesAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";

export interface DataBadgeProps {
  kind: BadgeKind;
  source: string;
  observedAt?: string | null;
  fetchedAt?: string | null;
  stale?: boolean;
  cached?: boolean;
  /** formula (COMPUTED) or backtest note (EXPERIMENTAL-ML) shown on hover/focus */
  detail?: string;
  /** compact = pill only, with full provenance in the tooltip (use inside dense tables) */
  compact?: boolean;
  className?: string;
}

export function DataBadge({ kind, source, observedAt, fetchedAt, stale, cached, detail, compact, className = "" }: DataBadgeProps) {
  const info = BADGE_INFO[kind];
  const now = useNow();
  const isStaleNow = stale ?? (now != null && isStale(observedAt, now));
  const fetchedMin = now != null ? minutesAgo(fetchedAt, now) : null;
  const observed = now != null ? formatObserved(observedAt) : "…";

  const provenance = (
    <>
      <span className="font-semibold">{source}</span>
      <span aria-hidden> · </span>
      <time dateTime={observedAt ?? undefined}>{observed}</time>
      {fetchedAt && fetchedMin != null && (
        <>
          <span aria-hidden> · </span>
          <span>{cached ? "cached" : "fetched"} {agoLabel(fetchedMin)}</span>
        </>
      )}
    </>
  );

  const pill = (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide leading-none ${info.cls}`}
    >
      {info.icon}
      {info.label}
    </span>
  );

  const staleTag = isStaleNow ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-600 text-amber-900 dark:text-amber-200 px-2 py-0.5 text-[10.5px] font-bold uppercase leading-none">
      <TriangleAlert size={11} aria-hidden /> Stale &gt; 3 h
    </span>
  ) : null;

  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>
        <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-1 ${className}`} tabIndex={0} data-badge={kind}>
          {pill}
          {staleTag}
          {!compact && <span className="text-xs text-[color:var(--muted)]">{provenance}</span>}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="top"
          sideOffset={6}
          className="z-50 max-w-xs rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-xs text-[color:var(--ink)] shadow-lg"
        >
          <p className="font-semibold">{info.label}</p>
          <p className="mt-0.5 text-[color:var(--muted)]">{info.meaning}</p>
          <p className="mt-1.5">{provenance}</p>
          {isStaleNow && <p className="mt-1 text-amber-700 dark:text-amber-300">This reading is more than 3 hours old.</p>}
          {detail && <p className="mt-1.5 border-t border-[color:var(--border)] pt-1.5 font-mono text-[11px]">{detail}</p>}
          <Tooltip.Arrow className="fill-[color:var(--border)]" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
