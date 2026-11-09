"use client";
import { useSyncExternalStore } from "react";

export interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "info" | "warn" | "alert";
}

let toasts: Toast[] = [];
let seq = 1;
const EMPTY: Toast[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function pushToast(t: Omit<Toast, "id">, ttlMs = 12_000) {
  const id = seq++;
  toasts = [...toasts, { ...t, id }].slice(-4);
  emit();
  setTimeout(() => dismissToast(id), ttlMs);
}

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => EMPTY,
  );
}
