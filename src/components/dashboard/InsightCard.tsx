"use client";

import { useQuery } from "@tanstack/react-query";
import { Bot, FileText } from "lucide-react";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import type { Insight } from "@/lib/llm/insights";
import { Skeleton } from "@/components/ui/States";

/** Short trend summary grounded ONLY in computed statistics. Labelled AI-generated, or a deterministic template when no model is available. */
export function InsightCard({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const q = useQuery({
    queryKey: ["insight", lat.toFixed(2), lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<Insight>(`/api/insights?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}&name=${encodeURIComponent(name)}`),
    staleTime: 30 * 60_000,
    retry: 0,
  });
  if (q.isError) return null; // optional enrichment: never block or break the dashboard
  return (
    <section aria-labelledby="ins-h" className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ins-h" className="font-display text-xl">The short version</h2>
        {q.data && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-2.5 py-1 text-[11px] font-semibold">
            {q.data.ai ? <Bot size={12} aria-hidden /> : <FileText size={12} aria-hidden />}
            {q.data.ai ? "AI-generated" : "Template summary"}
          </span>
        )}
      </div>
      {q.isPending ? (
        <Skeleton className="mt-3 h-16 w-full" />
      ) : (
        <>
          <p className="mt-2 leading-relaxed" aria-live="polite">{q.data!.text}</p>
          <details className="mt-2 text-xs text-[color:var(--muted)]">
            <summary className="cursor-pointer">How this was made</summary>
            <p className="mt-1">
              {q.data!.ai ? `Written by ${q.data!.provider} (${q.data!.model}) from the computed statistics below only. It cannot see anything else.` : "Built by a fixed template from the computed statistics below (no AI model was used)."}
            </p>
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-[color:var(--surface-2)] p-2 text-[11px]">{JSON.stringify(q.data!.stats, null, 2)}</pre>
          </details>
        </>
      )}
    </section>
  );
}
