"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { WHO_2021 } from "@/lib/aqi/who";
import { fmtLocal } from "@/lib/format";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useAppState } from "@/lib/store";
import type { AnomalyResponse } from "@/lib/sources/anomalies";
import { AXIS_TICK, ChartShell, GRID_STROKE, TipBox } from "@/components/charts/ChartShell";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

interface Row {
  i: number;
  local: string;
  v: number | null;
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Row }[] }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <TipBox title={fmtLocal(r.local)}>
      <p>PM2.5: <strong>{r.v == null ? "no data (gap)" : `${r.v.toFixed(1)} µg/m³`}</strong></p>
    </TipBox>
  );
}

export function AnomalySection() {
  const { current } = useAppState();
  const [days, setDays] = useState(7);
  const q = useQuery({
    queryKey: ["anomalies", current.lat.toFixed(2), current.lon.toFixed(2), days],
    queryFn: () => fetchJsonOrThrow<AnomalyResponse>(`/api/anomalies?lat=${current.lat.toFixed(4)}&lon=${current.lon.toFixed(4)}&days=${days}`),
    staleTime: 10 * 60_000,
  });
  const d = q.data;
  const rows: Row[] = (d?.points ?? []).map((p, i) => ({ i, local: p.local, v: p.v }));
  const idxOf = new Map((d?.points ?? []).map((p, i) => [p.t, i]));
  const max = Math.max(60, ...rows.map((r) => r.v ?? 0));
  const ticks = rows.filter((r) => r.local.slice(11, 16) === "00:00").map((r) => r.i);

  return (
    <section aria-labelledby="anom-h" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="anom-h" className="font-display text-2xl">Hourly anomaly detection · {current.name}</h2>
          <p className="text-sm text-[color:var(--muted)]">Sudden hourly PM2.5 jumps that are statistically unusual compared with the previous 24 hours.</p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Period">
          {[7, 14, 30].map((n) => (
            <button key={n} type="button" aria-pressed={days === n} onClick={() => setDays(n)} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">
              {n} days
            </button>
          ))}
        </div>
      </div>
      {q.isPending && <Skeleton className="h-80 w-full" />}
      {q.isError && <ErrorState title="Couldn't load hourly data" message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <Banners banners={d.banners} />
          {!d.points.length || !d.badge || !d.meta ? (
            <EmptyState title="No hourly PM2.5 history for this place" />
          ) : (
            <ChartShell
              title="Hourly PM2.5 with flagged anomalies"
              description={`${d.source === "openaq" ? `Station: ${d.meta.stationName} (${d.meta.stationDistanceKm} km).` : "CAMS model grid cell."} Circled points are anomalies; gaps are hours the source did not report, never filled in.`}
              badge={
                <div className="flex flex-wrap items-center gap-3">
                  <DataBadge kind={d.badge} source={d.meta.source} observedAt={d.meta.observedAt} fetchedAt={d.meta.fetchedAt} cached={d.meta.cached} stale={false} />
                  <DataBadge compact kind="COMPUTED" source="Saans" observedAt={d.meta.observedAt} detail={d.formula} />
                </div>
              }
              table={
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">Flagged hourly PM2.5 anomalies</caption>
                  <thead><tr><th scope="col" className="pr-3">Local time</th><th scope="col" className="pr-3">PM2.5</th><th scope="col" className="pr-3">Typical (24 h median)</th><th scope="col">Robust z</th></tr></thead>
                  <tbody>{d.events.map((e) => <tr key={e.t}><td className="pr-3">{fmtLocal(e.local)}</td><td className="pr-3 tabular-nums">{e.value.toFixed(1)}</td><td className="pr-3 tabular-nums">{e.baseline.toFixed(1)}</td><td className="tabular-nums">{e.robustZ.toFixed(1)}</td></tr>)}</tbody>
                </table>
              }
            >
              <div className="h-72 w-full" role="img" aria-label="Hourly PM2.5 line chart with anomalies circled">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 22, right: 12, bottom: 4, left: -8 }}>
                    <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                    <XAxis dataKey="i" type="number" domain={[0, Math.max(1, rows.length - 1)]} ticks={ticks} tickFormatter={(i: number) => { const r = rows[i]; return r ? fmtLocal(r.local, "day").replace(/^\w+, /, "") : ""; }} tick={AXIS_TICK} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, Math.ceil((max * 1.1) / 50) * 50]} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                    <Tooltip content={<Tip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "2 4" }} />
                    <ReferenceLine y={WHO_2021.pm25.shortTerm} stroke="var(--accent)" strokeDasharray="1 5" label={{ value: "WHO 24 h guideline 15", fill: "var(--muted)", fontSize: 10, position: "insideTopLeft" }} />
                    <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
                    {d.events.slice(0, 8).map((e) => {
                      const i = idxOf.get(e.t);
                      return i == null ? null : <ReferenceDot key={e.t} x={i} y={e.value} r={6} fill="none" stroke="var(--ink)" strokeWidth={2} />;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {d.events.length ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {d.events.slice(0, 6).map((e) => (
                    <li key={e.t}>
                      <strong>{fmtLocal(e.local)}:</strong> PM2.5 reached {e.value.toFixed(0)} µg/m³, {e.ratio.toFixed(1)}× the previous 24 h median ({e.baseline.toFixed(0)}). Robust z-score {e.robustZ.toFixed(1)}.
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[color:var(--muted)]">No unusual hourly spikes in this period.</p>
              )}
              <p className="mt-3 text-xs text-[color:var(--muted)]">
                Why flagged: <span className="font-mono">{d.formula}</span>, and PM2.5 ≥ 30 µg/m³. This detects <em>that</em> something unusual happened, not <em>why</em>. Sharp short rises often come from local sources such as traffic peaks, burning or fireworks.
              </p>
            </ChartShell>
          )}
        </>
      )}
    </section>
  );
}
