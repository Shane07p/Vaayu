"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, MapMouseEvent } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GridPrediction, Station, WorklistItem } from "@/lib/schemas";

type DataMapProps = {
  grid: GridPrediction[];
  stations: Station[];
  worklist: WorklistItem[];
};

type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, string | number | boolean | null>;
};

type PointFeatureCollection = {
  type: "FeatureCollection";
  features: PointFeature[];
};

function getSeverityColor(pm25: number): string {
  if (pm25 <= 60) return "#22c55e";
  if (pm25 <= 90) return "#eab308";
  if (pm25 <= 120) return "#f97316";
  if (pm25 <= 250) return "#ef4444";
  return "#9333ea";
}

function getAqiBand(pm25: number): string {
  if (pm25 <= 30) return "GOOD";
  if (pm25 <= 60) return "SATISFACTORY";
  if (pm25 <= 90) return "MODERATE";
  if (pm25 <= 120) return "POOR";
  if (pm25 <= 250) return "VERY POOR";
  return "SEVERE";
}

function featureCollection(features: PointFeature[]): PointFeatureCollection {
  return { type: "FeatureCollection", features };
}

function extractCoords(e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }): [number, number] | null {
  const geom = e.features?.[0]?.geometry;
  if (!geom || geom.type !== "Point") return null;
  return [geom.coordinates[0], geom.coordinates[1]];
}

export function DataMap({ grid, stations, worklist }: DataMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const [showGrid, setShowGrid] = useState(true);
  const [showStations, setShowStations] = useState(true);
  const [showFires, setShowFires] = useState(true);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [77.209, 28.614],
      zoom: 9,
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl(), "top-right");

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
    });

    map.on("load", () => {
      // 1. Grid predictions
      map.addSource("predictions", {
        type: "geojson",
        data: featureCollection(
          grid.map((item) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [item.lon, item.lat] as [number, number],
            },
            properties: {
              color: getSeverityColor(item.pm25Q50),
              radius: 5 + Math.round(item.coverageFraction * 8),
              pm25Q50: Math.round(item.pm25Q50),
              pm25Q10: Math.round(item.pm25Q10),
              pm25Q90: Math.round(item.pm25Q90),
              coverage: Math.round(item.coverageFraction * 100),
              band: getAqiBand(item.pm25Q50),
              source: item.source,
            },
          }))
        ),
      });
      map.addLayer({
        id: "predictions",
        type: "circle",
        source: "predictions",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-opacity": 0.7,
        },
      });

      // 2. Monitoring stations
      map.addSource("stations", {
        type: "geojson",
        data: featureCollection(
          stations.map((station) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [station.lon, station.lat] as [number, number],
            },
            properties: {
              name: station.name,
              city: station.city ?? "",
              source: station.source,
            },
          }))
        ),
      });
      map.addLayer({
        id: "stations",
        type: "circle",
        source: "stations",
        paint: {
          "circle-color": "#1e293b",
          "circle-radius": 5,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // 3. Fire clusters
      map.addSource("fires", {
        type: "geojson",
        data: featureCollection(
          worklist.map((item) => ({
            type: "Feature" as const,
            geometry: {
              type: "Point" as const,
              coordinates: [item.lon, item.lat] as [number, number],
            },
            properties: {
              code: item.clusterCode,
              location: [item.tehsil, item.district, item.state]
                .filter(Boolean)
                .join(", "),
              frp: item.totalFrp.toFixed(1),
              population: item.downwindPopulation
                ? (item.downwindPopulation / 10_000_000).toFixed(2) + " crore"
                : "Unknown",
              transport: item.transportHours
                ? item.transportHours.toFixed(1) + "h"
                : "Unknown",
              rank: item.impactRank,
              d95: item.direction95Eligible,
              unactioned: item.consecutiveDaysUnactioned,
            },
          }))
        ),
      });
      map.addLayer({
        id: "fires",
        type: "circle",
        source: "fires",
        paint: {
          "circle-color": "#dc2626",
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });

      // Popup helpers
      const cachedBadge = (src: string) =>
        src === "SEED" || src === "FIXTURE"
          ? `<span class="ml-1 rounded bg-amber-100 px-1 text-xs font-medium text-amber-800">CACHED</span>`
          : "";

      map.on("mouseenter", "predictions", (e) => {
        const coords = extractCoords(e);
        if (!coords) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features![0].properties;
        popup
          .setLngLat(coords)
          .setHTML(
            `<div class="p-2 text-sm min-w-[180px]">
              <div class="font-bold mb-1">PM2.5: ${p.pm25Q50} µg/m³${cachedBadge(String(p.source))}</div>
              <div class="text-gray-600">90% Interval: ${p.pm25Q10}–${p.pm25Q90} µg/m³</div>
              <div class="text-gray-600">Coverage: ${p.coverage}% satellite data</div>
              <div class="mt-1 font-semibold">AQI Band: ${p.band}</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "predictions", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("mouseenter", "stations", (e) => {
        const coords = extractCoords(e);
        if (!coords) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features![0].properties;
        popup
          .setLngLat(coords)
          .setHTML(
            `<div class="p-2 text-sm">
              <div class="font-bold">${p.name}</div>
              <div class="text-gray-600">${p.city}</div>
              <div class="mt-1 text-gray-500">Source: ${p.source}${cachedBadge(String(p.source))}</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "stations", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("mouseenter", "fires", (e) => {
        const coords = extractCoords(e);
        if (!coords) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features![0].properties;
        const d95 = p.d95 === true || p.d95 === "true";
        popup
          .setLngLat(coords)
          .setHTML(
            `<div class="p-2 text-sm min-w-[200px]">
              <div class="font-bold mb-1">Cluster: ${p.code}</div>
              <div class="text-gray-600">${p.location}</div>
              <div class="mt-2 text-gray-700">FRP: ${p.frp} W/m²</div>
              <div class="text-gray-700">Downwind pop: ${p.population}</div>
              <div class="text-gray-700">Transport: ${p.transport}</div>
              <div class="mt-1 font-semibold">Impact Rank: #${p.rank}</div>
              ${d95 ? `<div class="mt-1 font-bold text-red-700">⚠ Direction-95 eligible (${p.unactioned} days unactioned)</div>` : ""}
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "fires", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });
    });

    return () => {
      popup.remove();
      map.remove();
    };
  }, [grid, stations, worklist]);

  // Toggle layer visibility after map is loaded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (id: string, visible: boolean) => {
      try {
        map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
      } catch {
        // Layer not yet loaded
      }
    };
    setVis("predictions", showGrid);
    setVis("stations", showStations);
    setVis("fires", showFires);
  }, [showGrid, showStations, showFires]);

  return (
    <div className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
            className="rounded border-gray-300"
          />
          Grid Predictions
        </label>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showStations}
            onChange={(e) => setShowStations(e.target.checked)}
            className="rounded border-gray-300"
          />
          Monitors
        </label>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showFires}
            onChange={(e) => setShowFires(e.target.checked)}
            className="rounded border-gray-300"
          />
          Fire Clusters
        </label>
      </div>
      <div
        ref={container}
        className="h-[560px] overflow-hidden rounded-lg border shadow-sm"
        aria-label="Air quality and fire impact map"
      />
    </div>
  );
}
