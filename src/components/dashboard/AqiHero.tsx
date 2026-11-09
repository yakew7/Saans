"use client";

import { Frown, Meh, Skull, Smile, TriangleAlert, OctagonAlert } from "lucide-react";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import Link from "next/link";
import { CATEGORIES, categoryFor, naqiCategoryFor, NAQI_CATEGORIES, type AqiCategory } from "@/lib/aqi/categories";
import { NAQI_FORMULA } from "@/lib/aqi/naqi";
import { ADVICE } from "@/lib/health";
import { POLLUTANT_INFO } from "@/lib/pollutants";
import type { Primary } from "@/lib/sources/snapshot";
import { DataBadge } from "@/components/ui/DataBadge";

const ICONS: Record<AqiCategory["icon"], typeof Smile> = { smile: Smile, meh: Meh, frown: Frown, "alert-triangle": TriangleAlert, "alert-octagon": OctagonAlert, skull: Skull };

export function CategoryChip({ cat }: { cat: AqiCategory }) {
  const Icon = ICONS[cat.icon];
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold" style={{ background: cat.color, color: cat.ink }}>
      <Icon size={16} aria-hidden />
      {cat.label}
    </span>
  );
}

function ScaleBar({ value, max = 500, segments }: { value: number; max?: number; segments: { color: string; min: number; max: number; label: string }[] }) {
  const pos = Math.min(100, (Math.max(0, value) / max) * 100);
  return (
    <div className="mt-5">
      <div className="relative">
        <div className="flex h-3 overflow-hidden rounded-full" aria-hidden>
          {segments.map((s) => (
            <div key={s.label} style={{ background: s.color, flex: Math.min(s.max, max) - s.min + 1 }} />
          ))}
        </div>
        <div aria-hidden className="absolute -top-1.5 h-6 w-1 -translate-x-1/2 rounded-full border border-[color:var(--bg)] bg-[color:var(--ink)]" style={{ left: `${pos}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-[color:var(--muted)]" aria-hidden>
        <span>0</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

export function AqiHero({
  primary,
  standard,
  onStandard,
}: {
  primary: Primary;
  standard: "us" | "naqi";
  onStandard: (s: "us" | "naqi") => void;
}) {
  const useNaqi = standard === "naqi" && primary.naqi != null;
  const value = useNaqi ? primary.naqi!.aqi : primary.aqi;
  const cat = value != null ? categoryFor(value) : null;
  const naqiCat = useNaqi ? naqiCategoryFor(primary.naqi!.aqi) : null;
  const dominant = (useNaqi ? primary.naqi!.dominant : primary.dominant) ?? null;
  const advice = cat ? ADVICE[cat.id] : null;
  const label = useNaqi ? naqiCat!.label : cat?.label;
  const chipCat: AqiCategory | null = useNaqi && naqiCat ? { ...(cat ?? CATEGORIES[0]), label: naqiCat.label, color: naqiCat.color, ink: naqiCat.ink } : cat;

  return (
    <section aria-labelledby="aqi-h" className="card rise overflow-hidden p-5 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="aqi-h" className="text-sm font-semibold uppercase tracking-widest text-[color:var(--muted)]">
          {useNaqi ? "Air quality index · India NAQI (PM-only)" : "Air quality index · US EPA scale"}
        </h2>
        <ToggleGroup.Root
          type="single"
          value={standard}
          onValueChange={(v) => v && onStandard(v as "us" | "naqi")}
          aria-label="AQI standard"
          className="inline-flex rounded-full border border-[color:var(--border)] p-0.5 text-xs font-semibold"
        >
          {(["us", "naqi"] as const).map((k) => (
            <ToggleGroup.Item
              key={k}
              value={k}
              disabled={k === "naqi" && primary.naqi == null}
              title={k === "naqi" && primary.naqi == null ? "NAQI needs 24 h of PM2.5/PM10 data from an OpenAQ station" : undefined}
              className="rounded-full px-3 py-1.5 data-[state=on]:bg-[color:var(--ink)] data-[state=on]:text-[color:var(--bg)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {k === "us" ? "US AQI" : "India NAQI"}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
      </div>

      <div className="mt-4 grid items-end gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <p className="numeral text-[clamp(6rem,22vw,11rem)] font-semibold leading-[0.85]" aria-label={value != null ? `AQI ${value}` : "AQI not available"}>
            {value ?? "—"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chipCat ? <CategoryChip cat={chipCat} /> : <span className="text-sm text-[color:var(--muted)]">Not enough data to compute an AQI</span>}
          </div>
        </div>
        <div className="space-y-3">
          {advice && <p className="font-display text-2xl leading-snug sm:text-3xl">{advice.headline}</p>}
          {cat && !useNaqi && <p className="text-sm text-[color:var(--muted)]">{cat.summary}</p>}
          {useNaqi && (
            <p className="text-sm text-[color:var(--muted)]">
              CPCB category: <strong>{label}</strong>. PM-only NAQI is computed from 24 h average PM2.5 and PM10, so it can read higher than a gas-inclusive official figure. Basis: {primary.naqi!.basis}.
            </p>
          )}
          <p className="text-sm">
            <span className="text-[color:var(--muted)]">Dominant pollutant: </span>
            <strong>{dominant ? `${POLLUTANT_INFO[dominant].symbol} (${POLLUTANT_INFO[dominant].name.toLowerCase()})` : "not determined"}</strong>
          </p>
          <DataBadge
            kind={useNaqi ? "COMPUTED" : primary.aqiBadge}
            source={primary.meta.source}
            observedAt={primary.meta.observedAt}
            fetchedAt={primary.meta.fetchedAt}
            stale={primary.meta.stale}
            cached={primary.meta.cached}
            detail={useNaqi ? NAQI_FORMULA : primary.aqiDetail}
          />
          <p className="text-sm text-[color:var(--muted)]">
            {primary.key === "open-meteo" ? (
              <>Modelled estimate for the {primary.meta.stationName?.toLowerCase()}. No station reading is shown here.</>
            ) : (
              <>
                Station: <strong className="text-[color:var(--ink)]">{primary.meta.stationName}</strong>
                {primary.meta.stationDistanceKm != null && <> · {primary.meta.stationDistanceKm} km from the searched point</>}
              </>
            )}
          </p>
          {advice && (
            <Link href="/health" className="inline-block text-sm font-medium underline underline-offset-4">
              What should I do now? →
            </Link>
          )}
        </div>
      </div>

      {value != null && !useNaqi && (
        <ScaleBar value={value} segments={CATEGORIES.map((c) => ({ color: c.color, min: c.min, max: c.max, label: c.label }))} />
      )}
      {value != null && useNaqi && (
        <ScaleBar value={value} segments={NAQI_CATEGORIES.map((c) => ({ color: c.color, min: c.min, max: c.max, label: c.label }))} />
      )}
    </section>
  );
}
