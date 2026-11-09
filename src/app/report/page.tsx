import type { Metadata } from "next";
import { ReportPage } from "@/components/report/ReportPage";

export const metadata: Metadata = { title: "Pollution impact report", description: "An automated, printable pollution report for any place and period, with WHO exceedance days, spikes and trend." };

export default function Page() {
  return <ReportPage />;
}
