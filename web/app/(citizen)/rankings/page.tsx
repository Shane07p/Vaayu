import { fetchCityRankings } from "@/lib/api";
import type { CityRankings } from "@/lib/schemas";
import { RankingsView } from "@/components/citizen/rankings-view";

export const dynamic = "force-dynamic";

function bandColor(aqi: number): string {
  if (aqi <= 50) return "#34d399";
  if (aqi <= 100) return "#fbbf24";
  if (aqi <= 200) return "#fb923c";
  if (aqi <= 300) return "#f472b6";
  if (aqi <= 400) return "#c084fc";
  return "#f87171";
}

function bandName(aqi: number): string {
  if (aqi <= 50) return "Good";
  if (aqi <= 100) return "Satisfactory";
  if (aqi <= 200) return "Moderate";
  if (aqi <= 300) return "Poor";
  if (aqi <= 400) return "Very Poor";
  return "Severe";
}

function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

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
