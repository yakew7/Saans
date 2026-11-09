"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { store } from "@/lib/store";
import type { LeaderboardResponse, LeaderboardRow } from "@/lib/sources/leaderboard";
import type { Meta } from "@/lib/types";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

function Table({ rows, kind, meta, asc }: { rows: LeaderboardRow[]; kind: "MEASURED" | "MODELLED"; meta: Meta | null; asc: boolean }) {
  const router = useRouter();
  const sorted = asc ? [...rows].reverse() : rows;
  if (!sorted.length) return <EmptyState title="No cities in this group" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-sm">
        <caption className="sr-only">{kind === "MEASURED" ? "Cities ranked by measured AQI" : "Cities ranked by modelled AQI"}</caption>
        <thead>
          <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
            <th scope="col" className="py-2 pr-3">#</th>
            <th scope="col" className="py-2 pr-3">City</th>
            <th scope="col" className="py-2 pr-3">AQI</th>
            <th scope="col" className="py-2 pr-3">Category</th>
            <th scope="col" className="py-2 pr-3">{kind === "MEASURED" ? "Stations" : "Basis"}</th>
            <th scope="col" className="py-2">Source</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const cat = categoryFor(r.aqi);
            return (
              <tr key={r.city} className="border-b border-[color:var(--border)]/60">
                <td className="py-2 pr-3 tabular-nums text-[color:var(--muted)]">{i + 1}</td>
                <th scope="row" className="py-2 pr-3 font-medium">
                  <button type="button" onClick={() => { store.setCurrent({ name: r.city, lat: r.lat, lon: r.lon, country: r.country }); router.push("/"); }} className="text-left underline-offset-2 hover:underline">
                    {r.city}
                  </button>
                  <span className="block text-xs font-normal text-[color:var(--muted)]">{r.country}</span>
                </th>
                <td className="py-2 pr-3"><span className="numeral text-2xl font-semibold">{r.aqi}</span></td>
                <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: cat.color, color: cat.ink }}>{cat.label}</span></td>
                <td className="py-2 pr-3 text-xs text-[color:var(--muted)]">
                  {kind === "MEASURED" ? <>{r.stations} station{r.stations === 1 ? "" : "s"}{r.stations < 3 && <span className="block text-amber-700 dark:text-amber-300">low coverage</span>}</> : "CAMS model grid"}
                </td>
                <td className="py-2">
                  <DataBadge compact kind={kind} source={kind === "MEASURED" ? "WAQI" : "Open-Meteo (CAMS)"} observedAt={r.observedAt} fetchedAt={meta?.fetchedAt} cached={meta?.cached} stale={false} detail={kind === "MEASURED" ? `Mean of ${r.stations} station AQI readings within ~33 km, all reported in the last 3 hours.` : "US AQI from the CAMS model for the city-centre grid cell."} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function LeaderboardPage() {
  const [scope, setScope] = useState<"all" | "india">("all");
  const [asc, setAsc] = useState(false);
  const q = useQuery({ queryKey: ["leaderboard"], queryFn: () => fetchJsonOrThrow<LeaderboardResponse>("/api/leaderboard"), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const d = q.data;
  const filt = (rows: LeaderboardRow[]) => (scope === "india" ? rows.filter((r) => r.india) : rows);
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">City leaderboard</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Major cities ranked by the average AQI of their live monitoring stations (readings from the last 3 hours). Cities with no live station are listed separately with a <strong>modelled</strong> estimate and are never ranked against measured ones.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "india"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-sm font-medium aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">
            {s === "all" ? "All cities" : "India"}
          </button>
        ))}
        <button type="button" onClick={() => setAsc((a) => !a)} className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-sm font-medium">
          <ArrowUpDown size={14} aria-hidden /> {asc ? "Cleanest first" : "Most polluted first"}
        </button>
      </div>
      {q.isPending && <Skeleton className="h-96 w-full" />}
      {q.isError && <ErrorState title="Couldn't load the leaderboard" message={(q.error as Error).message} onRetry={() => q.refetch()} />}
      {d && (
        <>
          <section aria-labelledby="m-h" className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="m-h" className="font-display text-2xl">Ranked by measured AQI</h2>
              {d.measuredMeta && <DataBadge compact kind="MEASURED" source="WAQI" observedAt={d.measuredMeta.observedAt} fetchedAt={d.measuredMeta.fetchedAt} cached={d.measuredMeta.cached} stale={false} />}
            </div>
            <div className="mt-3"><Table rows={filt(d.measured)} kind="MEASURED" meta={d.measuredMeta} asc={asc} /></div>
          </section>
          <section aria-labelledby="mod-h" className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="mod-h" className="font-display text-2xl">No live station: modelled estimates</h2>
              {d.modelledMeta && <DataBadge compact kind="MODELLED" source="Open-Meteo (CAMS)" observedAt={d.modelledMeta.observedAt} fetchedAt={d.modelledMeta.fetchedAt} cached={d.modelledMeta.cached} stale={false} />}
            </div>
            <p className="mt-1 text-sm text-[color:var(--muted)]">These cities had no monitoring station reporting in the last 3 hours in our sources. The values are model estimates and tend to under-read local peaks.</p>
            <div className="mt-3"><Table rows={filt(d.modelled)} kind="MODELLED" meta={d.modelledMeta} asc={asc} /></div>
            {d.unavailable.length > 0 && <p className="mt-3 text-sm text-[color:var(--muted)]">No data from any source: {d.unavailable.join(", ")}.</p>}
          </section>
        </>
      )}
    </div>
  );
}
