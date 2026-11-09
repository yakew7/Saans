import type { Metadata } from "next";
import { z } from "zod";
import { Dashboard } from "@/components/dashboard/Dashboard";

const q = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), name: z.string().max(80).optional() });
type SP = Promise<Record<string, string | string[] | undefined>>;

async function parse(searchParams: SP) {
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const r = q.safeParse(flat);
  return r.success ? { name: r.data.name ?? "Selected place", lat: r.data.lat, lon: r.data.lon } : null;
}

/** Per-location Open Graph image: a shared dashboard link previews that place's live AQI card. */
export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const p = await parse(searchParams);
  const place = p ?? { name: "Delhi", lat: 28.6139, lon: 77.209 };
  const image = `/api/card?lat=${place.lat.toFixed(4)}&lon=${place.lon.toFixed(4)}&name=${encodeURIComponent(place.name)}`;
  const title = p ? `Air quality in ${p.name} right now` : "Saans: real-time air quality you can act on";
  return {
    title: p ? { absolute: `${title} · Saans` } : undefined,
    openGraph: { title, description: "Live AQI with honest provenance: measured, modelled or forecast, always labelled.", images: [{ url: image, width: 1200, height: 630, alt: `Air quality card for ${place.name}` }] },
    twitter: { card: "summary_large_image", title, images: [image] },
  };
}

export default async function Home({ searchParams }: { searchParams: SP }) {
  return <Dashboard initial={await parse(searchParams)} />;
}
