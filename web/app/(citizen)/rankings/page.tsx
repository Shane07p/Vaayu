import { fetchCityRankings } from "@/lib/api";
import type { CityRankings } from "@/lib/schemas";
import { RankingsView } from "@/components/citizen/rankings-view";

export const dynamic = "force-dynamic";

export default async function RankingsPage() {
  let rankings: CityRankings | null = null;
  try {
    rankings = await fetchCityRankings(20);
  } catch {
    // Rendered as unavailable by the view. An empty list would read as "no city
    // in India has bad air", which is a claim rather than a failure.
  }

  return <RankingsView rankings={rankings} />;
}
