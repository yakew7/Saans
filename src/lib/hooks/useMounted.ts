"use client";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export function useMounted(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
