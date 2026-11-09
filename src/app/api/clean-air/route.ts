import { z } from "zod";
import { coordSchema, parseQuery } from "@/lib/api";
import { getCleanAir } from "@/lib/sources/cleanair";

const schema = coordSchema.extend({ radius: z.coerce.number().int().min(5).max(100).default(25) });

export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const r = await getCleanAir(q.data.lat, q.data.lon, q.data.radius);
  return Response.json(r, { status: r.code === "no_key" ? 503 : r.error ? 502 : 200 });
}
