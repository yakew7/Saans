import { coordSchema, parseQuery } from "@/lib/api";
import { getForecast } from "@/lib/sources/forecast";

export async function GET(req: Request) {
  const q = parseQuery(req, coordSchema);
  if ("response" in q) return q.response;
  return Response.json(await getForecast(q.data.lat, q.data.lon));
}
