"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import { useState } from "react";
import { fmtLocal, fmtNum } from "@/lib/format";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { INDIA_METROS, placeKey, type Place } from "@/lib/places";
import { useAppState } from "@/lib/store";
import type { HistoryMode, HistoryResponse } from "@/lib/sources/history";
import type { AnomalyResponse } from "@/lib/sources/anomalies";
import { ChartShell } from "@/components/charts/ChartShell";
import { AqiOverlayChart } from "@/components/history/HistoryCharts";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, ErrorState, Skeleton } from "@/components/ui/States";

/** Diwali 2026 fell on Sunday 8 November. Baseline = the 7 days before the window; window = 2 days before Diwali up to 2 days after (data permitting). */
const DIWALI = "2026-11-08";
const BASE = { start: "2026-10-30", end: "2026-11-05" };
const WIN_START = "2026-11-06";

function useHistory(place: Place, mode: HistoryMode, windowEnd: string) {
  const qs = new URLSearchParams({ lat: place.lat.toFixed(4), lon: place.lon.toFixed(4), aStart: BASE.start, aEnd: BASE.end, bStart: WIN_START, bEnd: windowEnd, mode }).toString();
  return useQuery({ queryKey: ["diwali", qs], queryFn: () => fetchJsonOrThrow<HistoryResponse>(`/api/history?${qs}`), staleTime: 10 * 60_000, retry: 0 });
}

function pct(v: number | null | undefined) {
  return v == null ? "n/a" : `${v > 0 ? "+" : ""}${v.toFixed(0)}%`;
}

export function DiwaliPage() {
  const { current } = useAppState();
  const choices: Place[] = [...INDIA_METROS.filter((m) => placeKey(m) !== placeKey(current)), current].sort((a, b) => a.name.localeCompare(b.name));
  const [place, setPlace] = useState<Place>(current);
  const [yesterday] = useState(() => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10));
  const windowEnd = yesterday < "2026-11-10" ? yesterday : "2026-11-10";

  const measured = useHistory(place, "measured", windowEnd);
  const modelled = useHistory(place, "modelled", windowEnd);
  const hourly = useQuery({
    queryKey: ["diwali-hourly", place.lat.toFixed(2), place.lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<AnomalyResponse>(`/api/anomalies?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}&days=7`),
    staleTime: 10 * 60_000,
    retry: 0,
  });

  const m = measured.data && measured.data.periodA && measured.data.periodB && measured.data.comparison ? measured.data : null;
  const mod = modelled.data && modelled.data.periodA && modelled.data.periodB && modelled.data.comparison ? modelled.data : null;
  const best = m ?? mod;
  const loading = measured.isPending || modelled.isPending;

  // hourly peak inside the Diwali window (local time strings YYYY-MM-DDTHH:MM)
  const peak = hourly.data?.points
    .filter((p) => p.v != null && p.local >= `${WIN_START}T00:00`)
    .reduce<{ local: string; v: number } | null>((mx, p) => (!mx || (p.v as number) > mx.v ? { local: p.local, v: p.v as number } : mx), null);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="flex items-center gap-3 font-display text-3xl sm:text-4xl"><Flame aria-hidden /> Diwali air check</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Diwali 2026 fell on <strong>{fmtLocal(`${DIWALI}T00:00`, "day")}</strong>. How did the air in the days around it compare with the week before (30 Oct–5 Nov)? Window: {WIN_START} to {windowEnd}
          {windowEnd < "2026-11-10" ? " (the latest complete day; later days are not in yet)" : ""}.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="city" className="text-sm font-medium">City:</label>
          <select id="city" value={placeKey(place)} onChange={(e) => setPlace(choices.find((c) => placeKey(c) === e.target.value) ?? place)} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm">
            {choices.map((c) => <option key={placeKey(c)} value={placeKey(c)}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {loading && <Skeleton className="h-72 w-full" />}
      {!loading && !best && (
        <ErrorState title="No data for this city" message="Neither measured station history nor the CAMS model returned data for these dates." />
      )}

      {best && best.periodA && best.periodB && best.comparison && best.badge && best.meta && (
        <>
          <section aria-labelledby="res-h" className="card rise p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="res-h" className="font-display text-2xl">{place.name}: Diwali window vs the week before</h2>
              <DataBadge kind={best.badge} source={best.meta.source} observedAt={best.meta.observedAt} fetchedAt={best.meta.fetchedAt} cached={best.meta.cached} stale={false} detail={best.source === "openaq" ? `Station: ${best.meta.stationName} (${best.meta.stationDistanceKm} km). Daily AQI computed from daily mean PM.` : "CAMS model grid cell."} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Week before (mean PM2.5)</p>
                <p className="numeral mt-1 text-4xl font-semibold">{fmtNum(best.periodA.meanPm25, 0)}<span className="ml-1 font-sans text-sm font-normal">µg/m³</span></p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Diwali window (mean PM2.5)</p>
                <p className="numeral mt-1 text-4xl font-semibold">{fmtNum(best.periodB.meanPm25, 0)}<span className="ml-1 font-sans text-sm font-normal">µg/m³</span></p>
              </div>
              <div className="rounded-xl border border-[color:var(--border)] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Change</p>
                <p className="numeral mt-1 text-4xl font-semibold">{pct(best.comparison.pm25)}</p>
                <p className="mt-1 text-xs text-[color:var(--muted)]">(B − A) ÷ A × 100 on PM2.5 means</p>
              </div>
            </div>
            {best.comparison.sufficient ? (
              <p className="mt-4">
                PM2.5 in {place.name} was <strong>{pct(best.comparison.pm25)}</strong> versus the week before, and the daily AQI averaged {fmtNum(best.periodB.meanAqi)} against {fmtNum(best.periodA.meanAqi)}
                {best.periodB.maxAqi && <>, peaking at {best.periodB.maxAqi.aqi} on {best.periodB.maxAqi.date}</>}.
              </p>
            ) : (
              <p role="status" className="mt-4 rounded-lg bg-amber-500/15 px-3 py-2 text-sm">Not enough days with data in one of the periods (week before: {best.periodA.validDays}, window: {best.periodB.validDays}) to state a reliable change.</p>
            )}
            {peak && hourly.data?.badge && (
              <p className="mt-2 text-sm">
                Highest <em>hourly</em> PM2.5 since 6 Nov: <strong>{peak.v.toFixed(0)} µg/m³</strong> around {fmtLocal(peak.local)}{" "}
                <DataBadge compact kind={hourly.data.badge} source={hourly.data.meta?.source ?? "OpenAQ"} observedAt={hourly.data.meta?.observedAt ?? null} stale={false} />
              </p>
            )}
            <Banners banners={best.banners} />
          </section>

          <section aria-labelledby="cmp-h" className="card p-5">
            <h2 id="cmp-h" className="font-display text-2xl">Measured vs modelled: how much does a model miss?</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">The same comparison from two kinds of data. Satellite-and-model data (CAMS) smooths over local sources, so it usually <strong>under-represents firecracker spikes</strong>.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Diwali window change by data type</caption>
                <thead><tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]"><th scope="col" className="py-2 pr-3">Data</th><th scope="col" className="py-2 pr-3">Week before PM2.5</th><th scope="col" className="py-2 pr-3">Window PM2.5</th><th scope="col" className="py-2">Change</th></tr></thead>
                <tbody>
                  {([["Station measurements", m, measured.isError ? "unavailable" : "no nearby station history"], ["CAMS model", mod, "unavailable"]] as const).map(([label, d, why]) => (
                    <tr key={label} className="border-b border-[color:var(--border)]/60">
                      <th scope="row" className="py-2 pr-3 font-medium">
                        {label}{" "}
                        {d?.badge && d.meta && <DataBadge compact kind={d.badge} source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} stale={false} />}
                      </th>
                      {d && d.periodA && d.periodB && d.comparison ? (
                        <>
                          <td className="py-2 pr-3 tabular-nums">{fmtNum(d.periodA.meanPm25, 0)} µg/m³</td>
                          <td className="py-2 pr-3 tabular-nums">{fmtNum(d.periodB.meanPm25, 0)} µg/m³</td>
                          <td className="py-2 font-semibold tabular-nums">{pct(d.comparison.pm25)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="py-2 text-[color:var(--muted)]">{why}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              <strong>Honest caveat:</strong> a station reads one point, a model averages a ~11–40 km grid. Fireworks are short, local and intense, so models tend to underestimate them. When both are available, trust the station figure for the size of the Diwali spike and use the model for the broad pattern.
            </p>
          </section>

          <ChartShell
            title="Daily AQI: week before vs Diwali window"
            description="Day 1 of each period lined up (grey = week before from 30 Oct, teal = window from 6 Nov). Circled points are statistical spikes."
            badge={<DataBadge kind={best.badge} source={best.meta.source} observedAt={best.meta.observedAt} fetchedAt={best.meta.fetchedAt} stale={false} />}
          >
            <AqiOverlayChart a={best.periodA} b={best.periodB} />
          </ChartShell>
        </>
      )}
      <p className="text-xs text-[color:var(--muted)]">Data: OpenAQ station history where available, otherwise Open-Meteo / CAMS (modelled). Daily AQI is computed from daily mean PM. Today and later days are excluded until complete. Not medical advice.</p>
    </div>
  );
}
