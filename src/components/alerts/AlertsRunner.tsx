"use client";

import { useQueries } from "@tanstack/react-query";
import { useEffect } from "react";
import { categoryFor } from "@/lib/aqi/categories";
import { alertsStore, evaluateRule, useAlertRules } from "@/lib/alerts";
import { formatObserved } from "@/lib/format";
import { fetchJsonOrThrow, REFRESH_MS } from "@/lib/hooks/useAir";
import { pushToast } from "@/lib/toast";
import type { AirSnapshot } from "@/lib/sources/snapshot";

/** Mounted once in the layout. Polls each enabled alert's location every 10 min WHILE THE APP IS OPEN and fires toasts + browser notifications. */
export function AlertsRunner() {
  const rules = useAlertRules().filter((r) => r.enabled);
  const results = useQueries({
    queries: rules.map((r) => ({
      queryKey: ["air", r.lat.toFixed(2), r.lon.toFixed(2)],
      queryFn: () => fetchJsonOrThrow<AirSnapshot>(`/api/air?lat=${r.lat.toFixed(4)}&lon=${r.lon.toFixed(4)}`),
      refetchInterval: REFRESH_MS,
      staleTime: 60_000,
    })),
  });
  const key = results.map((q) => q.dataUpdatedAt).join(",");

  useEffect(() => {
    results.forEach((q, i) => {
      const rule = rules[i];
      const p = q.data?.primary;
      if (!rule || !p || p.aqi == null || p.meta.stale) return; // never alert on missing or stale data
      const { fire, next } = evaluateRule(rule, p.aqi, Date.now());
      if (next !== rule) alertsStore.update(next);
      if (!fire) return;
      const cat = categoryFor(p.aqi);
      const title = `${rule.name}: AQI ${p.aqi} (${cat.label})`;
      const body = `Crossed your alert level of ${rule.threshold}. ${p.meta.source}${p.meta.stationName ? `, ${p.meta.stationName}` : ""}, ${formatObserved(p.meta.observedAt)}.`;
      pushToast({ title, body, tone: p.aqi >= 151 ? "alert" : "warn" });
      try {
        if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body, tag: rule.id });
      } catch {
        /* notifications unavailable */
      }
    });
    // evaluate whenever any query's data changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
