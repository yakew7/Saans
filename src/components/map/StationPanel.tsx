"use client";

import { X } from "lucide-react";
import { categoryFor } from "@/lib/aqi/categories";
import { useStation } from "@/lib/hooks/useStations";
import { POLLUTANT_INFO } from "@/lib/pollutants";
import { store } from "@/lib/store";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { DataBadge } from "@/components/ui/DataBadge";
import { ErrorState, Skeleton } from "@/components/ui/States";
import type { PollutantId } from "@/lib/types";

const ORDER: PollutantId[] = ["pm25", "pm10", "no2", "so2", "co", "o3"];

export function StationPanel({ uid, onClose }: { uid: number; onClose: () => void }) {
  const q = useStation(uid);
  const s = q.data?.station;
  const meta = q.data?.meta;
  const cat = s?.aqi != null ? categoryFor(s.aqi) : null;
  // WAQI daily series also contains past days; only days from the station's current date onwards are a forecast
  const today = s?.observedAt?.slice(0, 10) ?? "";
  const upcoming = (s?.forecast.pm25 ?? []).filter((d) => d.day >= today);
  return (
    <section aria-labelledby="stn-h" className="card rise p-4" aria-live="polite">
      <div className="flex items-start justify-between gap-2">
        <h2 id="stn-h" className="font-display text-xl leading-snug">{s?.stationName ?? "Station"}</h2>
        <button type="button" onClick={onClose} aria-label="Close station details" className="grid h-8 w-8 shrink-0 place-items-center rounded-full hover:bg-[color:var(--surface-2)]">
          <X size={16} aria-hidden />
        </button>
      </div>
      {q.isPending && <Skeleton className="mt-3 h-40" />}
      {q.isError && <div className="mt-3"><ErrorState title="Couldn't load this station" message={(q.error as Error).message} onRetry={() => q.refetch()} /></div>}
      {s && meta && (
        <div className="mt-3 space-y-3">
          <div className="flex items-end gap-3">
            <p className="numeral text-6xl font-semibold leading-none">{s.aqi ?? "—"}</p>
            {cat && <CategoryChip cat={cat} />}
          </div>
          <DataBadge kind="MEASURED" source="WAQI" observedAt={meta.observedAt} fetchedAt={meta.fetchedAt} cached={meta.cached} stale={meta.stale} />
          {s.dominant && <p className="text-sm">Dominant pollutant: <strong>{POLLUTANT_INFO[s.dominant].symbol}</strong></p>}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">Pollutant sub-indices</h3>
            <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
              {ORDER.map((id) => (
                <div key={id} className="rounded-lg bg-[color:var(--surface-2)] px-2 py-1.5">
                  <dt className="text-xs text-[color:var(--muted)]">{POLLUTANT_INFO[id].symbol}</dt>
                  <dd className="numeral text-lg font-semibold">{s.subIndices[id] ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-1 text-xs text-[color:var(--muted)]">Per-pollutant AQI sub-indices, not concentrations. “—” means not reported by this station.</p>
          </div>
          {upcoming.length > 0 && (
            <div>
              <h3 className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">
                PM2.5 outlook <DataBadge compact kind="FORECAST" source="WAQI" observedAt={meta.observedAt} fetchedAt={meta.fetchedAt} />
              </h3>
              <ul className="mt-1 space-y-1 text-sm">
                {upcoming.slice(0, 5).map((d) => (
                  <li key={d.day} className="flex justify-between gap-2">
                    <span>{d.day}</span>
                    <span className="tabular-nums text-[color:var(--muted)]">
                      min {d.min} · avg <strong className="text-[color:var(--ink)]">{d.avg}</strong> · max {d.max}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-[color:var(--muted)]">WAQI daily forecast of the PM2.5 AQI sub-index.</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => store.setCurrent({ name: s.stationName.split(",")[0], lat: s.lat, lon: s.lon })}
            className="rounded-full bg-[color:var(--ink)] px-4 py-2 text-sm font-medium text-[color:var(--bg)]"
          >
            Use this as my location
          </button>
        </div>
      )}
    </section>
  );
}
