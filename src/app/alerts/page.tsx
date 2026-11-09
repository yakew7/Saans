import type { Metadata } from "next";
import { AlertsPage } from "@/components/alerts/AlertsPage";

export const metadata: Metadata = { title: "Smart AQI alerts", description: "Set AQI thresholds per place and get in-app and browser alerts while Saans is open." };

export default function Page() {
  return <AlertsPage />;
}
