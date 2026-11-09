import type { Metadata } from "next";
import { HistoryPage } from "@/components/history/HistoryPage";

export const metadata: Metadata = { title: "Pollution history", description: "Compare two periods of daily AQI, PM2.5 and PM10 with spike detection and clear data provenance." };

export default function Page() {
  return <HistoryPage />;
}
