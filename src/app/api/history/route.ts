import { z } from "zod";
import { coordSchema, dateSchema, parseQuery } from "@/lib/api";
import { daysBetween } from "@/lib/history";
import { getHistory } from "@/lib/sources/history";

const schema = coordSchema
  .extend({
    aStart: dateSchema,
    aEnd: dateSchema,
    bStart: dateSchema,
    bEnd: dateSchema,
    mode: z.enum(["auto", "measured", "modelled"]).default("auto"),
  })
  .refine((v) => v.aStart <= v.aEnd && v.bStart <= v.bEnd, "end date must not be before start date")
  .refine((v) => v.aStart >= "2022-01-01" && v.bStart >= "2022-01-01", "history is available from 2022-01-01")
  .refine((v) => daysBetween(v.aStart, v.aEnd) <= 120 && daysBetween(v.bStart, v.bEnd) <= 120, "each period may span at most 120 days")
  .refine((v) => daysBetween([v.aStart, v.bStart].sort()[0], [v.aEnd, v.bEnd].sort().at(-1)!) <= 400, "total span may not exceed 400 days");

export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  return Response.json(await getHistory(q.data));
}
