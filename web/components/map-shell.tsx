"use client";

import dynamic from "next/dynamic";
import type { GridPrediction, StationReading, WorklistItem } from "@/lib/schemas";
import { MapSkeleton } from "./loading-skeleton";

const DataMap = dynamic(
  () => import("@/components/data-map").then((module) => module.DataMap),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

type MapShellProps = {
  grid: GridPrediction[];
  stations: StationReading[];
  worklist: WorklistItem[];
};

/** Browser-only boundary: MapLibre needs WebGL and cannot render on the server. */
export function MapShell({ grid, stations, worklist }: MapShellProps) {
  return <DataMap grid={grid} stations={stations} worklist={worklist} />;
}
