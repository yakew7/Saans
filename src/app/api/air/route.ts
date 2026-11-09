import { coordSchema, parseQuery } from "@/lib/api";
import { getAirSnapshot } from "@/lib/sources/snapshot";

export async function GET(req: Request) {
  const q = parseQuery(req, coordSchema);
  if ("response" in q) return q.response;
  const snapshot = await getAirSnapshot(q.data.lat, q.data.lon);
  return Response.json(snapshot);
}
