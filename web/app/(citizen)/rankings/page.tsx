import Link from "next/link";
import { fetchCityRankings } from "@/lib/api";
import type { CityRankings } from "@/lib/schemas";

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
    // Rendered as unavailable below. An empty list would read as "no city in
    // India has bad air", which is a claim rather than a failure.
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 mb-1">
          Worst air right now
        </h1>
        <p className="text-sm text-slate-400">
          Indian cities ranked by their most polluted reporting station. Each
          figure is a measurement from a named station, with the time it was
          taken.
        </p>
      </div>

      {!rankings ? (
        <div className="rounded-2xl border border-amber-800/60 bg-amber-950/30 p-5 text-sm text-slate-300">
          <div className="font-mono text-amber-300 text-xs font-semibold mb-1">
            RANKINGS UNAVAILABLE
          </div>
          The station read service did not respond. VAAYU will not show a
          ranking it could not compute.
        </div>
      ) : rankings.cities.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-slate-400">
          No city has a reading recent enough to rank. This means the ingestion
          job has not run, not that the air is clean.
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {rankings.cities.map((city, index) => (
              <li key={city.city}>
                {/* Opens the map at the station the figure came from, not at a
                    notional city centre: the reading belongs to that point. */}
                <Link
                  href={`/aqi?lat=${city.lat}&lon=${city.lon}&name=${encodeURIComponent(city.city)}`}
                  className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] hover:border-white/20 transition-colors"
                >
                <span className="w-6 text-right font-mono text-xs text-slate-500">
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm font-semibold text-slate-100 truncate">
                    {city.city}
                  </div>
                  {/* Named, so the city is not characterised by a number whose
                      origin the reader cannot see. */}
                  <div className="text-[11px] text-slate-500 truncate">
                    {city.worstStation}
                  </div>
                  <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                    {city.stationCount === 1
                      ? "1 station"
                      : `worst of ${city.stationCount} stations`}
                    {" · "}
                    {ago(city.measuredAt)}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div
                    className="font-mono text-2xl font-black leading-none"
                    style={{ color: bandColor(city.aqi) }}
                  >
                    {city.aqi}
                  </div>
                  <div
                    className="text-[10px] font-mono"
                    style={{ color: bandColor(city.aqi) }}
                  >
                    {bandName(city.aqi)}
                  </div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {city.pm25} µg/m³
                  </div>
                </div>
                </Link>
              </li>
            ))}
          </ol>

          {/*
            The excluded count is the difference between a ranking and a claim
            about the country. A "worst air today" list that silently omits the
            cities it could not measure implies they were checked and found
            cleaner.
          */}
          <p className="text-[11px] font-mono text-slate-500 border-t border-white/10 pt-3">
            Ranked from stations reporting within the last 6 hours, by each
            city&apos;s worst station.
            {rankings.excluded > 0 && (
              <>
                {" "}
                {rankings.excluded}{" "}
                {rankings.excluded === 1 ? "city is" : "cities are"} not ranked
                because no station there has reported recently — not because the
                air is clean.
              </>
            )}
            {rankings.unattributedStations > 0 && (
              <>
                {" "}
                {rankings.unattributedStations} reporting{" "}
                {rankings.unattributedStations === 1 ? "station is" : "stations are"}{" "}
                not shown because their names carry no city to group them under.
              </>
            )}
          </p>
        </>
      )}
    </div>
  );
}
