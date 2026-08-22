import { CitizenHero } from "@/components/citizen/citizen-hero";
import { CitizenGuidance } from "@/components/citizen/citizen-guidance";
import { CitizenForecast } from "@/components/citizen/citizen-forecast";
import { TrustGrid } from "@/components/citizen/trust-grid";
import { fetchForecast, fetchGrid, fetchStations } from "@/lib/api";
import type { Forecast, GridPrediction } from "@/lib/schemas";

function getAqiFromPm25(pm25: number): number {
  if (pm25 <= 30) return Math.round((pm25 / 30) * 50);
  if (pm25 <= 60) return Math.round(50 + ((pm25 - 30) / 30) * 50);
  if (pm25 <= 90) return Math.round(100 + ((pm25 - 60) / 30) * 100);
  if (pm25 <= 120) return Math.round(200 + ((pm25 - 90) / 30) * 100);
  if (pm25 <= 250) return Math.round(300 + ((pm25 - 120) / 130) * 100);
  return Math.min(500, Math.round(400 + ((pm25 - 250) / 150) * 100));
}

export default async function AqiPage() {
  let estimate: GridPrediction | undefined;
  let forecasts: Forecast[] = [];

  try {
    const [gridList, stations] = await Promise.all([
      fetchGrid("76.80,28.20,77.60,28.90"),
      fetchStations(),
    ]);
    estimate = gridList[0];
    if (stations && stations[0]) {
      forecasts = await fetchForecast(stations[0].id);
    }
  } catch {
    estimate = undefined;
    forecasts = [];
  }

  const pm25 = estimate ? Math.round(estimate.pm25Q50) : 182;
  const currentAqi = getAqiFromPm25(pm25);

  return (
    <div className="space-y-8 pb-8">
      {/* 1. Hero Presentation: Location, Large AQI, Uncertainty, Segmented Scale, Weather */}
      <CitizenHero initialEstimate={estimate} />

      {/* 2. What This Means & Actionable Guidance */}
      <CitizenGuidance aqi={currentAqi} />

      {/* 3. Predictive Intelligence: 6h/24h/72h Forecast Area Chart & Trajectory */}
      <CitizenForecast currentAqi={currentAqi} forecasts={forecasts} />

      {/* 4. Trust & Scientific Foundation: 1 km Grid, Multi-source, 72h Forecast, Citizen CTA */}
      <TrustGrid />
    </div>
  );
}
