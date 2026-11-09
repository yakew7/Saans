import type { Metadata } from "next";
import { ForecastPage } from "@/components/forecast/ForecastPage";

export const metadata: Metadata = { title: "AQI forecast", description: "Hourly air quality forecast for the next 24 to 120 hours with expected trend, predicted spikes and best time to go out." };

export default function Page() {
  return <ForecastPage />;
}
