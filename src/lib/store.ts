"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { DELHI, placeKey, type Place } from "./places";

/** Preferences persisted in localStorage only (no accounts, no server). Every access is wrapped in try/catch. */
const KEY = "saans.v1";
const PlaceZ = z.object({ name: z.string(), lat: z.number(), lon: z.number(), country: z.string().nullable().optional() });
const StateZ = z.object({
  current: PlaceZ,
  favourites: z.array(PlaceZ),
  recents: z.array(PlaceZ),
  standard: z.enum(["us", "naqi"]),
});
export type AppState = z.infer<typeof StateZ>;

const DEFAULT: AppState = { current: DELHI, favourites: [], recents: [], standard: "us" };
let state: AppState = DEFAULT;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const r = StateZ.safeParse(JSON.parse(raw));
      if (r.success) state = r.data;
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
}

function commit(next: AppState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function getSnapshot(): AppState {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    load();
  }
  return state;
}

export const store = {
  get: getSnapshot,
  setCurrent(p: Place) {
    const s = getSnapshot();
    const recents = [p, ...s.recents.filter((r) => placeKey(r) !== placeKey(p))].slice(0, 6);
    commit({ ...s, current: p, recents });
  },
  toggleFavourite(p: Place) {
    const s = getSnapshot();
    const has = s.favourites.some((f) => placeKey(f) === placeKey(p));
    commit({ ...s, favourites: has ? s.favourites.filter((f) => placeKey(f) !== placeKey(p)) : [...s.favourites, p].slice(0, 12) });
  },
  setStandard(standard: "us" | "naqi") {
    commit({ ...getSnapshot(), standard });
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getSnapshot,
    () => DEFAULT,
  );
}
