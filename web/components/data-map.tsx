"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { GridPrediction, Station, WorklistItem } from "@/lib/schemas";

type DataMapProps = {
  grid: GridPrediction[];
  stations: Station[];
  worklist: WorklistItem[];
};

function pointFeatures(items: GridPrediction[], color: (item: GridPrediction) => string) {
  return items.map((item) => ({
    type: "Feature" as const,
    geometry: { type: "Point" as const, coordinates: [item.lon, item.lat] },
    properties: {
      color: color(item),
      radius: 5 + Math.round(item.coverageFraction * 8),
      detail: `${item.code}: ${Math.round(item.pm25Q50)} µg/m³ (90% interval ${Math.round(item.pm25Q10)}–${Math.round(item.pm25Q90)})`,
    },
  }));
}

function featureCollection(features: FeatureCollection["features"]): FeatureCollection {
  return { type: "FeatureCollection", features };
}

export function DataMap({ grid, stations, worklist }: DataMapProps) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [77.209, 28.614],
      zoom: 9,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.on("load", () => {
      map.addSource("predictions", {
        type: "geojson",
        data: featureCollection(
          pointFeatures(grid, (item) => item.coverageFraction < 0.7 ? "#a16207" : "#0f766e"),
        ),
      });
      map.addLayer({ type: "circle", source: "predictions", id: "predictions", paint: { "circle-color": ["get", "color"], "circle-radius": ["get", "radius"], "circle-opacity": 0.7 } });
      map.addSource("stations", {
        type: "geojson",
        data: featureCollection(stations.map((station) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [station.lon, station.lat] },
          properties: {},
        }))),
      });
      map.addLayer({ type: "circle", source: "stations", id: "stations", paint: { "circle-color": "#1e293b", "circle-radius": 4, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
      map.addSource("fires", {
        type: "geojson",
        data: featureCollection(worklist.map((item) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [item.lon, item.lat] },
          properties: {},
        }))),
      });
      map.addLayer({ type: "circle", source: "fires", id: "fires", paint: { "circle-color": "#dc2626", "circle-radius": 7, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
    });
    return () => map.remove();
  }, [grid, stations, worklist]);

  return <div ref={container} className="h-[560px] overflow-hidden rounded-lg border" aria-label="Air quality and fire impact map" />;
}
