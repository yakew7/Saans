"use client";

import { useQueries } from "@tanstack/react-query";
import { Link2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { cleanest, MAX_COMPARE, serializeLocs } from "@/lib/compare";
import { fmtNum } from "@/lib/format";
import type { DayValue } from "@/lib/history";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { placeKey, type Place } from "@/lib/places";
import { POLLUTANT_INFO, unitLabel } from "@/lib/pollutants";
import type { AirSnapshot, PollutantEntry, Primary } from "@/lib/sources/snapshot";
import type { Meta } from "@/lib/types";
import { POLLUTANTS } from "@/lib/types";
import { ChartShell } from "@/components/charts/ChartShell";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { LocationSearch } from "@/components/layout/LocationSearch";
import { DataBadge } from "@/components/ui/DataBadge";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { COMPARE_COLORS, CompareTrendChart } from "./CompareTrendChart";
import type { BadgeKind } from "@/lib/types";

interface TrendResp {
  source: string | null;
  badge: BadgeKind | null;
  meta: Meta | null;
  days: DayValue[];
  banners: { id: string; message: string }[];
}

export function ComparePage({ initial }: { initial: Place[] }) {
  const [places, setPlaces] = useState<Place[]>(initial);
  const [refIdx, setRefIdx] = useState(0);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const qs = places.length ? `?locs=${serializeLocs(places)}` : "";
    window.history.replaceState(null, "", `/compare${qs}`);
  }, [places]);

  const air = useQueries({
    queries: places.map((p) => ({
      queryKey: ["air", p.lat.toFixed(2), p.lon.toFixed(2)],
      queryFn: () => fetchJsonOrThrow<AirSnapshot>(`/api/air?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}`),
      staleTime: 60_000,
    })),
  });
  const trend = useQueries({
    queries: places.map((p) => ({
      queryKey: ["trend", p.lat.toFixed(2), p.lon.toFixed(2), 30],
      queryFn: () => fetchJsonOrThrow<TrendResp>(`/api/trend?lat=${p.lat.toFixed(4)}&lon=${p.lon.toFixed(4)}&days=30`),
      staleTime: 10 * 60_000,
    })),
  });

  const add = (p: Place) => setPlaces((cur) => (cur.length >= MAX_COMPARE || cur.some((c) => placeKey(c) === placeKey(p)) ? cur : [...cur, p]));
  const remove = (i: number) => {
    setPlaces((cur) => cur.filter((_, k) => k !== i));
    setRefIdx(0);
  };
  const share = async () => {
    const url = `${window.location.origin}/compare?locs=${serializeLocs(places)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("Link copied to clipboard.");
    } catch {
      setCopied(`Copy this link: ${url}`);
    }
  };

  const primaries: (Primary | null)[] = air.map((q) => q.data?.primary ?? null);
  const verdict = cleanest(
    places.map((p, i) => ({ name: p.name, aqi: primaries[i]?.aqi ?? null, measured: !!primaries[i] && primaries[i]!.key !== "open-meteo" })),
  );
  const loading = air.some((q) => q.isPending);
  const mixedSources = new Set(primaries.filter(Boolean).map((p) => p!.key)).size > 1;
  const ref = primaries[refIdx] ?? null;

  const series = places
    .map((p, i) => ({ name: p.name, days: trend[i]?.data?.days ?? [], badge: trend[i]?.data?.badge ?? null, meta: trend[i]?.data?.meta ?? null, color: COMPARE_COLORS[i] }))
    .filter((s) => s.days.length);

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Compare locations</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Put 2 to 4 places side by side. Each column shows its own source and station, so you can see how comparable they really are.</p>
      </div>

      <section aria-label="Locations" className="card space-y-3 p-4">
        <ul className="flex flex-wrap gap-2">
          {places.map((p, i) => (
            <li key={placeKey(p)} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] py-1 pl-3 pr-1 text-sm">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} />
              {p.name}
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${p.name}`} className="grid h-7 w-7 place-items-center rounded-full hover:bg-[color:var(--surface-2)]">
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          {places.length < MAX_COMPARE ? (
            <div className="flex w-full max-w-sm items-center gap-2">
              <Plus size={16} aria-hidden />
              <LocationSearch onSelect={add} placeholder="Add a city to compare…" label="Add a location to compare" className="flex-1" />
            </div>
          ) : (
            <p className="text-sm text-[color:var(--muted)]">Maximum of {MAX_COMPARE} locations. Remove one to add another.</p>
          )}
          <button type="button" onClick={share} disabled={!places.length} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-50">
            <Link2 size={14} aria-hidden /> Copy shareable link
          </button>
        </div>
        <p role="status" aria-live="polite" className="text-xs text-[color:var(--muted)]">{copied}</p>
      </section>

      {places.length < 2 && <EmptyState title="Add at least two locations">Use the search box above to add cities. The comparison appears here.</EmptyState>}

      {places.length >= 2 && (
        <>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <section aria-labelledby="cl-h" className="card rise p-5">
              <h2 id="cl-h" className="font-display text-2xl">Relatively cleanest right now</h2>
              {verdict.winner ? (
                <>
                  <p className="mt-2 text-lg">
                    <strong>{verdict.winner.name}</strong> has the lowest AQI ({verdict.winner.aqi}) among the {verdict.considered} location{verdict.considered > 1 ? "s" : ""} with {verdict.basis === "measured" ? "station-based" : "modelled"} data.
                  </p>
                  <ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--muted)]">
                    {verdict.basis === "modelled" && <li>No location had a station reading, so this ranks MODELLED CAMS estimates. Treat it as indicative.</li>}
                    {verdict.missing.length > 0 && <li>Not ranked (no data right now): {verdict.missing.join(", ")}. The result is based only on available measurements.</li>}
                    {mixedSources && <li>Locations use different sources or stations (see the table), so small differences are not meaningful.</li>}
                    {primaries.some((p) => p && p.key !== "open-meteo") && primaries.some((p) => p?.key === "open-meteo") && verdict.basis === "measured" && <li>Locations with only modelled data were left out of the ranking.</li>}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-[color:var(--muted)]">None of the selected locations has data right now, so no comparison is possible.</p>
              )}
            </section>
          )}

          <section aria-labelledby="tbl-h" className="card p-4 sm:p-5">
            <h2 id="tbl-h" className="font-display text-2xl">Side by side</h2>
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              Differences (Δ) are against the reference column <strong>{places[refIdx]?.name}</strong>. Pick another reference with the button under a name. Pollutant differences are shown only when both values are concentrations in the same unit.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-sm">
                <caption className="sr-only">Air quality comparison across selected locations</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 bg-[color:var(--surface)] py-2 pr-3 text-xs uppercase text-[color:var(--muted)]">Metric</th>
                    {places.map((p, i) => (
                      <th key={placeKey(p)} scope="col" className="border-b border-[color:var(--border)] px-3 py-2 align-bottom">
                        <span className="flex items-center gap-1.5 font-display text-lg"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: COMPARE_COLORS[i] }} />{p.name}</span>
                        <button type="button" onClick={() => setRefIdx(i)} aria-pressed={refIdx === i} className="mt-1 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[11px] font-medium aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]">
                          {refIdx === i ? "Reference" : "Use as reference"}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <Row label="AQI (US EPA)">
                    {places.map((p, i) => {
                      const pr = primaries[i];
                      const q = air[i];
                      if (q.isPending) return <td key={placeKey(p)} className="px-3 py-3"><Skeleton className="h-12 w-24" /></td>;
                      if (q.isError) return <td key={placeKey(p)} className="px-3 py-3 text-xs text-red-700 dark:text-red-300">Couldn’t load</td>;
                      if (!pr || pr.aqi == null) return <td key={placeKey(p)} className="px-3 py-3 text-[color:var(--muted)]">— no data</td>;
                      const cat = categoryFor(pr.aqi);
                      const d = ref?.aqi != null && i !== refIdx ? pr.aqi - ref.aqi : null;
                      return (
                        <td key={placeKey(p)} className="px-3 py-3 align-top">
                          <p className="numeral text-4xl font-semibold leading-none">{pr.aqi}</p>
                          <div className="mt-1"><CategoryChip cat={cat} /></div>
                          {d != null && <p className="mt-1 text-xs tabular-nums">Δ {d > 0 ? "+" : ""}{d}</p>}
                          <div className="mt-1.5"><DataBadge compact kind={pr.aqiBadge} source={pr.meta.source} observedAt={pr.meta.observedAt} fetchedAt={pr.meta.fetchedAt} stale={pr.meta.stale} cached={pr.meta.cached} detail={pr.aqiDetail} /></div>
                        </td>
                      );
                    })}
                  </Row>
                  <Row label="Station">
                    {places.map((p, i) => {
                      const pr = primaries[i];
                      return <td key={placeKey(p)} className="px-3 py-2 text-xs text-[color:var(--muted)]">{pr ? <>{pr.meta.stationName}{pr.meta.stationDistanceKm != null && <> · {pr.meta.stationDistanceKm} km</>}</> : "—"}</td>;
                    })}
                  </Row>
                  <Row label="Dominant pollutant">
                    {places.map((p, i) => <td key={placeKey(p)} className="px-3 py-2">{primaries[i]?.dominant ? POLLUTANT_INFO[primaries[i]!.dominant!].symbol : "—"}</td>)}
                  </Row>
                  {POLLUTANTS.map((id) => (
                    <Row key={id} label={POLLUTANT_INFO[id].symbol}>
                      {places.map((p, i) => {
                        const e = primaries[i]?.pollutants.find((x) => x.id === id);
                        return <td key={placeKey(p)} className="px-3 py-2 align-top">{cell(e, ref?.pollutants.find((x) => x.id === id), i === refIdx)}</td>;
                      })}
                    </Row>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-[color:var(--muted)]">“—” means the source does not report that pollutant. Sub-index values (WAQI) are not concentrations and are not compared across sources.</p>
          </section>

          <ChartShell
            title="Daily AQI over the last 30 days"
            description="One line per location, each from a single source. The badge under each name says which."
            badge={
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {series.map((s) => (
                  <li key={s.name} className="flex flex-wrap items-center gap-2 text-xs">
                    <span aria-hidden className="h-1.5 w-5 rounded" style={{ background: s.color }} />
                    <strong>{s.name}</strong>
                    {s.badge && s.meta && <DataBadge compact kind={s.badge} source={s.meta.source} observedAt={s.meta.observedAt} fetchedAt={s.meta.fetchedAt} stale={false} cached={s.meta.cached} />}
                  </li>
                ))}
              </ul>
            }
            table={
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Daily AQI by location</caption>
                <thead><tr><th scope="col" className="pr-3">Date</th>{series.map((s) => <th scope="col" key={s.name} className="pr-3">{s.name}</th>)}</tr></thead>
                <tbody>
                  {[...new Set(series.flatMap((s) => s.days.map((d) => d.date)))].sort().map((date) => (
                    <tr key={date}><td className="pr-3">{date}</td>{series.map((s) => <td key={s.name} className="pr-3 tabular-nums">{s.days.find((d) => d.date === date)?.aqi ?? "—"}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            }
          >
            {trend.some((t) => t.isPending) && !series.length ? <Skeleton className="h-80 w-full" /> : series.length ? <CompareTrendChart series={series} /> : <ErrorState title="No history available" message="None of the selected locations returned daily history." />}
          </ChartShell>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-[color:var(--border)]/60">
      <th scope="row" className="sticky left-0 z-10 border-b border-[color:var(--border)]/60 bg-[color:var(--surface)] py-2 pr-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">{label}</th>
      {children}
    </tr>
  );
}

function cell(e: PollutantEntry | undefined, ref: PollutantEntry | undefined, isRef: boolean) {
  if (!e || e.value == null) return <span className="text-[color:var(--muted)]">— <span className="text-xs">not reported</span></span>;
  const isSub = e.basis === "subindex";
  const comparable = !isRef && ref && ref.value != null && ref.basis === "concentration" && e.basis === "concentration" && ref.unit === e.unit && ref.value !== 0;
  const d = comparable ? e.value - ref!.value! : null;
  const pct = comparable ? (d! / ref!.value!) * 100 : null;
  return (
    <div>
      <p className="tabular-nums"><strong>{fmtNum(e.value, e.value < 10 ? 1 : 0)}</strong> <span className="text-xs text-[color:var(--muted)]">{isSub ? "sub-index" : unitLabel(e.unit)}</span></p>
      {d != null && pct != null && <p className="text-xs tabular-nums text-[color:var(--muted)]">Δ {d > 0 ? "+" : ""}{fmtNum(d, 1)} ({pct > 0 ? "+" : ""}{pct.toFixed(0)}%)</p>}
    </div>
  );
}
