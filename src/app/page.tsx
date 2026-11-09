import { Dashboard } from "@/components/dashboard/Dashboard";
import { z } from "zod";

const q = z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180), name: z.string().max(80).optional() });

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const flat = Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
  const r = q.safeParse(flat);
  const initial = r.success ? { name: r.data.name ?? "Selected place", lat: r.data.lat, lon: r.data.lon } : null;
  return <Dashboard initial={initial} />;
}
