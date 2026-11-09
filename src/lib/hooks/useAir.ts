"use client";
import { useQuery } from "@tanstack/react-query";
import type { AirSnapshot } from "@/lib/sources/snapshot";

export const REFRESH_MS = 10 * 60_000;

export async function fetchJsonOrThrow<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = String(j.error);
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json();
}

export function useAir(lat: number, lon: number) {
  return useQuery({
    queryKey: ["air", lat.toFixed(2), lon.toFixed(2)],
    queryFn: () => fetchJsonOrThrow<AirSnapshot>(`/api/air?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`),
    refetchInterval: REFRESH_MS,
    staleTime: 60_000,
  });
}
