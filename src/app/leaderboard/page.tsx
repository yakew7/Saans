import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/explore/LeaderboardPage";

export const metadata: Metadata = { title: "City leaderboard", description: "Major cities ranked by live measured AQI, with modelled estimates kept separate." };

export default function Page() {
  return <LeaderboardPage />;
}
