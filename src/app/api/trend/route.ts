import { z } from "zod";
import { coordSchema, parseQuery } from "@/lib/api";
import { addDays } from "@/lib/history";
import { getDailySeries } from "@/lib/sources/history";

const schema = coordSchema.extend({
  days: z.coerce.number().int().min(7).max(90).default(30),
  mode: z.enum(["auto", "measured", "modelled"]).default("auto"),
});

/** Daily AQI / PM series for the last N full days (ending yesterday) from one source. */
export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const { lat, lon, days, mode } = q.data;
  const end = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const start = addDays(end, -(days - 1));
  const s = await getDailySeries(lat, lon, start, end, mode, start, 3);
  return Response.json({ source: s.source, badge: s.badge, meta: s.meta, days: s.days.filter((d) => d.date >= start && d.date <= end), banners: s.banners });
}
