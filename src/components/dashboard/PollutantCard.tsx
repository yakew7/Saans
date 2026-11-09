"use client";

import { whoComparison, whoLabel } from "@/lib/aqi/entry";
import { WHO_SOURCE_URL } from "@/lib/aqi/who";
import { fmtNum } from "@/lib/format";
import { POLLUTANT_INFO, unitLabel } from "@/lib/pollutants";
import type { PollutantEntry, Primary } from "@/lib/sources/snapshot";
import { DataBadge } from "@/components/ui/DataBadge";

export function PollutantCard({ entry, primary }: { entry: PollutantEntry; primary: Primary }) {
  const info = POLLUTANT_INFO[entry.id];
  const missing = entry.value == null;
  const who = whoComparison(entry);
  const isSub = entry.basis === "subindex";
  const pct = who ? Math.min(100, (who.ratio / 3) * 100) : 0;
  return (
    <article className="card flex flex-col p-4" aria-label={`${info.symbol} ${info.name}`}>
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-xl">{info.symbol}</h3>
        <span className="text-xs text-[color:var(--muted)]">{info.name}</span>
      </header>

      {missing ? (
        <div className="mt-3">
          <p className="numeral text-4xl font-semibold text-[color:var(--muted)]" aria-label="No data">—</p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">Not reported by this {primary.key === "open-meteo" ? "model" : "station"}.</p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="numeral text-4xl font-semibold">
            {fmtNum(entry.value, entry.value! < 10 ? 1 : 0)}
            <span className="ml-1.5 font-sans text-sm font-normal text-[color:var(--muted)]">{isSub ? "sub-index" : unitLabel(entry.unit)}</span>
          </p>
          {isSub && <p className="mt-1 text-xs text-[color:var(--muted)]">Per-pollutant AQI sub-index (not a concentration).</p>}
          {entry.avg24 != null && (
            <p className="mt-1 text-xs">
              <span className="text-[color:var(--muted)]">24 h mean: </span>
              <strong>{fmtNum(entry.avg24, 1)} µg/m³</strong>
            </p>
          )}
        </div>
      )}

      <div className="mt-3 min-h-10 text-xs">
        {who ? (
          <>
            <div className="relative h-2 rounded-full bg-[color:var(--surface-2)]" role="img" aria-label={`${who.ratio.toFixed(1)} times the WHO guideline`}>
              <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: who.ratio > 1 ? "var(--aqi-unhealthy)" : "var(--aqi-good)" }} />
              <div aria-hidden className="absolute -top-1 h-4 w-0.5 bg-[color:var(--ink)]" style={{ left: `${(1 / 3) * 100}%` }} />
            </div>
            <p className="mt-1.5">
              <strong>{who.ratio.toFixed(who.ratio < 10 ? 1 : 0)}×</strong> the{" "}
              <a href={WHO_SOURCE_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                WHO 2021
              </a>{" "}
              guideline ({whoLabel(entry.id)}) · {who.basis}
            </p>
          </>
        ) : (
          <p className="text-[color:var(--muted)]">{isSub ? "WHO comparison needs a concentration, which this source does not provide." : missing ? "" : "WHO comparison unavailable (unit unclear)."}</p>
        )}
      </div>

      <footer className="mt-auto pt-3">
        <DataBadge compact kind={primary.valueBadge} source={primary.meta.source} observedAt={entry.observedAt ?? primary.meta.observedAt} fetchedAt={primary.meta.fetchedAt} cached={primary.meta.cached} />
      </footer>
    </article>
  );
}
