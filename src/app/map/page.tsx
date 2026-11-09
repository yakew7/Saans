import type { Metadata } from "next";
import { MapPage } from "@/components/map/MapPage";

export const metadata: Metadata = { title: "Air quality map", description: "Real monitoring stations coloured by AQI, with hotspots ranked for the current view." };

export default function Page() {
  return <MapPage />;
}
