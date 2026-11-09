"use client";
import { useSyncExternalStore } from "react";

let current = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((l) => l());
    }, 30_000);
  }
  return () => {
    listeners.delete(cb);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Current time in ms, null on the server / first paint (avoids hydration mismatch). Ticks every 30 s. */
export function useNow(): number | null {
  return useSyncExternalStore(
    subscribe,
    () => current || (current = Date.now()),
    () => null,
  );
}
