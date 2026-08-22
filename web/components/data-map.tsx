"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MapMouseEvent } from "maplibre-gl";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { GridPrediction, Station, WorklistItem } from "@/lib/schemas";
import { SourceBadge } from "./source-badge";

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
  if (pm25 <= 30) return "#10b981";
  if (pm25 <= 60) return "#22c55e";
  if (pm25 <= 90) return "#eab308";
  if (pm25 <= 120) return "#f97316";
  if (pm25 <= 250) return "#ef4444";
  return "#a855f7";
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

function extractCoords(
  e: MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
): [number, number] | null {
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
  const [mapError, setMapError] = useState<string | null>(null);

  // Selected fire cluster state
  const [selectedCluster, setSelectedCluster] = useState<WorklistItem | null>(null);

  // Derive aggregate stats from the grid
  const avgPm25 = grid.length
    ? Math.round(grid.reduce((sum, g) => sum + g.pm25Q50, 0) / grid.length)
    : 168;
  const maxPm25 = grid.length ? Math.round(Math.max(...grid.map((g) => g.pm25Q50))) : 248;
  const avgCoverage = grid.length
    ? Math.round(
        (grid.reduce((sum, g) => sum + g.coverageFraction, 0) / grid.length) * 100
      )
    : 67;

  const estimatedAqi = Math.round(avgPm25 * 1.55);
  const band = getAqiBand(avgPm25);
  const firstSource = grid[0]?.source ?? "CACHED";

  const closeCluster = useCallback(() => setSelectedCluster(null), []);

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#070a0e" },
          },
        ],
      } as maplibregl.StyleSpecification,
      center: [77.209, 28.614],
      zoom: 9.2,
    });

    mapRef.current = map;
    (window as unknown as { __vaayuMap?: maplibregl.Map }).__vaayuMap = map;

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "bottom-right"
    );

    map.on("error", (event) => {
      setMapError(event.error?.message ?? "Map failed to render");
    });

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: true,
      maxWidth: "320px",
    });

    map.on("load", () => {
      // 1. Grid predictions — circle layer with subtle opacity
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
              radius: 6 + Math.round(item.coverageFraction * 6),
              opacity: 0.4 + item.coverageFraction * 0.45,
              pm25Q50: Math.round(item.pm25Q50),
              pm25Q10: Math.round(item.pm25Q10),
              pm25Q90: Math.round(item.pm25Q90),
              coverage: Math.round(item.coverageFraction * 100),
              band: getAqiBand(item.pm25Q50),
              source: item.source,
              code: item.code,
              modelVersion: item.modelVersion,
              lowCoverage: item.coverageFraction < 0.4,
            },
          }))
        ),
      });

      // Low coverage halo ring
      map.addLayer({
        id: "predictions-halo",
        type: "circle",
        source: "predictions",
        filter: ["==", ["get", "lowCoverage"], true],
        paint: {
          "circle-color": "#f59e0b",
          "circle-radius": ["get", "radius"],
          "circle-opacity": 0.15,
          "circle-stroke-color": "#f59e0b",
          "circle-stroke-width": 1.5,
          "circle-stroke-opacity": 0.5,
        },
      });

      map.addLayer({
        id: "predictions",
        type: "circle",
        source: "predictions",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["get", "radius"],
          "circle-opacity": ["get", "opacity"],
          "circle-stroke-color": "#070a0e",
          "circle-stroke-width": 0.5,
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
          "circle-color": "#ffffff",
          "circle-radius": 5,
          "circle-stroke-color": "#38bdf8",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });

      // 3. Fire clusters — distinctive markers
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
                ? (item.downwindPopulation / 1_000_000).toFixed(1) + "M"
                : "Unknown",
              transport: item.transportHours
                ? item.transportHours.toFixed(1) + "h"
                : "Unknown",
              rank: item.impactRank,
              d95: item.direction95Eligible,
              unactioned: item.consecutiveDaysUnactioned,
              confidence: item.trajectoryConfidence
                ? Math.round(item.trajectoryConfidence * 100)
                : null,
            },
          }))
        ),
      });

      // Fire outer glow
      map.addLayer({
        id: "fires-glow",
        type: "circle",
        source: "fires",
        paint: {
          "circle-color": "#ef4444",
          "circle-radius": 16,
          "circle-opacity": 0.15,
        },
      });

      map.addLayer({
        id: "fires",
        type: "circle",
        source: "fires",
        paint: {
          "circle-color": "#dc2626",
          "circle-radius": 8,
          "circle-stroke-color": "#f8fafc",
          "circle-stroke-width": 2,
          "circle-opacity": 0.95,
        },
      });

      // --- Popups ---
      const cachedBadge = (src: string) =>
        src === "SEED" || src === "FIXTURE"
          ? `<span style="margin-left:4px;padding:1px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#fbbf24;font-size:10px;font-family:monospace;font-weight:600;border:1px solid rgba(245,158,11,0.3)">CACHED</span>`
          : "";

      map.on("mouseenter", "predictions", (e) => {
        const coords = extractCoords(e);
        if (!coords) return;
        map.getCanvas().style.cursor = "pointer";
        const p = e.features![0].properties;
        const lowCov = p.coverage !== undefined && Number(p.coverage) < 40;
        popup
          .setLngLat(coords)
          .setHTML(
            `<div style="padding:14px;font-size:12px;min-width:220px;font-family:ui-monospace,monospace;color:#f1f5f9">
              <div style="font-size:10px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px">GRID CELL ${p.code || ""}${cachedBadge(String(p.source))}</div>
              <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:8px">
                <span style="font-size:22px;font-weight:800;color:${getSeverityColor(Number(p.pm25Q50))}">${p.pm25Q50}</span>
                <span style="font-size:11px;color:#94a3b8">µg/m³ PM2.5</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px">
                <div style="background:rgba(255,255,255,0.04);padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08)">
                  <div style="font-size:9px;color:#94a3b8">Q10</div>
                  <div style="font-size:13px;font-weight:600;color:#f8fafc">${p.pm25Q10}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08)">
                  <div style="font-size:9px;color:#94a3b8">Q50</div>
                  <div style="font-size:13px;font-weight:600;color:#f8fafc">${p.pm25Q50}</div>
                </div>
                <div style="background:rgba(255,255,255,0.04);padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08)">
                  <div style="font-size:9px;color:#94a3b8">Q90</div>
                  <div style="font-size:13px;font-weight:600;color:#f8fafc">${p.pm25Q90}</div>
                </div>
              </div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Coverage: <span style="color:${lowCov ? '#f59e0b' : '#10b981'};font-weight:600">${p.coverage}%</span>${lowCov ? ' <span style="color:#f59e0b">⚠ Low</span>' : ''}</div>
              <div style="font-size:11px;color:#94a3b8">Band: <span style="font-weight:600;color:#f8fafc">${p.band}</span></div>
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
            `<div style="padding:14px;font-size:12px;font-family:ui-monospace,monospace;color:#f1f5f9">
              <div style="font-size:10px;color:#38bdf8;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">MONITORING STATION</div>
              <div style="font-size:14px;font-weight:700;margin-bottom:4px;color:#ffffff">${p.name}</div>
              <div style="font-size:11px;color:#94a3b8">${p.city} · ${p.source}${cachedBadge(String(p.source))}</div>
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
            `<div style="padding:14px;font-size:12px;min-width:240px;font-family:ui-monospace,monospace;color:#f1f5f9">
              <div style="font-size:10px;color:#ef4444;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:4px">🔥 FIRE CLUSTER</div>
              <div style="font-size:15px;font-weight:700;margin-bottom:2px;color:#ffffff">${p.code}</div>
              <div style="font-size:11px;color:#94a3b8;margin-bottom:8px">${p.location}</div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
                <div><span style="font-size:10px;color:#64748b">FRP</span><br/><span style="font-weight:600">${p.frp} MW</span></div>
                <div><span style="font-size:10px;color:#64748b">POP ↓</span><br/><span style="font-weight:600">${p.population}</span></div>
                <div><span style="font-size:10px;color:#64748b">TRANSPORT</span><br/><span style="font-weight:600">${p.transport}</span></div>
                <div><span style="font-size:10px;color:#64748b">RANK</span><br/><span style="font-weight:700;font-size:14px;color:#f59e0b">#${p.rank}</span></div>
              </div>
              ${d95 ? `<div style="margin-top:6px;padding:4px 8px;background:rgba(220,38,38,0.2);border:1px solid #dc2626;border-radius:6px;color:#fca5a5;font-size:11px;font-weight:700">⚠ DIRECTION-95 · ${p.unactioned} days unactioned</div>` : ""}
              <div style="margin-top:8px;font-size:10px;color:#94a3b8;cursor:pointer">Click for details →</div>
            </div>`
          )
          .addTo(map);
      });
      map.on("mouseleave", "fires", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      // Click fire cluster to select it
      map.on("click", "fires", (e) => {
        const p = e.features?.[0]?.properties;
        if (!p) return;
        const found = worklist.find((w) => w.clusterCode === p.code);
        if (found) setSelectedCluster(found);
      });

      // Frame the data
      const points = [
        ...grid.map((g) => [g.lon, g.lat] as [number, number]),
        ...stations.map((s) => [s.lon, s.lat] as [number, number]),
      ];
      if (points.length) {
        const bounds = points.reduce(
          (acc, [lon, lat]) => acc.extend([lon, lat]),
          new maplibregl.LngLatBounds(points[0], points[0])
        );
        map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
      }
    });

    return () => {
      popup.remove();
      map.remove();
    };
  }, [grid, stations, worklist]);

  // Toggle layer visibility
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
    setVis("predictions-halo", showGrid);
    setVis("stations", showStations);
    setVis("fires", showFires);
    setVis("fires-glow", showFires);
  }, [showGrid, showStations, showFires]);

  return (
    <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl">
      {/* Map Container */}
      <div
        ref={container}
        className="w-full h-[640px] xl:h-[720px] bg-[#070a0e]"
        aria-label="Air quality and fire impact map"
      />

      {/* Map Error Notice */}
      {mapError ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 rounded-xl border border-amber-700/60 bg-amber-950/80 px-4 py-2 text-xs font-mono text-amber-200 backdrop-blur-md">
          Map layer notice: {mapError}
        </div>
      ) : null}

      {/* Floating Layer Control with Frosted Glass Switches */}
      <div className="absolute top-4 left-4 z-20 p-4 rounded-2xl bg-[#070a0e]/85 border border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
          Map Layers
        </div>
        {[
          { label: "1 km Nowcast Surface", checked: showGrid, toggle: () => setShowGrid(!showGrid), color: "bg-emerald-400" },
          { label: "Monitoring Stations", checked: showStations, toggle: () => setShowStations(!showStations), color: "bg-sky-400" },
          { label: "Fire Clusters", checked: showFires, toggle: () => setShowFires(!showFires), color: "bg-red-400" },
        ].map((layer) => (
          <label
            key={layer.label}
            className="flex items-center gap-3 text-xs font-mono cursor-pointer select-none group"
          >
            <button
              type="button"
              role="switch"
              aria-checked={layer.checked}
              onClick={layer.toggle}
              className={`relative w-8 h-4.5 rounded-full transition-colors duration-300 ${
                layer.checked ? "bg-white/30" : "bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full transition-transform duration-300 bg-white shadow-md ${
                  layer.checked ? "translate-x-3.5" : ""
                }`}
              />
            </button>
            <span className={`w-2 h-2 rounded-full ${layer.color}`} />
            <span className="text-slate-300 group-hover:text-white transition-colors">
              {layer.label}
            </span>
          </label>
        ))}
      </div>

      {/* Floating Air Quality Intelligence Panel */}
      {grid.length > 0 && (
        <div className="absolute top-4 right-4 z-20 w-64 p-4 rounded-2xl bg-[#070a0e]/85 border border-white/10 backdrop-blur-xl shadow-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Current Air Quality
            </span>
            <SourceBadge source={firstSource} />
          </div>

          <div className="space-y-2">
            <div>
              <div className="text-[10px] font-mono text-slate-400 uppercase">PM2.5 Median</div>
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-2xl font-bold font-mono"
                  style={{ color: getSeverityColor(avgPm25) }}
                >
                  {avgPm25}
                </span>
                <span className="text-xs text-slate-400">µg/m³</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] font-mono text-slate-400">EST. AQI</div>
                <div className="text-sm font-bold font-mono text-slate-200">{estimatedAqi}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] font-mono text-slate-400">BAND</div>
                <div
                  className="text-sm font-bold font-mono"
                  style={{ color: getSeverityColor(avgPm25) }}
                >
                  {band}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] font-mono text-slate-400">MAX PM2.5</div>
                <div className="text-sm font-bold font-mono text-slate-200">{maxPm25}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] font-mono text-slate-400">AVG COVERAGE</div>
                <div className="text-sm font-bold font-mono text-slate-200">{avgCoverage}%</div>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 text-[10px] font-mono text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Grid cells:</span>
              <span className="text-slate-200">{grid.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Stations:</span>
              <span className="text-slate-200">{stations.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Fire clusters:</span>
              <span className="text-slate-200">{worklist.length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Fire Cluster Intelligence Drawer */}
      {selectedCluster && (
        <div className="absolute bottom-4 right-4 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-3xl bg-[#070a0e]/95 border border-red-900/60 backdrop-blur-2xl shadow-2xl">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">🔥</span>
              <span className="font-mono font-bold text-sm text-slate-100">
                FIRE CLUSTER
              </span>
            </div>
            <button
              onClick={closeCluster}
              className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors text-xs"
            >
              ✕
            </button>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <div className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">
                Cluster Code
              </div>
              <div className="text-lg font-mono font-bold text-slate-100">
                {selectedCluster.clusterCode}
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {[selectedCluster.tehsil, selectedCluster.district, selectedCluster.state]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            </div>

            {/* Impact Rank */}
            <div className="p-3.5 rounded-2xl bg-amber-950/25 border border-amber-800/40">
              <div className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                Impact Rank
              </div>
              <div className="text-3xl font-mono font-black text-amber-300">
                #{selectedCluster.impactRank}
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] text-slate-400 uppercase">FRP</div>
                <div className="text-sm font-bold text-slate-200">
                  {selectedCluster.totalFrp.toFixed(0)} MW
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] text-slate-400 uppercase">Downwind Pop.</div>
                <div className="text-sm font-bold text-slate-200">
                  {selectedCluster.downwindPopulation
                    ? (selectedCluster.downwindPopulation / 1_000_000).toFixed(1) + "M"
                    : "Unknown"}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] text-slate-400 uppercase">Transport</div>
                <div className="text-sm font-bold text-slate-200">
                  {selectedCluster.transportHours
                    ? selectedCluster.transportHours.toFixed(1) + " h"
                    : "Unknown"}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/5">
                <div className="text-[9px] text-slate-400 uppercase">Trajectory Conf.</div>
                <div className="text-sm font-bold text-slate-200">
                  {selectedCluster.trajectoryConfidence
                    ? Math.round(selectedCluster.trajectoryConfidence * 100) + "%"
                    : "Unknown"}
                </div>
              </div>
            </div>

            {/* Direction-95 */}
            {selectedCluster.direction95Eligible && (
              <div className="p-3 rounded-2xl bg-red-950/50 border border-red-600/80 shadow-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                  <span className="font-mono font-bold text-red-200 text-xs uppercase tracking-wider">
                    Direction-95 Eligible
                  </span>
                </div>
                <div className="text-xs text-red-300">
                  Unactioned for{" "}
                  <span className="font-bold">
                    {selectedCluster.consecutiveDaysUnactioned} days
                  </span>
                  . Statutory escalation eligible.
                </div>
              </div>
            )}

            {/* CTA */}
            <a
              href="/alerts"
              className="block w-full text-center py-3 rounded-2xl bg-white/[0.08] hover:bg-white/[0.14] text-slate-200 text-xs font-mono font-medium border border-white/10 transition-colors"
            >
              View related statutory alert →
            </a>
          </div>
        </div>
      )}

      {/* Intelligence Chain Strip */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 p-2 rounded-2xl bg-[#070a0e]/85 border border-white/10 backdrop-blur-xl">
        {["OBSERVE", "ESTIMATE", "FORECAST", "ATTRIBUTE", "ALERT", "ACT"].map(
          (step, idx) => (
            <div key={step} className="flex items-center gap-1">
              <span
                className={`px-2 py-0.5 rounded-lg text-[9px] font-mono font-medium ${
                  step === "ESTIMATE"
                    ? "bg-white/[0.12] text-white border border-white/20 font-bold"
                    : "bg-white/[0.03] text-slate-400 border border-white/5"
                }`}
              >
                {step}
              </span>
              {idx < 5 && <span className="text-slate-600 text-[9px]">→</span>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
