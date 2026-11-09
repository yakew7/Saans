"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { useState } from "react";
import { PERCENT_CHANGE_FORMULA, spikeFormula } from "@/lib/aqi/stats";
import { categoryFor } from "@/lib/aqi/categories";
import { fmtNum } from "@/lib/format";
import { addDays, type PeriodSummary } from "@/lib/history";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useAppState } from "@/lib/store";
import type { HistoryMode, HistoryResponse } from "@/lib/sources/history";
import { ChartShell } from "@/components/charts/ChartShell";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { AnomalySection } from "./AnomalySection";
import { AqiOverlayChart, PmChart } from "./HistoryCharts";

interface Range {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
}

const DIWALI_2026 = "2026-11-08";
const DAILY_SPIKE_FORMULA = spikeFormula("the previous 7 days", 8);

function lastNDays(n: number, ref: string): Range {
  const bEnd = ref;
  const bStart = addDays(bEnd, -(n - 1));
  const aEnd = addDays(bStart, -1);
  const aStart = addDays(aEnd, -(n - 1));
  return { aStart, aEnd, bStart, bEnd };
}

const MODES: { id: HistoryMode; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "Measured station history when available, else modelled" },
  { id: "measured", label: "Measured only", hint: "OpenAQ station history" },
  { id: "modelled", label: "Modelled", hint: "CAMS model via Open-Meteo" },
];

export function HistoryPage() {
  const { current } = useAppState();
  // yesterday (local): partial days are excluded. Lazy init keeps render pure.
  const [yesterday] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const [range, setRange] = useState<Range>(() => lastNDays(7, yesterday));
  const [mode, setMode] = useState<HistoryMode>("auto");

  const qs = new URLSearchParams({ lat: current.lat.toFixed(4), lon: current.lon.toFixed(4), ...range, mode }).toString();
  const q = useQuery({ queryKey: ["history", qs], queryFn: () => fetchJsonOrThrow<HistoryResponse>(`/api/history?${qs}`), staleTime: 10 * 60_000 });
  const d = q.data;
  const valid = range.aStart <= range.aEnd && range.bStart <= range.bEnd;

  const set = (k: keyof Range) => (e: React.ChangeEvent<HTMLInputElement>) => setRange((r) => ({ ...r, [k]: e.target.value }));
  const dateInput = (k: keyof Range, label: string) => (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <input type="date" value={range[k]} min="2022-01-01" max={yesterday} onChange={set(k)} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1.5 text-sm" />
    </label>
  );

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Pollution history · {current.name}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Compare two periods. Pick dates or a preset; every series is labelled with where it came from, and sources are never mixed in one line.</p>
      </div>

      <section aria-label="Choose periods" className="card space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Last 7 vs previous 7 days", r: () => lastNDays(7, yesterday) },
            { label: "Last 30 vs previous 30 days", r: () => lastNDays(30, yesterday) },
            { label: "Diwali week vs week before", r: () => ({ aStart: "2026-10-26", aEnd: "2026-11-01", bStart: "2026-11-02", bEnd: DIWALI_2026 }) },
          ].map((p) => (
            <button key={p.label} type="button" onClick={() => setRange(p.r())} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-[color:var(--surface-2)]">
              {p.label}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="flex flex-wrap items-end gap-3">
            <legend className="mb-1 text-sm font-semibold">Period A (baseline)</legend>
            {dateInput("aStart", "From")}
            {dateInput("aEnd", "To")}
          </fieldset>
          <fieldset className="flex flex-wrap items-end gap-3">
            <legend className="mb-1 text-sm font-semibold">Period B (compare)</legend>
            {dateInput("bStart", "From")}
            {dateInput("bEnd", "To")}
          </fieldset>
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold">Data source</legend>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {MODES.map((m) => (
              <label key={m.id} title={m.hint} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${mode === m.id ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--bg)]" : "border-[color:var(--border)]"}`}>
                <input type="radio" name="mode" value={m.id} checked={mode === m.id} onChange={() => setMode(m.id)} className="sr-only" />
                {m.label}
              </label>
            ))}
          </div>
        </fieldset>
        {!valid && <p role="alert" className="text-sm text-red-700 dark:text-red-300">A period’s end date can’t be before its start date.</p>}
        <p className="text-xs text-[color:var(--muted)]">Latest selectable day is yesterday; today is excluded because it is incomplete. Max 120 days per period.</p>
      </section>

      {q.isPending && valid && <Skeleton className="h-96 w-full" />}
      {q.isError && <ErrorState title="Couldn't load history" message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {d && (
        <>
          <Banners banners={d.banners} />
          {d.periodA && d.periodB && d.comparison && d.badge && d.meta ? (
            <Results d={d} a={d.periodA} b={d.periodB} />
          ) : (
            !d.banners.length && <EmptyState title="No history available for this selection">Try different dates or another source.</EmptyState>
          )}
        </>
      )}
      <AnomalySection />
    </div>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-[color:var(--muted)]">not enough data</span>;
  const Icon = pct > 1 ? ArrowUpRight : pct < -1 ? ArrowDownRight : Minus;
  const worse = pct > 1;
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${worse ? "text-red-700 dark:text-red-300" : pct < -1 ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
      <Icon size={16} aria-hidden />
      {pct > 0 ? "+" : ""}{pct.toFixed(1)}% <span className="font-normal text-[color:var(--muted)]">({worse ? "worse" : pct < -1 ? "better" : "about the same"})</span>
    </span>
  );
}

function Results({ d, a, b }: { d: HistoryResponse; a: PeriodSummary; b: PeriodSummary }) {
  const c = d.comparison!;
  const meta = d.meta!;
  const badge = (
    <DataBadge
      kind={d.badge!}
      source={meta.source}
      observedAt={meta.observedAt}
      fetchedAt={meta.fetchedAt}
      cached={meta.cached}
      stale={false}
      detail={d.source === "openaq" ? `Station: ${meta.stationName} (${meta.stationDistanceKm} km). Daily AQI computed from daily mean PM using US EPA breakpoints.` : "CAMS model grid cell. Daily AQI computed from daily mean of modelled PM using US EPA breakpoints."}
    />
  );
  const rows: { label: string; unit: string; a: number | null; b: number | null; pct: number | null; digits: number }[] = [
    { label: "Daily AQI (mean)", unit: "", a: a.meanAqi, b: b.meanAqi, pct: c.aqi, digits: 0 },
    { label: "PM2.5 (mean)", unit: "µg/m³", a: a.meanPm25, b: b.meanPm25, pct: c.pm25, digits: 1 },
    { label: "PM10 (mean)", unit: "µg/m³", a: a.meanPm10, b: b.meanPm10, pct: c.pm10, digits: 1 },
  ];
  const allSpikes = [...a.spikes.map((s) => ({ ...s, who: "A" })), ...b.spikes.map((s) => ({ ...s, who: "B" }))];
  const aqiFmt = (v: number | null) => (v == null ? "—" : `${Math.round(v)} · ${categoryFor(v).label}`);

  return (
    <>
      <section aria-labelledby="chg-h" className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="chg-h" className="font-display text-2xl">Change between periods</h2>
          {badge}
        </div>
        {!c.sufficient && (
          <p role="status" className="mt-3 rounded-lg bg-amber-500/15 px-3 py-2 text-sm">
            Percent change is withheld: one period has fewer than 3 days with data (A: {a.validDays}, B: {b.validDays}).
          </p>
        )}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                <th scope="col" className="py-2 pr-3">Metric</th>
                <th scope="col" className="py-2 pr-3">A · {a.start} → {a.end}</th>
                <th scope="col" className="py-2 pr-3">B · {b.start} → {b.end}</th>
                <th scope="col" className="py-2">Change (A→B)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-[color:var(--border)]/60">
                  <th scope="row" className="py-2 pr-3 font-medium">{r.label}</th>
                  <td className="py-2 pr-3 tabular-nums">{r.label.startsWith("Daily") ? aqiFmt(r.a) : `${fmtNum(r.a, r.digits)} ${r.unit}`}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.label.startsWith("Daily") ? aqiFmt(r.b) : `${fmtNum(r.b, r.digits)} ${r.unit}`}</td>
                  <td className="py-2"><Delta pct={r.pct} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 font-mono text-xs text-[color:var(--muted)]">
          {PERCENT_CHANGE_FORMULA}
          {c.pm25 != null && a.meanPm25 != null && b.meanPm25 != null && <> · PM2.5: ({b.meanPm25.toFixed(1)} − {a.meanPm25.toFixed(1)}) ÷ {a.meanPm25.toFixed(1)} × 100 = {c.pm25.toFixed(1)}%</>}
        </p>
        <p className="mt-1 text-xs text-[color:var(--muted)]">Days with data: A {a.validDays}, B {b.validDays}. Days with less than 50% hourly coverage are dropped.</p>
      </section>

      <ChartShell
        title="Daily AQI, period A vs period B"
        description="Periods are aligned by day (D1 = first day of each). Circled points are spikes."
        badge={badge}
        table={<DataTable a={a} b={b} />}
      >
        <AqiOverlayChart a={a} b={b} />
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
          <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-5 bg-[#7a8683]" />A: {a.start} → {a.end}</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="h-1 w-5 rounded bg-[color:var(--accent)]" />B: {b.start} → {b.end}</li>
        </ul>
      </ChartShell>

      <div className="grid gap-6 lg:grid-cols-2">
        {[{ k: "A", p: a }, { k: "B", p: b }].map(({ k, p }) => (
          <ChartShell key={k} title={`PM2.5 vs PM10, period ${k}`} description={`${p.start} → ${p.end}. Dotted line: least-squares trend of daily PM2.5${p.pm25TrendPerDay != null ? ` (${p.pm25TrendPerDay > 0 ? "+" : ""}${p.pm25TrendPerDay.toFixed(1)} µg/m³ per day)` : ""}.`} badge={badge}>
            <PmChart p={p} />
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Legend">
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-1 w-5 rounded bg-[color:var(--accent)]" />PM2.5</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-5 bg-[#7a8683]" />PM10</li>
              <li className="flex items-center gap-1.5"><span aria-hidden className="w-5 border-t-2 border-dotted border-[color:var(--ink)]" />PM2.5 trend</li>
              <li>Dotted horizontal lines: WHO 24 h guidelines</li>
            </ul>
          </ChartShell>
        ))}
      </div>

      <section aria-labelledby="spk-h" className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="spk-h" className="font-display text-2xl">Spikes</h2>
          <DataBadge kind="COMPUTED" source="Saans" observedAt={meta.observedAt} detail={DAILY_SPIKE_FORMULA} compact />
        </div>
        {allSpikes.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {allSpikes.map((s) => (
              <li key={`${s.who}${s.date}`}>
                <strong>Period {s.who}, {s.date}:</strong> AQI {s.aqi}, about {Math.round(s.aqi - s.baseline)} points above the previous week’s typical level ({Math.round(s.baseline)}). Robust z-score {s.robustZ.toFixed(1)}.
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--muted)]">No statistically unusual daily spikes were detected in these periods.</p>
        )}
        <p className="mt-3 font-mono text-xs text-[color:var(--muted)]">Rule: {DAILY_SPIKE_FORMULA}. Applied to daily AQI; also requires AQI ≥ 60.</p>
      </section>
    </>
  );
}

function DataTable({ a, b }: { a: PeriodSummary; b: PeriodSummary }) {
  const rows = (p: PeriodSummary, k: string) =>
    p.days.map((d) => (
      <tr key={`${k}${d.date}`} className="border-b border-[color:var(--border)]/60">
        <td className="py-1 pr-3">{k}</td>
        <td className="py-1 pr-3">{d.date}</td>
        <td className="py-1 pr-3 tabular-nums">{d.aqi ?? "—"}</td>
        <td className="py-1 pr-3 tabular-nums">{d.pm25 != null ? d.pm25.toFixed(1) : "—"}</td>
        <td className="py-1 tabular-nums">{d.pm10 != null ? d.pm10.toFixed(1) : "—"}</td>
      </tr>
    ));
  return (
    <table className="w-full text-left text-xs">
      <caption className="sr-only">Daily values for both periods</caption>
      <thead>
        <tr className="text-[color:var(--muted)]">
          <th scope="col" className="py-1 pr-3">Period</th>
          <th scope="col" className="py-1 pr-3">Date</th>
          <th scope="col" className="py-1 pr-3">AQI</th>
          <th scope="col" className="py-1 pr-3">PM2.5</th>
          <th scope="col" className="py-1">PM10</th>
        </tr>
      </thead>
      <tbody>{rows(a, "A")}{rows(b, "B")}</tbody>
    </table>
  );
}
