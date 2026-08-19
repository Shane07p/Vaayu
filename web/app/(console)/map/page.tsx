import dynamic from "next/dynamic";
import { fetchGrid, fetchStations, fetchWorklist } from "@/lib/api";
import type { GridPrediction, Station, WorklistItem } from "@/lib/schemas";

const DataMap = dynamic(() => import("@/components/data-map").then((module) => module.DataMap), {
  ssr: false,
  loading: () => <div className="h-[560px] animate-pulse rounded-lg bg-slate-200" />,
});

export default async function MapPage() {
  let grid: GridPrediction[] = [];
  let stations: Station[] = [];
  let worklist: WorklistItem[] = [];
  try {
    [grid, stations, worklist] = await Promise.all([
      fetchGrid("76.9,28.4,77.1,28.6"),
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
      {grid.length ? <DataMap grid={grid} stations={stations} worklist={worklist} /> : <p className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">No current map estimate is available. The service will not fill the map with stale observations.</p>}
    </main>
  );
}
