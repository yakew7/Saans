"use client";

import { Bell, BellOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { categoryFor } from "@/lib/aqi/categories";
import { alertsStore, newRule, useAlertRules, type AlertRule } from "@/lib/alerts";
import { fetchJsonOrThrow } from "@/lib/hooks/useAir";
import { useMounted } from "@/lib/hooks/useMounted";
import { useAppState } from "@/lib/store";
import { pushToast } from "@/lib/toast";
import type { Place } from "@/lib/places";
import type { AirSnapshot } from "@/lib/sources/snapshot";
import { LocationSearch } from "@/components/layout/LocationSearch";

const LEVELS = [
  { v: 51, label: "Moderate (51+)" },
  { v: 101, label: "Unhealthy for sensitive groups (101+)" },
  { v: 151, label: "Unhealthy (151+)" },
  { v: 201, label: "Very unhealthy (201+)" },
  { v: 301, label: "Hazardous (301+)" },
];

function RuleRow({ rule }: { rule: AlertRule }) {
  const q = useQuery({
    queryKey: ["air", rule.lat.toFixed(2), rule.lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<AirSnapshot>(`/api/air?lat=${rule.lat.toFixed(4)}&lon=${rule.lon.toFixed(4)}`),
    staleTime: 60_000,
  });
  const p = q.data?.primary;
  const above = p?.aqi != null && p.aqi >= rule.threshold;
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--border)] p-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{rule.name}</p>
        <p className="text-sm text-[color:var(--muted)]">Alert when AQI reaches <strong className="text-[color:var(--ink)]">{rule.threshold}</strong> or more</p>
        <p className="mt-0.5 text-xs text-[color:var(--muted)]">
          {p?.aqi != null ? <>Now: <strong style={{ color: "inherit" }}>{p.aqi}</strong> ({categoryFor(p.aqi).label}) · {p.meta.source}{above ? " · above your level" : ""}</> : q.isPending ? "Checking…" : "No current reading"}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={rule.enabled} onChange={(e) => alertsStore.update({ ...rule, enabled: e.target.checked, armed: true })} />
        {rule.enabled ? <Bell size={14} aria-hidden /> : <BellOff size={14} aria-hidden />}
        {rule.enabled ? "On" : "Off"}
      </label>
      <button type="button" onClick={() => alertsStore.remove(rule.id)} aria-label={`Delete alert for ${rule.name}`} className="grid h-9 w-9 place-items-center rounded-full hover:bg-[color:var(--surface-2)]">
        <Trash2 size={16} aria-hidden />
      </button>
    </li>
  );
}

export function AlertsPage() {
  const { current } = useAppState();
  const rules = useAlertRules();
  const mounted = useMounted();
  const [place, setPlace] = useState<Place | null>(null);
  const [level, setLevel] = useState(151);
  const [, force] = useState(0);
  // derived after mount so server and client first render agree
  const perm = !mounted ? "default" : typeof Notification === "undefined" ? "unsupported" : Notification.permission;
  const target = place ?? current;

  async function askPermission() {
    if (typeof Notification === "undefined") return;
    try {
      await Notification.requestPermission();
    } catch {
      /* ignore */
    }
    force((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Smart AQI alerts</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">Get a heads-up when the air at a place crosses a level you choose.</p>
        <p role="note" className="mt-3 rounded-xl border border-amber-600/50 bg-amber-500/10 px-3 py-2 text-sm">
          <strong>Honest limitation:</strong> alerts are checked every 10 minutes <strong>only while Saans is open in a browser tab</strong>. There is no background push, so nothing is sent when the tab is closed. Your alert settings are saved on this device only.
        </p>
      </div>

      <section aria-labelledby="new-h" className="card space-y-4 p-5">
        <h2 id="new-h" className="font-display text-xl">New alert</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Place</p>
            <p className="mb-1 text-sm text-[color:var(--muted)]">{target.name}{place ? "" : " (your current location)"}</p>
            <LocationSearch onSelect={setPlace} placeholder="Choose another city…" label="Choose a place for the alert" />
          </div>
          <div>
            <label htmlFor="lvl" className="text-sm font-medium">Alert me when AQI is at least</label>
            <select id="lvl" value={level} onChange={(e) => setLevel(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-sm">
              {LEVELS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
          </div>
        </div>
        <button type="button" onClick={() => { alertsStore.add(newRule(target, level)); setPlace(null); }} className="rounded-full bg-[color:var(--ink)] px-5 py-2 text-sm font-medium text-[color:var(--bg)]">
          Add alert
        </button>
      </section>

      <section aria-labelledby="my-h" className="card p-5">
        <h2 id="my-h" className="font-display text-xl">Your alerts</h2>
        {!mounted ? null : rules.length ? (
          <ul className="mt-3 space-y-2">{rules.map((r) => <RuleRow key={r.id} rule={r} />)}</ul>
        ) : (
          <p className="mt-2 text-sm text-[color:var(--muted)]">No alerts yet. Add one above.</p>
        )}
      </section>

      <section aria-labelledby="n-h" className="card p-5">
        <h2 id="n-h" className="font-display text-xl">Browser notifications</h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          In-app toasts always work. To also get a system notification while the tab is open, allow notifications.
          {" "}Status: <strong>{perm === "granted" ? "allowed" : perm === "denied" ? "blocked in your browser settings" : perm === "unsupported" ? "not supported in this browser" : "not asked yet"}</strong>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {perm === "default" && <button type="button" onClick={askPermission} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)]">Allow notifications</button>}
          <button
            type="button"
            onClick={() => {
              pushToast({ title: "Test alert", body: "This is how an AQI alert will look while Saans is open.", tone: "info" });
              try {
                if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Saans test alert", { body: "Notifications are working." });
              } catch {
                /* ignore */
              }
            }}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-medium hover:bg-[color:var(--surface-2)]"
          >
            Send a test
          </button>
        </div>
      </section>
    </div>
  );
}
