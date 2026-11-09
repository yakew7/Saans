import { z } from "zod";
import { coordSchema, parseQuery } from "@/lib/api";
import { getInsight } from "@/lib/llm/insights";
import { clientIp, rateLimit } from "@/lib/llm/guard";

export const maxDuration = 60;

const schema = coordSchema.extend({ name: z.string().trim().max(80).default("this location") });

export async function GET(req: Request) {
  const rl = rateLimit(clientIp(req));
  if (!rl.ok) return Response.json({ error: "Too many requests", retryAfterSec: rl.retryAfterSec }, { status: 429, headers: { "retry-after": String(rl.retryAfterSec) } });
  const q = parseQuery(req, schema);
  if ("response" in q) return q.response;
  return Response.json(await getInsight(q.data.lat, q.data.lon, q.data.name));
}
