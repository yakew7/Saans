import { z } from "zod";
import { coordSchema, parseQuery } from "@/lib/api";
import { getAnomalies } from "@/lib/sources/anomalies";

const schema = coordSchema.extend({ days: z.coerce.number().int().min(3).max(30).default(7) });

export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  return Response.json(await getAnomalies(q.data.lat, q.data.lon, q.data.days));
}
