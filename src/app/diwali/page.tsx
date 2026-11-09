import type { Metadata } from "next";
import { DiwaliPage } from "@/components/diwali/DiwaliPage";

export const metadata: Metadata = { title: "Diwali air check", description: "How did air quality around Diwali 2026 compare with the week before? Measured and modelled data side by side, with an honest caveat." };

export default function Page() {
  return <DiwaliPage />;
}
