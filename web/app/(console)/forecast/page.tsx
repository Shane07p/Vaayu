import { ForecastComparison } from "@/components/forecast-comparison";
import { SourceBadge } from "@/components/source-badge";
import { fetchForecast, fetchStations } from "@/lib/api";
import type { Forecast, Station } from "@/lib/schemas";

export default async function ForecastPage() {
  let station: Station | undefined;
  let forecasts: Forecast[] = [];
  try {
    station = (await fetchStations())[0];
    forecasts = station ? await fetchForecast(station.id) : [];
  } catch {
    station = undefined;
  }

  return (
    <main className="mx-auto max-w-5xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">Forecast</h1>
      <p className="text-sm text-slate-600">Shown against persistence and CAMS baselines.</p>
      {station && forecasts.length ? (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{station.name}</h2>
            <SourceBadge source={forecasts[0].source} />
          </div>
          <ForecastComparison forecasts={forecasts} />
          <div className="grid gap-3 sm:grid-cols-3">
            {forecasts.map((forecast) => (
              <div key={forecast.id} className="rounded border bg-white p-4">
                <p className="text-sm text-slate-600">{forecast.horizonHours} hour forecast</p>
                <p className="mt-1 text-2xl font-semibold">AQI {forecast.aqi}</p>
                <p className="mt-1 text-sm">
                  Interval {Math.round(forecast.ciLow)}–{Math.round(forecast.ciHigh)} µg/m³
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          No forecast is available for the selected station.
        </p>
      )}
    </main>
  );
}
