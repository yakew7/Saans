"use client";

import { LocateFixed, RefreshCw, Star } from "lucide-react";
import { GEO_MESSAGES, useGeolocate } from "@/lib/hooks/useGeolocate";
import { agoLabel, formatObserved, minutesAgo } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { INDIA_METROS, placeKey, type Place } from "@/lib/places";
import { store, useAppState } from "@/lib/store";
import { ShareDialog } from "./ShareDialog";

export function LocationBar({
  place,
  observedAt,
  checkedAt,
  refreshing,
  onRefresh,
}: {
  place: Place;
  observedAt: string | null;
  checkedAt: number;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { favourites } = useAppState();
  const now = useNow();
  const geo = useGeolocate();
  const fav = favourites.some((f) => placeKey(f) === placeKey(place));
  const checkedMin = now != null && checkedAt ? Math.max(0, Math.round((now - checkedAt) / 60000)) : null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl leading-tight sm:text-4xl">{place.name}</h1>
          {place.country && <p className="text-sm text-[color:var(--muted)]">{place.country}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => store.toggleFavourite(place)}
            aria-pressed={fav}
            aria-label={fav ? `Remove ${place.name} from favourites` : `Add ${place.name} to favourites`}
            className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] hover:bg-[color:var(--surface-2)]"
          >
            <Star size={18} aria-hidden className={fav ? "fill-current" : ""} />
          </button>
          <ShareDialog place={place} />
          <button
            type="button"
            onClick={geo.locate}
            disabled={geo.status === "locating"}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-60"
          >
            <LocateFixed size={14} aria-hidden className={geo.status === "locating" ? "animate-pulse" : ""} />
            {geo.status === "locating" ? "Locating…" : "Use my location"}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 text-sm font-medium hover:bg-[color:var(--surface-2)] disabled:opacity-60"
          >
            <RefreshCw size={14} aria-hidden className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>
      <p className="text-xs text-[color:var(--muted)]" aria-live="polite">
        {observedAt ? <>Latest reading: <strong className="text-[color:var(--ink)]">{formatObserved(observedAt)}</strong> ({agoLabel(now ? minutesAgo(observedAt, now) : null)}). </> : null}
        Checked for updates {checkedMin == null ? "…" : agoLabel(checkedMin)} · auto-refresh every 10 min.
      </p>
      {geo.status !== "idle" && geo.status !== "locating" && (
        <p role="status" className="rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-sm">{GEO_MESSAGES[geo.status]}</p>
      )}
      <nav aria-label="Indian metros" className="flex flex-wrap gap-1.5">
        {INDIA_METROS.map((m) => (
          <button
            key={m.name}
            type="button"
            onClick={() => store.setCurrent(m)}
            aria-pressed={placeKey(m) === placeKey(place)}
            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-medium hover:bg-[color:var(--surface-2)] aria-pressed:bg-[color:var(--ink)] aria-pressed:text-[color:var(--bg)]"
          >
            {m.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
