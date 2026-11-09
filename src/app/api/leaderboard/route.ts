import { getLeaderboard } from "@/lib/sources/leaderboard";

export async function GET() {
  return Response.json(await getLeaderboard());
}
