import { coordSchema, parseQuery } from "@/lib/api";
import { getMlPrediction } from "@/lib/ml/pipeline";

export const maxDuration = 60;

export async function GET(req: Request) {
  const q = parseQuery(req, coordSchema);
  if ("response" in q) return q.response;
  return Response.json(await getMlPrediction(q.data.lat, q.data.lon));
}
