"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";

/**
 * Smart AQI alerts. Rules live in localStorage only. They are evaluated in the browser while Saans is OPEN
 * (there is no background push), using the same /api/air data as the dashboard.
 */
const KEY = "saans.alerts.v1";
const RuleZ = z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lon: z.number(),
  threshold: z.number().min(1).max(500),
  enabled: z.boolean(),
  /** true when the next crossing of the threshold should fire */
  armed: z.boolean(),
  lastFiredAt: z.number().nullable(),
});
export type AlertRule = z.infer<typeof RuleZ>;

export const HYSTERESIS = 5;
export const REMINDER_MS = 6 * 3_600_000;

/** Pure rule evaluation. Fires on an upward crossing; re-arms once AQI drops HYSTERESIS below the threshold; reminds after 6 h if still above. */
export function evaluateRule(rule: AlertRule, aqi: number, now: number): { fire: boolean; next: AlertRule } {
  if (!rule.enabled) return { fire: false, next: rule };
  if (aqi >= rule.threshold) {
    if (rule.armed) return { fire: true, next: { ...rule, armed: false, lastFiredAt: now } };
    if (rule.lastFiredAt != null && now - rule.lastFiredAt >= REMINDER_MS) return { fire: true, next: { ...rule, lastFiredAt: now } };
    return { fire: false, next: rule };
  }
  if (aqi <= rule.threshold - HYSTERESIS && !rule.armed) return { fire: false, next: { ...rule, armed: true } };
  return { fire: false, next: rule };
}

export const newRule = (p: { name: string; lat: number; lon: number }, threshold: number): AlertRule => ({
  id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
  name: p.name,
  lat: p.lat,
  lon: p.lon,
  threshold,
  enabled: true,
  armed: true,
  lastFiredAt: null,
});

let rules: AlertRule[] = [];
let loaded = false;
const EMPTY: AlertRule[] = [];
const listeners = new Set<() => void>();

function snapshot(): AlertRule[] {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try {
      const raw = localStorage.getItem(KEY);
      const r = raw ? z.array(RuleZ).safeParse(JSON.parse(raw)) : null;
      if (r?.success) rules = r.data;
    } catch {
      /* storage unavailable */
    }
  }
  return rules;
}

function commit(next: AlertRule[]) {
  rules = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export const alertsStore = {
  get: snapshot,
  add: (r: AlertRule) => commit([...snapshot(), r].slice(0, 10)),
  update: (r: AlertRule) => commit(snapshot().map((x) => (x.id === r.id ? r : x))),
  remove: (id: string) => commit(snapshot().filter((x) => x.id !== id)),
};

export function useAlertRules(): AlertRule[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    snapshot,
    () => EMPTY,
  );
}
