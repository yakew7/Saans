"use client";

import { useQuery } from "@tanstack/react-query";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Clock, Flame } from "lucide-react";
import { useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { fmtLocal } from "@/lib/format";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useAtmosphere } from "@/lib/hooks/useAtmosphere";
import { useAppState } from "@/lib/store";
import type { ForecastResponse } from "@/lib/sources/forecast";
import { ChartShell } from "@/components/charts/ChartShell";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { ForecastChart, ModelCheckChart } from "./ForecastChart";

const HORIZONS = [24, 48, 72, 96, 120] as const;

export function ForecastPage() {
  const { current } = useAppState();
  const [horizon, setHorizon] = useState<number>(72);
  const q = useQuery({
    queryKey: ["forecast", current.lat.toFixed(2), current.lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<ForecastResponse>(`/api/forecast?lat=${current.lat.toFixed(4)}&lon=${current.lon.toFixed(4)}`),
    staleTime: 10 * 60_000,
    refetchInterval: 30 * 60_000,
  });
  const d = q.data;
  const nowAqi = d && d.nowIndex >= 0 ? d.hours[d.nowIndex]?.aqi ?? null : null;
  useAtmosphere(nowAqi != null ? categoryFor(nowAqi).id : null);

  const fc = d ? d.hours.slice(d.nowIndex + 1, d.nowIndex + 1 + horizon) : [];
  const peak = fc.reduce<{ aqi: number; local: string } | null>((m, h) => (h.aqi != null && (!m || h.aqi > m.aqi) ? { aqi: h.aqi, local: h.local } : m), null);
  const trendWindow = d?.trend;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Air quality forecast · {current.name}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Hourly outlook from the CAMS atmospheric model. Everything right of “now” is a <strong>forecast</strong>: dashed line on a hatched background. It is never a measurement.
        </p>
      </div>

      {q.isPending && <Skeleton className="h-96 w-full" />}
      {q.isError && <ErrorState title="Couldn't load the forecast" message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {d && (
        <>
          <Banners banners={d.banners} />
          {!d.meta || d.nowIndex < 0 ? (
            <EmptyState title="Forecast unavailable">The forecast service did not return data for this place. Try again shortly.</EmptyState>
          ) : (
            <>
              <section aria-label="Forecast summary" className="grid gap-3 md:grid-cols-3">
                <div className="card p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Expected trend</h2>
                  {trendWindow && trendWindow.early != null && trendWindow.late != null ? (
                    <>
                      <p className="mt-2 flex items-center gap-2 font-display text-2xl">
                        {trendWindow.trend === "improving" ? <ArrowDownRight aria-hidden className="text-emerald-600" /> : trendWindow.trend === "worsening" ? <ArrowUpRight aria-hidden className="text-red-600" /> : <ArrowRight aria-hidden />}
                        {trendWindow.trend === "improving" ? "Improving" : trendWindow.trend === "worsening" ? "Worsening" : "Steady"}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">Average AQI goes from about {Math.round(trendWindow.early)} early in the next 5 days to about {Math.round(trendWindow.late)} at the end.</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--muted)]">Not enough forecast hours to judge a trend.</p>
                  )}
                  <div className="mt-2"><DataBadge compact kind="FORECAST" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} /></div>
                </div>
                <div className="card p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Peak in the next {horizon} h</h2>
                  {peak ? (
                    <>
                      <p className="mt-2 flex items-center gap-2"><Flame aria-hidden size={20} /><span className="numeral text-4xl font-semibold">{peak.aqi}</span><CategoryChip cat={categoryFor(peak.aqi)} /></p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">Expected around {fmtLocal(peak.local)} (local time).</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--muted)]">No data.</p>
                  )}
                  <div className="mt-2"><DataBadge compact kind="FORECAST" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} /></div>
                </div>
                <div className="card p-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Best time to go out</h2>
                  {d.best ? (
                    <>
                      <p className="mt-2 flex items-center gap-2 font-display text-2xl"><Clock aria-hidden size={20} />{fmtLocal(d.best.startLocal, "time")}–{fmtLocal(d.best.endLocal, "time")} <span className="text-base text-[color:var(--muted)]">{d.best.dayLabel}</span></p>
                      <p className="mt-1 text-sm text-[color:var(--muted)]">Forecast AQI about {d.best.meanAqi} ({d.best.categoryLabel}){d.best.improvement > 0 ? `, ${d.best.improvement} points better than the rest of daylight` : ", about the same as the rest of the day"}.</p>
                    </>
                  ) : (
                    <p className="mt-2 text-sm text-[color:var(--muted)]">No daylight window left today.</p>
                  )}
                  {d.bestTomorrow && <p className="mt-1 text-xs text-[color:var(--muted)]">Tomorrow: {fmtLocal(d.bestTomorrow.startLocal, "time")}–{fmtLocal(d.bestTomorrow.endLocal, "time")} (AQI ~{d.bestTomorrow.meanAqi}).</p>}
                </div>
              </section>

              <ChartShell
                title="Hourly AQI: past 24 h and forecast"
                description="Left of NOW: CAMS model analysis (modelled, solid grey). Right of NOW: CAMS forecast (dashed blue, hatched region). Category colours are the official US AQI bands."
                badge={
                  <div className="flex flex-wrap items-center gap-3">
                    <DataBadge kind="FORECAST" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} />
                    <DataBadge compact kind="MODELLED" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} />
                  </div>
                }
                table={
                  <table className="w-full text-left text-xs">
                    <caption className="sr-only">Hourly modelled AQI and forecast</caption>
                    <thead><tr><th scope="col" className="pr-3">Local time</th><th scope="col" className="pr-3">US AQI</th><th scope="col">Type</th></tr></thead>
                    <tbody>
                      {d.hours.slice(Math.max(0, d.nowIndex - 24), d.nowIndex + 1 + horizon).map((h, k) => (
                        <tr key={h.t}><td className="pr-3">{fmtLocal(h.local)}</td><td className="pr-3 tabular-nums">{h.aqi ?? "—"}</td><td>{Math.max(0, d.nowIndex - 24) + k > d.nowIndex ? "FORECAST" : "MODELLED"}</td></tr>
                      ))}
                    </tbody>
                  </table>
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Horizon:</span>
                  <ToggleGroup.Root type="single" value={String(horizon)} onValueChange={(v) => v && setHorizon(Number(v))} aria-label="Forecast horizon in hours" className="inline-flex flex-wrap gap-1">
                    {HORIZONS.map((h) => (
                      <ToggleGroup.Item key={h} value={String(h)} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold data-[state=on]:border-[color:var(--ink)] data-[state=on]:bg-[color:var(--ink)] data-[state=on]:text-[color:var(--bg)]">
                        {h} h
                      </ToggleGroup.Item>
                    ))}
                  </ToggleGroup.Root>
                </div>
                <ForecastChart hours={d.hours} nowIndex={d.nowIndex} horizon={horizon} spikes={d.spikes} />
                <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs" aria-label="Legend">
                  <li className="flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-6 bg-[#6b7280]" />Modelled (past)</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="w-6 border-t-[3px] border-dashed border-[#0369a1]" />Forecast</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="hatch h-3 w-6 rounded-sm border border-[#0369a1]/40" />Forecast region</li>
                  <li className="flex items-center gap-1.5"><span aria-hidden className="h-3 w-3 rounded-full border-2 border-[color:var(--ink)]" />Predicted spike</li>
                </ul>
                {d.spikes.length > 0 ? (
                  <p className="mt-2 text-sm"><strong>Predicted spike{d.spikes.length > 1 ? "s" : ""}:</strong> {d.spikes.slice(0, 3).map((s) => `${fmtLocal(s.local)} (AQI ${s.aqi}, ${s.categoryLabel}, vs typical ${s.baseline})`).join("; ")}.</p>
                ) : (
                  <p className="mt-2 text-sm text-[color:var(--muted)]">No sudden spikes are predicted in this window.</p>
                )}
              </ChartShell>

              <section aria-labelledby="daily-h" className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 id="daily-h" className="font-display text-2xl">Daily range</h2>
                  <DataBadge compact kind="FORECAST" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} />
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <caption className="sr-only">Forecast daily minimum and maximum AQI</caption>
                    <thead>
                      <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                        <th scope="col" className="py-2 pr-3">Day</th><th scope="col" className="py-2 pr-3">Min</th><th scope="col" className="py-2 pr-3">Max</th><th scope="col" className="py-2 pr-3">Peak around</th><th scope="col" className="py-2">Worst category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.daily.map((r) => (
                        <tr key={r.date} className="border-b border-[color:var(--border)]/60">
                          <th scope="row" className="py-2 pr-3 font-medium">{fmtLocal(`${r.date}T00:00`, "day")}{r.hours < 20 && <span className="ml-1 text-xs font-normal text-[color:var(--muted)]">(partial)</span>}</th>
                          <td className="py-2 pr-3 tabular-nums">{r.min}</td>
                          <td className="py-2 pr-3 tabular-nums font-semibold">{r.max}</td>
                          <td className="py-2 pr-3">{fmtLocal(r.peakLocal, "time")}</td>
                          <td className="py-2"><CategoryChip cat={categoryFor(r.max)} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              {d.modelCheck && (
                <ChartShell
                  title="How well does the model match reality here?"
                  description={`Last 24 hours of PM2.5: station readings at ${d.modelCheck.station}${d.modelCheck.distanceKm != null ? ` (${d.modelCheck.distanceKm} km away)` : ""} versus the CAMS model at this location.`}
                  badge={
                    <div className="flex flex-wrap gap-3">
                      <DataBadge compact kind="MEASURED" source="OpenAQ" observedAt={d.modelCheck.meta.observedAt} fetchedAt={d.modelCheck.meta.fetchedAt} cached={d.modelCheck.meta.cached} stale={d.modelCheck.meta.stale} />
                      <DataBadge compact kind="MODELLED" source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} />
                      <DataBadge compact kind="COMPUTED" source="Saans" observedAt={d.modelCheck.meta.observedAt} detail="mean |measured − modelled| over the hours where both exist" />
                    </div>
                  }
                >
                  <ModelCheckChart rows={d.modelCheck.rows} />
                  <p className="mt-3 text-sm">
                    On average the model differs from the station by <strong>{d.modelCheck.meanAbsDiff?.toFixed(1)} µg/m³</strong>
                    {d.modelCheck.modelOverMeasuredPct != null && (
                      <>, and runs <strong>{Math.abs(d.modelCheck.modelOverMeasuredPct).toFixed(0)}% {d.modelCheck.modelOverMeasuredPct < 0 ? "below" : "above"}</strong> the measured level</>
                    )}
                    . Models smooth over a ~11–40 km grid, so they often under-read sharp local peaks (traffic, burning, fireworks). Use the forecast for the <em>direction</em> of change more than exact values.
                  </p>
                </ChartShell>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
