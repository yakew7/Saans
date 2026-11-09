"use client";

import { useTheme } from "next-themes";
import { useCallback, useMemo, useState } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { agoLabel, formatObserved, minutesAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { useMounted } from "@/lib/hooks/useMounted";
import { useStations, type Bounds } from "@/lib/hooks/useStations";
import { placeKey } from "@/lib/places";
import { useAppState } from "@/lib/store";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, EmptyState, Skeleton } from "@/components/ui/States";
import { MapClient } from "./MapClient";
import { StationPanel } from "./StationPanel";
import type { WaqiStationPoint } from "@/lib/sources/waqi";

export function MapPage() {
  const { current } = useAppState();
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();
  const now = useNow();
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [layerMode, setLayerMode] = useState<"markers" | "heat" | "both">("markers");
  const [focus, setFocus] = useState<{ lat: number; lon: number; key: string } | null>(null);
  const q = useStations(bounds);
  const stations = useMemo(() => q.data?.stations ?? [], [q.data]);
  const hotspots = useMemo(() => [...stations].sort((a, b) => b.aqi - a.aqi).slice(0, 10), [stations]);
  const center = focus ?? { lat: current.lat, lon: current.lon, key: placeKey(current) };
  const onSelect = useCallback((uid: number) => setSelected(uid), []);

  const tooBig = q.isError && /zoom in/i.test((q.error as Error).message);

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Air quality map</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Real monitoring stations in the current view, coloured by official AQI category. Pan and zoom to explore; use the search bar to fly to any city.
        </p>
      </div>

      {q.isError && !tooBig && <Banners banners={[{ id: "stations", severity: "warn", source: "WAQI", message: `Station list unavailable: ${(q.error as Error).message}. Markers shown may be out of date.` }]} />}
      {tooBig && <Banners banners={[{ id: "zoom", severity: "info", source: "Map", message: "This area is too large to list stations. Zoom in to see them." }]} />}

      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Map layers</legend>
          <span aria-hidden className="text-sm font-medium">Layers:</span>
          {([["markers", "Markers"], ["heat", "Heatmap"], ["both", "Both"]] as const).map(([k, label]) => (
            <label key={k} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${layerMode === k ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--bg)]" : "border-[color:var(--border)]"}`}>
              <input type="radio" name="layer" value={k} checked={layerMode === k} onChange={() => setLayerMode(k)} className="sr-only" />
              {label}
            </label>
          ))}
        </fieldset>
        {layerMode !== "markers" && (
          <p className="flex items-center gap-2 text-xs text-[color:var(--muted)]">
            <span aria-hidden className="h-2.5 w-28 rounded-full" style={{ background: "linear-gradient(90deg,#00e400,#ffff00,#ff7e00,#ff0000,#8f3f97,#7e0023)" }} />
            AQI 0 → 300+. Relative intensity weighted by each real station’s AQI (dense station areas look hotter; read exact values from the markers). Blank areas have no stations, not clean air.
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="relative min-w-0">
          {!mounted && <Skeleton className="h-[62vh] min-h-[360px] w-full lg:h-[calc(100dvh-14rem)]" />}
          {mounted && (
            <MapClient center={center} centerKey={center.key} stations={stations} selectedUid={selected} onSelect={onSelect} onBounds={setBounds} dark={resolvedTheme === "dark"} showMarkers={layerMode !== "heat"} showHeat={layerMode !== "markers"} />
          )}
          <div className="pointer-events-none absolute bottom-6 left-3 z-[500] max-w-[85%]">
            <div className="pointer-events-auto rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]/95 px-3 py-2 text-xs shadow">
              <strong>{stations.length}</strong> stations in view
              {q.isFetching && <span className="ml-2 text-[color:var(--muted)]">updating…</span>}
              {q.data && <div className="mt-1"><DataBadge compact kind="MEASURED" source="WAQI" observedAt={q.data.meta.observedAt} fetchedAt={q.data.meta.fetchedAt} cached={q.data.meta.cached} /></div>}
            </div>
          </div>
        </div>

        <aside className="space-y-4 lg:max-h-[calc(100dvh-14rem)] lg:overflow-y-auto" aria-label="Station details and hotspots">
          {selected != null && <StationPanel uid={selected} onClose={() => setSelected(null)} />}
          <section aria-labelledby="hot-h" className="card p-4">
            <h2 id="hot-h" className="font-display text-xl">Hotspots in view</h2>
            <p className="text-xs text-[color:var(--muted)]">The ten highest current AQI readings among measured stations on screen.</p>
            {!hotspots.length ? (
              <div className="mt-3">
                <EmptyState title={q.isPending ? "Loading stations…" : "No stations in this view"}>{q.isPending ? null : "Pan or zoom out to find monitoring stations."}</EmptyState>
              </div>
            ) : (
              <ol className="mt-3 space-y-1">
                {hotspots.map((s, i) => (
                  <HotspotRow key={s.uid} rank={i + 1} s={s} now={now} active={s.uid === selected} onPick={() => { setSelected(s.uid); setFocus({ lat: s.lat, lon: s.lon, key: `st-${s.uid}` }); }} />
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>

      <details className="card p-4">
        <summary className="cursor-pointer font-medium">View stations in view as a table</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Stations currently in the map view, with AQI and reading time</caption>
            <thead>
              <tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]">
                <th scope="col" className="py-2 pr-3">Station</th>
                <th scope="col" className="py-2 pr-3">AQI</th>
                <th scope="col" className="py-2 pr-3">Category</th>
                <th scope="col" className="py-2">Reading time</th>
              </tr>
            </thead>
            <tbody>
              {stations.map((s) => (
                <tr key={s.uid} className="border-b border-[color:var(--border)]/60">
                  <th scope="row" className="py-1.5 pr-3 font-normal">{s.name}</th>
                  <td className="py-1.5 pr-3 tabular-nums">{Math.round(s.aqi)}</td>
                  <td className="py-1.5 pr-3">{categoryFor(s.aqi).label}</td>
                  <td className="py-1.5 text-[color:var(--muted)]">{formatObserved(s.observedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function HotspotRow({ rank, s, now, active, onPick }: { rank: number; s: WaqiStationPoint; now: number | null; active: boolean; onPick: () => void }) {
  const cat = categoryFor(s.aqi);
  const mins = now ? minutesAgo(s.observedAt, now) : null;
  const stale = mins != null && mins > 180;
  return (
    <li>
      <button type="button" onClick={onPick} aria-pressed={active} className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-[color:var(--surface-2)] ${active ? "bg-[color:var(--surface-2)]" : ""}`}>
        <span className="w-5 text-xs tabular-nums text-[color:var(--muted)]">{rank}</span>
        <span className="grid h-9 min-w-9 place-items-center rounded-full px-1.5 text-sm font-bold tabular-nums" style={{ background: cat.color, color: cat.ink }}>{Math.round(s.aqi)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{s.name}</span>
          <span className="block text-xs text-[color:var(--muted)]">
            {cat.label} · {mins != null ? agoLabel(mins) : "time unknown"}
            {stale && <strong className="ml-1 text-amber-700 dark:text-amber-300">STALE</strong>}
          </span>
        </span>
      </button>
    </li>
  );
}
