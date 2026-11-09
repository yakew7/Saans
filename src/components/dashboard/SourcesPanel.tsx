import { CheckCircle2, CircleDashed, CircleSlash, XCircle } from "lucide-react";
import type { ChainStep } from "@/lib/sources/snapshot";

const ICON = { ok: CheckCircle2, empty: CircleSlash, error: XCircle, no_key: XCircle, not_needed: CircleDashed } as const;
const TEXT = { ok: "Used", empty: "No data nearby", error: "Failed", no_key: "Not configured", not_needed: "Not needed" } as const;

/** Shows the source fallback chain for the current location: OpenAQ → WAQI → Open-Meteo (modelled). */
export function SourcesPanel({ chain }: { chain: ChainStep[] }) {
  return (
    <section aria-labelledby="src-h" className="card p-5">
      <h2 id="src-h" className="font-display text-xl">Where this reading came from</h2>
      <p className="mt-1 text-sm text-[color:var(--muted)]">Fallback order: OpenAQ station → WAQI station → Open-Meteo CAMS model (always labelled MODELLED).</p>
      <ol className="mt-3 space-y-2">
        {chain.map((c) => {
          const Icon = ICON[c.status];
          return (
            <li key={c.source} className="flex items-start gap-2 text-sm">
              <Icon size={16} aria-hidden className={`mt-0.5 shrink-0 ${c.status === "ok" ? "text-emerald-600" : c.status === "error" || c.status === "no_key" ? "text-red-600" : "text-[color:var(--muted)]"}`} />
              <div>
                <span className="font-semibold">{c.source}</span> <span className="text-[color:var(--muted)]">· {TEXT[c.status]}</span>
                {c.message && c.status !== "not_needed" && <p className="text-xs text-[color:var(--muted)]">{c.message}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
