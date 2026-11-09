import { z } from "zod";
import { coordSchema, dateSchema, parseQuery } from "@/lib/api";
import { daysBetween } from "@/lib/history";
import { buildReport } from "@/lib/report";
import { getDailySeries } from "@/lib/sources/history";
import { addDays } from "@/lib/history";

const schema = coordSchema
  .extend({ start: dateSchema, end: dateSchema, mode: z.enum(["auto", "measured", "modelled"]).default("auto") })
  .refine((v) => v.start <= v.end, "end date must not be before start date")
  .refine((v) => v.start >= "2022-01-01", "reports are available from 2022-01-01")
  .refine((v) => daysBetween(v.start, v.end) <= 120, "a report may span at most 120 days");

/** Pollution Impact Report data: one source for the whole period, with automated statistics. */
export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const { lat, lon, start, end, mode } = q.data;
  const s = await getDailySeries(lat, lon, addDays(start, -7), end, mode, start, 3);
  const stats = s.source ? buildReport(s.days, start, end) : null;
  return Response.json({ source: s.source, badge: s.badge, meta: s.meta, stats, banners: s.banners });
}
