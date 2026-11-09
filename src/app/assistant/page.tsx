import type { Metadata } from "next";
import { AssistantPage } from "@/components/assistant/AssistantPage";

export const metadata: Metadata = { title: "Ask Saans", description: "A streaming air quality assistant that only answers from live data, with a clearly labelled rule-based fallback." };

export default function Page() {
  return <AssistantPage />;
}
