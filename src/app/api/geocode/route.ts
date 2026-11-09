import { z } from "zod";
import { parseQuery } from "@/lib/api";
import { geocode } from "@/lib/sources/openmeteo";

const schema = z.object({ q: z.string().trim().min(2).max(80) });

export async function GET(req: Request) {
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  const r = await geocode(q.data.q);
  if (!r.ok) return Response.json({ error: r.error, places: [] }, { status: 502 });
  return Response.json({ places: r.data });
}
