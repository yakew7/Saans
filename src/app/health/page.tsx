import type { Metadata } from "next";
import { HealthPage } from "@/components/health/HealthPage";

export const metadata: Metadata = { title: "Health & safety", description: "What the current air quality means for you: activity guidance, sensitive groups, best time to go out and AQI categories explained." };

export default function Page() {
  return <HealthPage />;
}
