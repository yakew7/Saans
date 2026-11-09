"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, XCircle } from "lucide-react";
import { agoLabel, minutesAgo } from "@/lib/format";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useNow } from "@/lib/hooks/useNow";
import type { StatusResponse } from "@/lib/status";
import { ErrorState, Skeleton } from "@/components/ui/States";

export function StatusPage() {
  const q = useQuery({ queryKey: ["status"], queryFn: () => fetchJsonOrThrow<StatusResponse>("/api/status"), refetchInterval: 60_000 });
  const now = useNow();
  const d = q.data;
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">System status</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Live health of every upstream data provider. Probes run when this page loads (cached for 60 s). Environment keys are shown as set / not set only, never their values.</p>
      </div>
      {q.isPending && <Skeleton className="h-64 w-full" />}
      {q.isError && <ErrorState title="Couldn't load status" message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <section aria-labelledby="up-h" className="card p-4 sm:p-5">
            <h2 id="up-h" className="font-display text-2xl">Upstream providers</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <caption className="sr-only">Health of each upstream data source</caption>
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                    <th scope="col" className="py-2 pr-3">Provider</th>
                    <th scope="col" className="py-2 pr-3">Status</th>
                    <th scope="col" className="py-2 pr-3">Latency</th>
                    <th scope="col" className="py-2 pr-3">Last success</th>
                    <th scope="col" className="py-2 pr-3">Rate-limit headroom</th>
                    <th scope="col" className="py-2">Calls ok / failed</th>
                  </tr>
                </thead>
                <tbody>
                  {d.sources.map((s) => {
                    const Icon = s.probe === "up" ? CheckCircle2 : s.probe === "down" ? XCircle : CircleSlash;
                    const last = s.lastSuccessAt && now ? agoLabel(minutesAgo(s.lastSuccessAt, now)) : "—";
                    return (
                      <tr key={s.source} className="border-b border-[color:var(--border)]/60 align-top">
                        <th scope="row" className="py-3 pr-3 font-medium">{s.source}<span className="block text-xs font-normal text-[color:var(--muted)]">{s.role}</span></th>
                        <td className="py-3 pr-3">
                          <span className={`inline-flex items-center gap-1.5 font-semibold ${s.probe === "up" ? "text-emerald-700 dark:text-emerald-300" : s.probe === "down" ? "text-red-700 dark:text-red-300" : "text-[color:var(--muted)]"}`}>
                            <Icon size={16} aria-hidden />{s.probe === "up" ? "Operational" : s.probe === "down" ? "Down" : "Not configured"}
                          </span>
                          {s.probeError && <span className="block text-xs text-red-700 dark:text-red-300">{s.probeError}</span>}
                        </td>
                        <td className="py-3 pr-3 tabular-nums">{s.probeLatencyMs != null ? `${s.probeLatencyMs} ms` : "—"}{s.avgLatencyMs != null && <span className="block text-xs text-[color:var(--muted)]">avg {s.avgLatencyMs} ms</span>}</td>
                        <td className="py-3 pr-3">{last}</td>
                        <td className="py-3 pr-3 tabular-nums">{s.rateLimitRemaining != null ? `${s.rateLimitRemaining}${s.rateLimitLimit != null ? ` / ${s.rateLimitLimit}` : ""} requests` : <span className="text-[color:var(--muted)]">not reported</span>}</td>
                        <td className="py-3 tabular-nums">{s.successes} / {s.failures}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[color:var(--muted)]">Call counts and latency are per server instance since it started (serverless instances do not share memory). Rate-limit headroom comes from the provider’s response headers where available (OpenAQ: 60 requests/min).</p>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="env-h" className="card p-5">
              <h2 id="env-h" className="font-display text-2xl">Configuration</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {d.env.map((e) => (
                  <li key={e.name} className="flex items-center justify-between gap-3">
                    <code className="text-xs">{e.name}</code>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${e.set ? "text-emerald-700 dark:text-emerald-300" : e.required ? "text-red-700 dark:text-red-300" : "text-[color:var(--muted)]"}`}>
                      {e.set ? <CheckCircle2 size={14} aria-hidden /> : <XCircle size={14} aria-hidden />}
                      {e.set ? "set" : e.required ? "missing (required)" : "not set (optional)"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[color:var(--muted)]">LLM routing: <code>{d.llm.provider}</code> · Gemini <code>{d.llm.geminiModel}</code> · Groq <code>{d.llm.groqModel}</code> (fallback <code>{d.llm.groqFallbackModel}</code>) · Whisper <code>{d.llm.whisperModel}</code> · daily AI cap {d.llm.dailyCap}.</p>
            </section>
            <section aria-labelledby="res-h" className="card p-5">
              <h2 id="res-h" className="font-display text-2xl">How the app stays up</h2>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm">
                <li>Every upstream call has an 8 s timeout, honours <code>Retry-After</code> on HTTP 429, and retries twice with exponential backoff.</li>
                <li>Concurrent identical requests are de-duplicated; responses are cached server-side (live ≈ 8 min, forecast 30 min, history 6 h, WAQI 5 min only, per its terms).</li>
                <li>Source chain per location: OpenAQ → WAQI → Open-Meteo (always labelled MODELLED), with a banner naming what is degraded.</li>
                <li>If a provider fails, the last cached copy is shown labelled “cached N min ago”. The UI never goes blank.</li>
                <li>All upstream payloads are validated with zod; malformed data is rejected, not displayed.</li>
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
