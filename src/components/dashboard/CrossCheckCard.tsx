import { TriangleAlert, CheckCircle2 } from "lucide-react";
import { categoryFor } from "@/lib/aqi/categories";
import type { AirSnapshot } from "@/lib/sources/snapshot";
import { DataBadge } from "@/components/ui/DataBadge";

export function CrossCheckCard({ snap }: { snap: AirSnapshot }) {
  const x = snap.crossCheck;
  const o = snap.alternatives.find((a) => a.key === "openaq");
  const w = snap.alternatives.find((a) => a.key === "waqi");
  if (!x || !o || !w) return null;
  return (
    <section aria-labelledby="xc-h" className="card p-5">
      <h2 id="xc-h" className="font-display text-xl">Cross-check: two measured sources</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Two independent networks cover this place. They are usually different stations, so small gaps are normal. We flag differences above 25%.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[o, w].map((p) => {
          const cat = categoryFor(p.aqi ?? 0);
          return (
            <div key={p.key} className="rounded-xl border border-[color:var(--border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--muted)]">{p.meta.source}</p>
              <p className="numeral mt-1 text-5xl font-semibold">{p.aqi ?? "—"}</p>
              <p className="mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: cat.color, color: cat.ink }}>{cat.label}</p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                {p.meta.stationName} · {p.meta.stationDistanceKm} km
              </p>
              <div className="mt-2">
                <DataBadge kind={p.aqiBadge} source={p.meta.source} observedAt={p.meta.observedAt} fetchedAt={p.meta.fetchedAt} stale={p.meta.stale} cached={p.meta.cached} detail={p.aqiDetail} />
              </div>
            </div>
          );
        })}
      </div>
      <p className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${x.disagree ? "bg-amber-500/15" : "bg-emerald-500/10"}`} role="status">
        {x.disagree ? <TriangleAlert size={16} aria-hidden className="mt-0.5 shrink-0" /> : <CheckCircle2 size={16} aria-hidden className="mt-0.5 shrink-0" />}
        <span>
          {x.disagree ? (
            <>
              <strong>Sources disagree by {x.diffPct}%.</strong> Different stations, averaging methods (OpenAQ is a computed NowCast of raw PM; WAQI publishes its own AQI) and reporting times can explain this. Treat the headline as indicative.
            </>
          ) : (
            <>
              <strong>Sources agree within {Math.max(x.diffPct, 0.1)}%.</strong> That raises confidence in the reading.
            </>
          )}
        </span>
      </p>
    </section>
  );
}
