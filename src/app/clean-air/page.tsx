import type { Metadata } from "next";
import { CleanAirPage } from "@/components/explore/CleanAirPage";

export const metadata: Metadata = { title: "Clean air finder", description: "Find the cleanest measured air quality stations within a chosen radius, with distance, direction and a route link." };

export default function Page() {
  return <CleanAirPage />;
}
