import { ForecastComparison } from "@/components/forecast-comparison";
import { SourceBadge } from "@/components/source-badge";
import { ProvenanceStrip } from "@/components/provenance-strip";
import { fetchForecast, fetchForecastStations } from "@/lib/api";
import type { Forecast, Station } from "@/lib/schemas";

export default async function ForecastPage() {
  let station: Station | undefined;
  let forecasts: Forecast[] = [];
  try {
    // Only a station that has a forecast can answer for one.
    station = (await fetchForecastStations())[0];
    forecasts = station ? await fetchForecast(station.id) : [];
  } catch {
    station = undefined;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-bold tracking-tight text-slate-100">
            Forecast Intelligence
          </h1>
          {station && forecasts.length > 0 && (
            <SourceBadge source={forecasts[0].source} />
          )}
        </div>
        <p className="text-sm text-slate-400">
          Compare VAAYU predictions against persistence and CAMS baselines.
          Confidence intervals expose model uncertainty.
        </p>
      </div>

      {/* Status Strip */}
      <ProvenanceStrip />

      {station && forecasts.length ? (
        <div className="space-y-6">
          {/* Station Context */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-900/60 border border-slate-800">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
                Forecast Station
              </div>
              <div className="text-sm font-semibold text-slate-200">{station.name}</div>
              <div className="text-xs text-slate-400">
                {station.city} · {station.source}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 mb-0.5">
                Model
              </div>
              <div className="text-xs font-mono text-teal-400 font-semibold">
                {forecasts[0].modelVersion}
              </div>
            </div>
          </div>

          {/* Forecast Comparison */}
          <ForecastComparison forecasts={forecasts} />

          {/* Why This Matters */}
          <div className="p-5 rounded-xl bg-teal-950/20 border border-teal-800/40 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-teal-400 font-mono text-xs font-bold uppercase tracking-wider">
                Why This Matters
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              VAAYU is designed to detect future exceedance before it becomes a
              present-day observation. Persistence assumes tomorrow looks like today.
              CAMS is a global reanalysis model. VAAYU&apos;s local model aims to beat
              both by incorporating hyper-local satellite, meteorological, and fire data.
            </p>
            <p className="text-xs text-slate-500 font-mono">
              Validation uses leave-one-station-out cross-validation — stricter than
              random-split scores typically reported.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-6 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-sm font-semibold">
            <span>⚠</span>
            <span>NO FORECAST AVAILABLE</span>
          </div>
          <p className="text-sm text-slate-300">
            No forecast is available for the selected station. The forecasting service
            did not return a valid response.
          </p>
        </div>
      )}
    </div>
  );
}
