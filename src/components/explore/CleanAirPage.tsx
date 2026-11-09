"use client";

import { useQuery } from "@tanstack/react-query";
import { Navigation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useAppState, store } from "@/lib/store";
import type { CleanAirResponse, CleanStation } from "@/lib/sources/cleanair";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

const RADII = [10, 25, 50, 100];

function goUrl(s: CleanStation) {
  return `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}`;
}

export function CleanAirPage() {
  const { current } = useAppState();
  const router = useRouter();
  const [radius, setRadius] = useState(25);
  const q = useQuery({
    queryKey: ["clean-air", current.lat.toFixed(2), current.lon.toFixed(2), radius],
    queryFn: () => fetchJsonOrThrow<CleanAirResponse>(`/api/clean-air?lat=${current.lat.toFixed(4)}&lon=${current.lon.toFixed(4)}&radius=${radius}`),
    staleTime: 3 * 60_000,
  });
  const d = q.data;
  const best = d?.cleanest[0] ?? null;
  const gain = best && d?.nearest ? d.nearest.aqi - best.aqi : null;

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Clean air finder · {current.name}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">The cleanest <strong>measured</strong> stations within a radius, with distance, direction and a route link. Only stations that reported in the last 3 hours are counted.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Radius:</span>
        {RADII.map((r) => (
          <button key={r} type="button" aria-pressed={radius === r} onClick={() => setRadius(r)} className="rounded-full border border-[color:var(--border)] px-3 py-1.5 text-sm font-medium aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">
            {r} km
          </button>
        ))}
      </div>

      {q.isPending && <Skeleton className="h-72 w-full" />}
      {q.isError && <ErrorState title="Couldn't search for stations" message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {d && (
        <>
          {d.meta?.servedStale && <Banners banners={[{ id: "c", severity: "warn", source: "WAQI", message: "WAQI is unreachable. Showing the last cached station list." }]} />}
          {!d.cleanest.length ? (
            <EmptyState title={`No live stations within ${radius} km`}>Try a larger radius, or search for a larger nearby city.</EmptyState>
          ) : (
            <>
              <section aria-labelledby="best-h" className="card rise p-5">
                <h2 id="best-h" className="font-display text-2xl">Cleanest nearby</h2>
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <p className="numeral text-6xl font-semibold leading-none">{best!.aqi}</p>
                  <div>
                    <CategoryChip cat={categoryFor(best!.aqi)} />
                    <p className="mt-1 font-medium">{best!.name}</p>
                    <p className="text-sm text-[color:var(--muted)]">{best!.distanceKm} km {best!.direction} of {current.name}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm" role="status">
                  {gain != null && d.nearest && best!.uid !== d.nearest.uid
                    ? gain > 0
                      ? <>That is <strong>{gain} AQI points cleaner</strong> than the nearest station to you ({d.nearest.name}, AQI {d.nearest.aqi}).</>
                      : <>The nearest station to you is already about as clean as anything within {radius} km.</>
                    : <>The cleanest station within {radius} km is also your nearest.</>}
                </p>
                {best!.aqi > 100 && <p className="mt-2 rounded-lg bg-amber-500/15 px-3 py-2 text-sm">Even the cleanest station in this radius is {categoryFor(best!.aqi).label}. A cleaner area may be further away, or the whole region is affected. Check the forecast before travelling.</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <DataBadge kind="MEASURED" source="WAQI" observedAt={best!.observedAt} fetchedAt={d.meta?.fetchedAt} cached={d.meta?.cached} />
                  <a href={goUrl(best!)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--bg)]">
                    <Navigation size={14} aria-hidden /> Go there (opens maps)
                  </a>
                </div>
              </section>

              <section aria-labelledby="list-h" className="card p-4 sm:p-5">
                <h2 id="list-h" className="font-display text-2xl">Cleanest stations within {radius} km</h2>
                <p className="text-sm text-[color:var(--muted)]">{d.considered} live stations considered.</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <caption className="sr-only">Cleanest measured stations nearby</caption>
                    <thead>
                      <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                        <th scope="col" className="py-2 pr-3">Station</th><th scope="col" className="py-2 pr-3">AQI</th><th scope="col" className="py-2 pr-3">Distance</th><th scope="col" className="py-2 pr-3">Direction</th><th scope="col" className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.cleanest.map((s) => (
                        <tr key={s.uid} className="border-b border-[color:var(--border)]/60">
                          <th scope="row" className="py-2 pr-3 font-medium">{s.name}</th>
                          <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-xs font-bold tabular-nums" style={{ background: categoryFor(s.aqi).color, color: categoryFor(s.aqi).ink }}>{s.aqi}</span></td>
                          <td className="py-2 pr-3 tabular-nums">{s.distanceKm} km</td>
                          <td className="py-2 pr-3">{s.direction}</td>
                          <td className="py-2">
                            <span className="flex flex-wrap gap-3">
                              <a href={goUrl(s)} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Go there</a>
                              <button type="button" onClick={() => { store.setCurrent({ name: s.name.split(",")[0], lat: s.lat, lon: s.lon }); router.push("/map"); }} className="underline underline-offset-2">View on map</button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-[color:var(--muted)]">Direction is the compass bearing from {current.name}. AQI values are station readings published by WAQI (US EPA scale), each MEASURED.</p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
