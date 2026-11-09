import { BADGE_INFO } from "./badge-info";
import type { BadgeKind } from "@/lib/types";

const ORDER: BadgeKind[] = ["MEASURED", "HISTORICAL-MEASURED", "FORECAST", "MODELLED", "COMPUTED", "EXPERIMENTAL-ML"];

/** Persistent legend explaining every provenance badge. Static, server-renderable. */
export function ProvenanceLegend() {
  return (
    <section aria-labelledby="legend-h" className="card p-4">
      <h2 id="legend-h" className="font-display text-lg">How to read the badges</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">
        Every number in Saans says where it came from. We never show modelled or predicted values as if they were measured.
      </p>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ORDER.map((k) => {
          const i = BADGE_INFO[k];
          return (
            <div key={k} className="flex items-start gap-2 text-sm">
              <dt>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide leading-none ${i.cls}`}>
                  {i.icon}
                  {i.label}
                </span>
              </dt>
              <dd className="text-[color:var(--muted)]">{i.meaning}</dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
