import { MapShell } from "@/components/map-shell";
import { fetchGrid, fetchStations, fetchWorklist } from "@/lib/api";
import type { GridPrediction, Station, WorklistItem } from "@/lib/schemas";

// Delhi-NCR pilot extent: min lon, min lat, max lon, max lat.
// Matches NCR_BBOX in ml/src/vaayu_ml/build_grid.py.
const NCR_BBOX = "76.80,28.20,77.60,28.90";

export default async function MapPage() {
  let grid: GridPrediction[] = [];
  let stations: Station[] = [];
  let worklist: WorklistItem[] = [];
  try {
    [grid, stations, worklist] = await Promise.all([
      // Covers the whole Delhi-NCR pilot grid. A tighter box silently returned
      // only the old demo cells once the real grid was built over a different
      // extent, so the map rendered stale seed rows and looked empty.
      fetchGrid(NCR_BBOX),
      fetchStations(),
      fetchWorklist(),
    ]);
  } catch {
    // The page explicitly states unavailable data rather than inventing a map.
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 p-6">
      <h1 className="text-2xl font-semibold">1 km PM2.5 surface</h1>
      <p className="text-sm text-slate-600">
        Teal points have higher satellite coverage; amber points indicate lower coverage and should be read with more uncertainty. Black points are monitors; red points are ranked fire clusters.
      </p>
      {grid.length ? <MapShell grid={grid} stations={stations} worklist={worklist} /> : <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">No current map estimate is available. The service will not fill the map with stale observations.</p>}
    </main>
  );
}
