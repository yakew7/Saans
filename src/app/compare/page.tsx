import type { Metadata } from "next";
import { ComparePage } from "@/components/compare/ComparePage";
import { parseLocs } from "@/lib/compare";
import { INDIA_METROS } from "@/lib/places";

export const metadata: Metadata = { title: "Compare locations", description: "Compare air quality across 2 to 4 places side by side with a shareable link." };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.locs) ? sp.locs[0] : sp.locs;
  const parsed = parseLocs(raw);
  const initial = parsed.length ? parsed : [INDIA_METROS[0], INDIA_METROS[1], INDIA_METROS[3]];
  return <ComparePage initial={initial} />;
}
