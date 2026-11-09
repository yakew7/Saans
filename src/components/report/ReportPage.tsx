"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Printer } from "lucide-react";
import { useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { CIGARETTE_SOURCE_URL, WHO_2021, WHO_SOURCE_URL } from "@/lib/aqi/who";
import { fmtNum } from "@/lib/format";
import { addDays } from "@/lib/history";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { reportToText, type ReportStats } from "@/lib/report";
import { useAppState } from "@/lib/store";
import type { HistoryMode } from "@/lib/sources/history";
import type { BadgeKind, Meta } from "@/lib/types";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

interface ReportResp {
  source: "openaq" | "open-meteo" | null;
  badge: BadgeKind | null;
  meta: Meta | null;
  stats: ReportStats | null;
  banners: { id: string; severity: "info" | "warn" | "error"; source: string; message: string }[];
}

const MODES: { id: HistoryMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "measured", label: "Measured only" },
  { id: "modelled", label: "Modelled" },
];

function Kpi({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</p>
      <p className="numeral mt-1 text-4xl font-semibold leading-none">{value}</p>
      {sub && <p className="mt-1 text-sm text-[color:var(--muted)]">{sub}</p>}
    </div>
  );
}

export function ReportPage() {
  const { current } = useAppState();
  const [end] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const [days, setDays] = useState(30);
  const [custom, setCustom] = useState<{ start: string; end: string } | null>(null);
  const [mode, setMode] = useState<HistoryMode>("auto");
  const [copied, setCopied] = useState(false);
  const range = custom ?? { start: addDays(end, -(days - 1)), end };

  const qs = new URLSearchParams({ lat: current.lat.toFixed(4), lon: current.lon.toFixed(4), start: range.start, end: range.end, mode }).toString();
  const q = useQuery({ queryKey: ["report", qs], queryFn: () => fetchJsonOrThrow<ReportResp>(`/api/report?${qs}`), staleTime: 10 * 60_000 });
  const d = q.data;
  const r = d?.stats ?? null;
  const sourceText = d?.badge ? `${d.badge} · ${d.meta?.source}${d.meta?.stationName ? ` · ${d.meta.stationName}` : ""}` : "none";

  async function copy() {
    if (!r) return;
    const text = reportToText(current.name, r, sourceText);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this report:", text);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="no-print space-y-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl">Pollution impact report</h1>
          <p className="mt-1 text-sm text-[color:var(--muted)]">An automated summary of a period for <strong>{current.name}</strong>. Print it or save it as a PDF, or copy it as text.</p>
        </div>
        <div className="card space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {[7, 30, 90].map((n) => (
              <button key={n} type="button" aria-pressed={!custom && days === n} onClick={() => { setCustom(null); setDays(n); }} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">Last {n} days</button>
            ))}
            <button type="button" aria-pressed={custom?.start === "2026-11-02"} onClick={() => setCustom({ start: "2026-11-02", end: "2026-11-08" })} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">Diwali week (2–8 Nov)</button>
            <label className="ml-auto flex items-center gap-2 text-xs font-medium">From
              <input type="date" min="2022-01-01" max={end} value={range.start} onChange={(e) => setCustom({ start: e.target.value, end: range.end })} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium">To
              <input type="date" min="2022-01-01" max={end} value={range.end} onChange={(e) => setCustom({ start: range.start, end: e.target.value })} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-sm" />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Data source">
            {MODES.map((m) => (
              <label key={m.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${mode === m.id ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--bg)]" : "border-[color:var(--border)]"}`}>
                <input type="radio" name="rmode" className="sr-only" checked={mode === m.id} onChange={() => setMode(m.id)} />{m.label}
              </label>
            ))}
            <span className="ml-auto flex gap-2">
              <button type="button" onClick={copy} disabled={!r} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-50">{copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}{copied ? "Copied" : "Copy as text"}</button>
              <button type="button" onClick={() => window.print()} disabled={!r} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--bg)] disabled:opacity-50"><Printer size={14} aria-hidden />Print / save PDF</button>
            </span>
          </div>
        </div>
        {q.data && <Banners banners={d!.banners} />}
      </div>

      {q.isPending && <Skeleton className="h-96 w-full" />}
      {q.isError && <ErrorState title="Couldn't build the report" message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {d && !r && !d.banners.length && <EmptyState title="No data for this period" />}

      {r && d?.badge && d.meta && (
        <article className="card space-y-6 p-6 sm:p-8" aria-label="Pollution impact report">
          <header className="space-y-2 border-b border-[color:var(--border)] pb-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted)]">Saans · Pollution impact report</p>
            <h2 className="font-display text-3xl">{current.name}</h2>
            <p className="text-sm">{r.start} to {r.end} · {r.validDays} of {r.totalDays} days with data</p>
            <DataBadge kind={d.badge} source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} stale={false} detail={d.source === "openaq" ? `Station: ${d.meta.stationName} (${d.meta.stationDistanceKm} km). Daily AQI computed from daily mean PM with US EPA breakpoints.` : "CAMS model grid cell. Daily AQI computed from modelled daily PM means."} />
            {d.source === "open-meteo" && <p className="text-xs text-[color:var(--muted)]">This report uses modelled data, which smooths over local peaks and tends to under-represent sharp spikes such as firecracker pollution.</p>}
          </header>

          {r.validDays === 0 ? (
            <p>No days with data in this period.</p>
          ) : (
            <>
              <section aria-label="Key figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Kpi label="Average daily AQI" value={fmtNum(r.meanAqi)} sub={r.meanAqi != null && <CategoryChip cat={categoryFor(r.meanAqi)} />} />
                <Kpi label="Average PM2.5" value={<>{fmtNum(r.meanPm25, 1)}<span className="ml-1 font-sans text-sm font-normal">µg/m³</span></>} sub={r.meanPm25 != null && `${(r.meanPm25 / WHO_2021.pm25.shortTerm).toFixed(1)}× WHO 24 h guideline`} />
                <Kpi label="Best day" value={r.best?.aqi ?? "—"} sub={r.best?.date} />
                <Kpi label="Worst day" value={r.worst?.aqi ?? "—"} sub={r.worst?.date} />
              </section>

              <section aria-labelledby="who-h" className="break-inside-avoid space-y-2">
                <h3 id="who-h" className="font-display text-xl">Days above the WHO guideline</h3>
                <p>
                  PM2.5 exceeded the <a href={WHO_SOURCE_URL} target="_blank" rel="noreferrer" className="underline">WHO 2021</a> 24-hour guideline ({WHO_2021.pm25.shortTerm} µg/m³) on <strong>{r.daysAboveWhoPm25} of {r.daysWithPm25}</strong> days
                  {r.daysWithPm10 > 0 && <>; PM10 exceeded its guideline ({WHO_2021.pm10.shortTerm} µg/m³) on <strong>{r.daysAboveWhoPm10} of {r.daysWithPm10}</strong> days</>}.
                </p>
              </section>

              <section aria-labelledby="cat-h" className="break-inside-avoid space-y-2">
                <h3 id="cat-h" className="font-display text-xl">Days by air quality category</h3>
                <div className="flex h-5 overflow-hidden rounded-full" role="img" aria-label={r.categoryDays.filter((c) => c.days).map((c) => `${c.label}: ${c.days} days`).join(", ")}>
                  {r.categoryDays.filter((c) => c.days).map((c) => <div key={c.id} style={{ background: c.color, flex: c.days }} title={`${c.label}: ${c.days} days`} />)}
                </div>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  {r.categoryDays.filter((c) => c.days).map((c) => <li key={c.id} className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-sm" style={{ background: c.color }} />{c.label}: <strong>{c.days}</strong></li>)}
                </ul>
              </section>

              <section aria-labelledby="trend-h" className="break-inside-avoid space-y-2">
                <h3 id="trend-h" className="font-display text-xl">Trend</h3>
                <p>
                  Air quality was <strong>{r.trend === "worsening" ? "getting worse" : r.trend === "improving" ? "improving" : "broadly steady"}</strong> over the period
                  {r.trendSlope != null && <> (least-squares slope {r.trendSlope > 0 ? "+" : ""}{r.trendSlope.toFixed(1)} AQI points per day)</>}.
                </p>
              </section>

              <section aria-labelledby="worst-h" className="break-inside-avoid space-y-2">
                <h3 id="worst-h" className="font-display text-xl">Worst days and spikes</h3>
                <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                  {r.worstFive.map((w) => <li key={w.date}>{w.date}: AQI {w.aqi} ({categoryFor(w.aqi).label})</li>)}
                </ol>
                {r.spikes.length ? (
                  <p className="text-sm">Statistically unusual jumps: {r.spikes.map((s) => `${s.date} (AQI ${s.aqi}, typical ${Math.round(s.baseline)})`).join("; ")}.</p>
                ) : (
                  <p className="text-sm text-[color:var(--muted)]">No statistically unusual daily spikes were detected.</p>
                )}
              </section>

              {r.cigarettes != null && (
                <section aria-labelledby="cig-h" className="break-inside-avoid space-y-2 rounded-xl border border-amber-600/40 bg-amber-500/10 p-4">
                  <h3 id="cig-h" className="font-display text-xl">Cigarette-equivalent <span className="text-sm font-sans font-semibold">(rough heuristic)</span></h3>
                  <p>
                    Breathing this PM2.5 for {r.daysWithPm25} days is roughly equivalent to smoking about <strong>{r.cigarettes.toFixed(0)} cigarettes</strong> ({r.cigarettesPerDay!.toFixed(1)} per day). 
                  </p>
                  <p className="text-xs text-[color:var(--muted)]">
                    Based on the <a href={CIGARETTE_SOURCE_URL} target="_blank" rel="noreferrer" className="underline">Berkeley Earth</a> rule of thumb that about 22 µg/m³ of PM2.5 over 24 hours ≈ one cigarette per day. It is an illustration, not a medical measurement or a health risk estimate.
                  </p>
                </section>
              )}

              <footer className="border-t border-[color:var(--border)] pt-3 text-xs text-[color:var(--muted)]">
                Daily AQI is computed from daily mean PM2.5 / PM10 with US EPA breakpoints; days with under 50% hourly coverage are excluded. Not medical advice. Data: {d.source === "openaq" ? "OpenAQ and its data providers" : "Open-Meteo / Copernicus Atmosphere Monitoring Service (CAMS)"}. Generated by Saans.
              </footer>
            </>
          )}
        </article>
      )}
    </div>
  );
}
