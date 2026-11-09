"use client";
import { useQuery } from "@tanstack/react-query";
import type { Meta } from "@/lib/types";
import type { WaqiFeed, WaqiStationPoint } from "@/lib/sources/waqi";
import { fetchJsonOrThrow } from "./useAir";

export interface Bounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function useStations(b: Bounds | null) {
  return useQuery({
    queryKey: ["stations", b && [b.south, b.west, b.north, b.east].map((n) => n.toFixed(2))],
    enabled: !!b,
    queryFn: () => fetchJsonOrThrow<{ stations: WaqiStationPoint[]; meta: Meta }>(`/api/stations?south=${b!.south}&west=${b!.west}&north=${b!.north}&east=${b!.east}`),
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}

export function useStation(uid: number | null) {
  return useQuery({
    queryKey: ["station", uid],
    enabled: uid != null,
    queryFn: () => fetchJsonOrThrow<{ station: WaqiFeed; meta: Meta }>(`/api/station/${uid}`),
    staleTime: 2 * 60_000,
  });
}
