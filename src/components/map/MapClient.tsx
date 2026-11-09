"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/States";
import type { MapViewProps } from "./MapView";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <Skeleton className="h-[62vh] min-h-[360px] w-full lg:h-[calc(100dvh-14rem)]" />,
});

export function MapClient(props: MapViewProps) {
  return <MapView {...props} />;
}
