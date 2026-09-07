import { MapShell } from "@/components/map-shell";
import { ProvenanceStrip } from "@/components/provenance-strip";
import { fetchGrid, fetchStationReadings, fetchWorklist } from "@/lib/api";
import type { GridPrediction, StationReading, WorklistItem } from "@/lib/schemas";

// Delhi-NCR pilot extent: min lon, min lat, max lon, max lat.
const NCR_BBOX = "76.80,28.20,77.60,28.90";

export default async function MapPage() {
  let grid: GridPrediction[] = [];
  let stations: StationReading[] = [];
  let worklist: WorklistItem[] = [];
  let loadError = false;
  try {
    [grid, stations, worklist] = await Promise.all([
      fetchGrid(NCR_BBOX),
      fetchStationReadings(),
      fetchWorklist(),
    ]);
  } catch {
    loadError = true;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Map
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-teal-950/50 text-teal-300 border border-teal-800/60">
              Estimated map
            </span>
          </div>
          <p className="text-sm text-slate-400 font-sans">
            Delhi-NCR monitoring stations and ranked fire clusters.
            Amber halos indicate low satellite coverage — read with more uncertainty.
          </p>
        </div>
      </div>

      {/* Status Strip */}
      <ProvenanceStrip />

      {/* Map or Error */}
      {grid.length ? (
        <MapShell grid={grid} stations={stations} worklist={worklist} />
      ) : (
        <div className="rounded-xl border border-amber-800/60 bg-amber-950/30 p-6 space-y-2">
          <div className="flex items-center gap-2 text-amber-300 font-mono text-sm font-semibold">
            <span>⚠</span>
            <span>SOURCE UNAVAILABLE</span>
          </div>
          <p className="text-sm text-slate-300">
            {loadError
              ? "The map estimation service did not return a valid response. VAAYU will not fill the map with stale observations."
              : "No current map estimate is available. The service will not substitute synthetic data."}
          </p>
          <p className="text-xs text-slate-500 font-mono">
            Retry when the upstream data pipeline completes its next operational cycle.
          </p>
        </div>
      )}
    </div>
  );
}
