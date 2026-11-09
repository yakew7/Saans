import type { Metadata } from "next";
import { PredictionPage } from "@/components/prediction/PredictionPage";

export const metadata: Metadata = { title: "Experimental ML prediction", description: "An experimental 48-hour PM2.5 prediction with walk-forward backtest against persistence and the CAMS model." };

export default function Page() {
  return <PredictionPage />;
}
