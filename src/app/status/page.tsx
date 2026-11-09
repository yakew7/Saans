import type { Metadata } from "next";
import { StatusPage } from "@/components/status/StatusPage";

export const metadata: Metadata = { title: "System status", description: "Live health, latency and rate-limit headroom of every upstream data provider." };

export default function Page() {
  return <StatusPage />;
}
