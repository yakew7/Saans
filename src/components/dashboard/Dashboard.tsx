"use client";

import { useEffect } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { useAir } from "@/lib/hooks/useAir";
import { useGeolocate } from "@/lib/hooks/useGeolocate";
import { useAtmosphere } from "@/lib/hooks/useAtmosphere";
import { placeKey, type Place } from "@/lib/places";
import { store, useAppState } from "@/lib/store";
import { Banners, EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { ProvenanceLegend } from "@/components/ui/ProvenanceLegend";
import { AqiHero } from "./AqiHero";
import { CrossCheckCard } from "./CrossCheckCard";
import { LocationBar } from "./LocationBar";
import { PollutantCard } from "./PollutantCard";
import { SourcesPanel } from "./SourcesPanel";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading air quality">
      <Skeleton className="h-72 w-full" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </div>
  );
}

export function Dashboard({ initial }: { initial?: Place | null }) {
  const { current, standard } = useAppState();
  useEffect(() => {
    if (initial && placeKey(initial) !== placeKey(store.get().current)) store.setCurrent(initial);
    // run once for the URL-provided place
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const geo = useGeolocate();
  useEffect(() => {
    // First visit only: auto-detect when location permission was ALREADY granted (never triggers a prompt). Otherwise Delhi stays the default.
    if (initial || store.get().recents.length) return;
    navigator.permissions
      ?.query({ name: "geolocation" })
      .then((r) => {
        if (r.state === "granted") geo.locate();
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const q = useAir(current.lat, current.lon);
  const snap = q.data;
  const primary = snap?.primary ?? null;
  const cat = primary?.aqi != null ? categoryFor(primary.aqi) : null;
  useAtmosphere(cat?.id);

  return (
    <div className="space-y-6 pb-8">
      <LocationBar place={current} observedAt={primary?.meta.observedAt ?? null} checkedAt={q.dataUpdatedAt} refreshing={q.isFetching} onRefresh={() => q.refetch()} />

      {q.isPending && <DashboardSkeleton />}

      {q.isError && !snap && <ErrorState title="Couldn't load air quality" message={(q.error as Error).message} onRetry={() => q.refetch()} />}

      {snap && (
        <>
          {q.isError && <Banners banners={[{ id: "refresh", severity: "warn", source: "Saans", message: "The last refresh failed. Showing the most recent data we have." }]} />}
          <Banners banners={snap.banners} />
          {primary ? (
            <>
              <AqiHero primary={primary} standard={standard} onStandard={store.setStandard} />
              <section aria-labelledby="pol-h">
                <h2 id="pol-h" className="mb-3 font-display text-2xl">Pollutants</h2>
                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-3">
                  {primary.pollutants.map((e) => (
                    <PollutantCard key={e.id} entry={e} primary={primary} />
                  ))}
                </div>
              </section>
              <div className="grid gap-6 lg:grid-cols-2">
                <CrossCheckCard snap={snap} />
                <SourcesPanel chain={snap.chain} />
              </div>
            </>
          ) : (
            <>
              <EmptyState title="No air quality data for this place right now">
                None of our sources returned usable data for {current.name}. Try a nearby larger city, or check back shortly.
              </EmptyState>
              <SourcesPanel chain={snap.chain} />
            </>
          )}
        </>
      )}
      <ProvenanceLegend />
    </div>
  );
}
