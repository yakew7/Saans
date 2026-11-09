"use client";

import { useQuery } from "@tanstack/react-query";
import { Ban, CheckCircle2, Clock, DoorOpen, Footprints, ShieldAlert, ShieldCheck, TriangleAlert, Wind, Zap, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { CATEGORIES, categoryFor } from "@/lib/aqi/categories";
import { fmtLocal } from "@/lib/format";
import { ADVICE, GROUP_LEVEL_LABEL, groupLevel, HEALTH_SOURCES, LEVEL_LABEL, NAQI_IMPACTS, SENSITIVE_GROUPS, type Level } from "@/lib/health";
import { fetchJsonOrThrow, useAir } from "@/lib/hooks/useAir";
import { useAtmosphere } from "@/lib/hooks/useAtmosphere";
import { useAppState } from "@/lib/store";
import type { ForecastResponse } from "@/lib/sources/forecast";
import { NAQI_CATEGORIES } from "@/lib/aqi/categories";
import { CategoryChip } from "@/components/dashboard/AqiHero";
import { DataBadge } from "@/components/ui/DataBadge";
import { Banners, ErrorState, Skeleton } from "@/components/ui/States";

const LEVEL_UI: Record<Level, { icon: LucideIcon; cls: string }> = {
  ok: { icon: CheckCircle2, cls: "border-emerald-600/50 bg-emerald-500/10" },
  caution: { icon: TriangleAlert, cls: "border-amber-600/50 bg-amber-500/10" },
  avoid: { icon: Ban, cls: "border-red-600/50 bg-red-500/10" },
};

function Activity({ icon: Icon, label, level, note, words }: { icon: LucideIcon; label: string; level: Level; note?: string; words?: Record<Level, string> }) {
  const ui = LEVEL_UI[level];
  const LevelIcon = ui.icon;
  return (
    <li className={`flex items-start gap-3 rounded-xl border p-3 ${ui.cls}`}>
      <Icon aria-hidden size={22} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">{label}</p>
        <p className="flex items-center gap-1 text-sm"><LevelIcon aria-hidden size={14} />{(words ?? LEVEL_LABEL)[level]}</p>
        {note && <p className="mt-1 text-sm text-[color:var(--muted)]">{note}</p>}
      </div>
    </li>
  );
}

export function HealthPage() {
  const { current } = useAppState();
  const air = useAir(current.lat, current.lon);
  const fc = useQuery({
    queryKey: ["forecast", current.lat.toFixed(2), current.lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<ForecastResponse>(`/api/forecast?lat=${current.lat.toFixed(4)}&lon=${current.lon.toFixed(4)}`),
    staleTime: 10 * 60_000,
  });
  const primary = air.data?.primary ?? null;
  const cat = primary?.aqi != null ? categoryFor(primary.aqi) : null;
  useAtmosphere(cat?.id);
  const advice = cat ? ADVICE[cat.id] : null;
  const best = fc.data?.best;
  const bestTomorrow = fc.data?.bestTomorrow;

  return (
    <div className="space-y-8 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Health &amp; safety · {current.name}</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">What the current air means for you, in plain language, and what to do about it.</p>
        <p className="mt-2 flex items-start gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-3 text-sm" role="note">
          <ShieldAlert aria-hidden size={18} className="mt-0.5 shrink-0" />
          <span><strong>Not medical advice.</strong> This is general information based on US EPA, India CPCB and WHO guidance. If you have a health condition, follow your doctor’s advice, and seek urgent care for chest pain, severe breathlessness or fainting.</span>
        </p>
      </div>

      {air.isPending && <Skeleton className="h-64 w-full" />}
      {air.isError && <ErrorState title="Couldn't load the current air quality" message={(air.error as Error).message} onRetry={() => air.refetch()} />}
      {air.data && <Banners banners={air.data.banners} />}

      {primary && cat && advice && (
        <section aria-labelledby="now-h" className="card rise p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="now-h" className="font-display text-2xl">What to do right now</h2>
            <DataBadge kind={primary.aqiBadge} source={primary.meta.source} observedAt={primary.meta.observedAt} fetchedAt={primary.meta.fetchedAt} stale={primary.meta.stale} cached={primary.meta.cached} detail={primary.aqiDetail} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="numeral text-6xl font-semibold leading-none">{primary.aqi}</span>
            <CategoryChip cat={cat} />
          </div>
          <p className="mt-3 font-display text-2xl">{advice.headline}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Activity icon={Footprints} label="Walking outside" level={advice.walk} />
            <Activity icon={Zap} label="Running / intense exercise" level={advice.run} />
            <Activity icon={DoorOpen} label="Opening windows" level={advice.windows} />
            <Activity icon={ShieldCheck} label="Mask" words={{ ok: "Not needed", caution: "Consider an N95", avoid: "Wear an N95/FFP2" }} level={cat.id === "good" || cat.id === "moderate" ? "ok" : cat.id === "usg" ? "caution" : "avoid"} note={advice.mask} />
            <Activity icon={Wind} label="Air purifier" words={{ ok: "Optional", caution: "Recommended indoors", avoid: "Run continuously" }} level={cat.id === "good" ? "ok" : cat.id === "moderate" ? "ok" : "caution"} note={advice.purifier} />
          </ul>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm">
            {advice.actions.map((a) => <li key={a}>{a}</li>)}
          </ul>
          {primary.key === "open-meteo" && <p className="mt-3 text-xs text-[color:var(--muted)]">This advice uses a modelled estimate because no station reading is available. Treat it as indicative.</p>}
        </section>
      )}

      <section aria-labelledby="best-h" className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="best-h" className="font-display text-2xl">Best time to go outside</h2>
          {fc.data?.meta && <DataBadge compact kind="FORECAST" source={fc.data.meta.source} observedAt={fc.data.meta.observedAt} fetchedAt={fc.data.meta.fetchedAt} cached={fc.data.meta.cached} />}
        </div>
        {fc.isPending && <Skeleton className="mt-3 h-16" />}
        {fc.isError && <p className="mt-2 text-sm text-red-700 dark:text-red-300">The forecast could not be loaded, so no best-time window is available.</p>}
        {fc.data && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[best, bestTomorrow].map((b, i) =>
              b ? (
                <div key={i} className="rounded-xl border border-[color:var(--border)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">{b.dayLabel === "today" ? "Today" : "Tomorrow"}</p>
                  <p className="mt-1 flex items-center gap-2 font-display text-3xl"><Clock aria-hidden size={22} />{fmtLocal(b.startLocal, "time")}–{fmtLocal(b.endLocal, "time")}</p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">Forecast AQI ≈ {b.meanAqi} ({b.categoryLabel}){b.improvement > 0 ? `, ${b.improvement} points better than the rest of daylight` : "; the day is fairly even"}.</p>
                </div>
              ) : (
                <div key={i} className="rounded-xl border border-[color:var(--border)] p-4 text-sm text-[color:var(--muted)]">{i === 0 ? "No full daylight window left today." : "No data for tomorrow."}</div>
              ),
            )}
          </div>
        )}
        <p className="mt-3 text-xs text-[color:var(--muted)]">
          Computed from the hourly CAMS forecast: the 2-hour window between 06:00 and 20:00 local time with the lowest average AQI. Models can under-read local peaks, so on high-pollution days the whole day may still be unhealthy.{" "}
          <Link href="/forecast" className="underline">See the full forecast</Link>.
        </p>
      </section>

      <section aria-labelledby="groups-h">
        <h2 id="groups-h" className="font-display text-2xl">Sensitive groups</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">{cat ? `Guidance for ${cat.label} air (AQI ${primary?.aqi}).` : "Guidance updates with the current air quality."}</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {SENSITIVE_GROUPS.map((g) => {
            const lvl = cat ? groupLevel(g, cat.id) : null;
            return (
              <article key={g.id} className="card p-4">
                <h3 className="font-display text-xl">{g.label}</h3>
                {lvl && (
                  <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${lvl === "avoid" ? "bg-red-500/15" : lvl === "caution" ? "bg-amber-500/20" : "bg-emerald-500/15"}`}>
                    {lvl === "avoid" ? <Ban size={13} aria-hidden /> : lvl === "caution" ? <TriangleAlert size={13} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />}
                    {GROUP_LEVEL_LABEL[lvl]}
                  </p>
                )}
                <p className="mt-2 text-sm text-[color:var(--muted)]">{g.why}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pm-h" className="card p-5 sm:p-6">
        <h2 id="pm-h" className="font-display text-2xl">PM2.5 vs PM10: why size matters</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <p className="font-display text-xl">PM2.5 · fine particles</p>
            <p className="mt-1 text-sm">Smaller than 2.5 micrometres, about 30 times thinner than a human hair. They slip past the nose and throat, reach deep into the lungs and can enter the bloodstream.</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--muted)]"><li>Sources: vehicle exhaust, burning of crop residue and waste, industry, firecrackers.</li><li>Effects: heart and lung disease, asthma attacks, reduced lung growth in children.</li><li>Stays suspended for days and travels far, so it is the main driver of the AQI in most Indian cities.</li></ul>
          </div>
          <div className="rounded-xl border border-[color:var(--border)] p-4">
            <p className="font-display text-xl">PM10 · coarse particles</p>
            <p className="mt-1 text-sm">Smaller than 10 micrometres. Mostly trapped in the nose and upper airways, but can still trigger coughing, throat and eye irritation.</p>
            <ul className="mt-2 list-disc pl-5 text-sm text-[color:var(--muted)]"><li>Sources: road and construction dust, soil, industrial grinding.</li><li>Effects: irritation, aggravated asthma and bronchitis.</li><li>Settles faster, so it varies more from street to street.</li></ul>
          </div>
        </div>
        <p className="mt-3 text-sm">A high PM2.5-to-PM10 ratio suggests combustion (traffic, burning). A low ratio suggests dust. Masks matter more for PM2.5: use a well-fitted N95/FFP2, not a cloth mask.</p>
      </section>

      <section aria-labelledby="cat-h" className="space-y-3">
        <h2 id="cat-h" className="font-display text-2xl">AQI categories explained</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => (
            <article key={c.id} className={`card p-4 ${cat?.id === c.id ? "ring-2 ring-[color:var(--ink)]" : ""}`}>
              <CategoryChip cat={c} />
              <p className="mt-2 text-sm font-semibold">AQI {c.min}–{c.id === "hazardous" ? "500" : c.max}{cat?.id === c.id && <span className="ml-2 rounded bg-[color:var(--ink)] px-1.5 py-0.5 text-[10px] text-[color:var(--bg)]">NOW</span>}</p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">{c.summary}</p>
              <p className="mt-2 text-sm">{ADVICE[c.id].headline}</p>
            </article>
          ))}
        </div>
        <details className="card p-4">
          <summary className="cursor-pointer font-medium">India’s NAQI (CPCB) categories and health impacts</summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <caption className="sr-only">CPCB National Air Quality Index categories</caption>
              <thead><tr className="border-b border-[color:var(--border)] text-xs uppercase text-[color:var(--muted)]"><th scope="col" className="py-2 pr-3">Category</th><th scope="col" className="py-2 pr-3">NAQI</th><th scope="col" className="py-2">Possible health impact</th></tr></thead>
              <tbody>
                {NAQI_IMPACTS.map((r, i) => (
                  <tr key={r.label} className="border-b border-[color:var(--border)]/60">
                    <th scope="row" className="py-2 pr-3 font-medium"><span aria-hidden className="mr-2 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: NAQI_CATEGORIES[i].color }} />{r.label}</th>
                    <td className="py-2 pr-3 tabular-nums">{r.range}</td>
                    <td className="py-2 text-[color:var(--muted)]">{r.impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="gen-h" className="card p-5 sm:p-6">
        <h2 id="gen-h" className="font-display text-2xl">General precautions for polluted days</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {[
            "Check the AQI before planning outdoor exercise; move it to the cleanest hours or indoors.",
            "Keep windows closed during peak pollution; ventilate briefly when the air is cleaner.",
            "Use a HEPA air purifier in the room where you sleep, sized for the room.",
            "Wear a fitted N95/FFP2 outdoors on Unhealthy days. Check the seal; beards and gaps reduce protection.",
            "Avoid burning waste, mosquito coils and incense indoors; use exhaust fans when cooking.",
            "Drink water, and see a doctor if cough, wheeze or chest tightness persists.",
            "Avoid exercising near heavy traffic; parks away from main roads are better.",
            "Around Diwali, prefer low-smoke celebrations and keep sensitive family members indoors during peak bursting hours.",
          ].map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 aria-hidden size={16} className="mt-0.5 shrink-0 text-emerald-600" />{t}</li>)}
        </ul>
      </section>

      <section aria-labelledby="src-h" className="text-sm">
        <h2 id="src-h" className="font-display text-xl">Sources for this guidance</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {HEALTH_SOURCES.map((s) => <li key={s.url}><a className="underline underline-offset-2" href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>)}
        </ul>
        <p className="mt-2 text-[color:var(--muted)]">Guidance is paraphrased and simplified for readability. Follow the original documents and your clinician for decisions about your health.</p>
      </section>
    </div>
  );
}
