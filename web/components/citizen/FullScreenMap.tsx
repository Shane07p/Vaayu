// web/components/citizen/FullScreenMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AQIMarkers, { getAqiTextColor, getAqiCategory } from '@/components/citizen/AQIMarkers';
import MapControls from '@/components/citizen/MapControls';
import { useAQIStore } from '@/store/aqiStore';
import { SourceBadge } from '@/components/source-badge';

/**
 * Full‑screen MapLibre map that occupies the viewport.
 * Renders compact text AQI markers, top-right location search, and floating cell inspection card.
 */
const FullScreenMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const { selectedCellData, locationName, selectCell } = useAQIStore();

  useEffect(() => {
    if (!mapContainer.current) return;

    const mapInstance = new maplibregl.Map({
      container: mapContainer.current,
      style: '/map-style.json',
      center: [77.209, 28.6139], // Delhi NCR center
      zoom: 9.2,
      pitch: 0,
      bearing: 0,
    });

    mapInstance.on('load', () => {
      // Apply subtle desaturation for high contrast telemetry visibility
      const canvas = mapInstance.getCanvas();
      if (canvas) {
        canvas.style.filter = 'grayscale(0.35) contrast(0.9)';
      }
      setMap(mapInstance);
    });

    return () => {
      mapInstance.remove();
    };
  }, []);

  const aqi = selectedCellData ? Math.round((selectedCellData.pm25Q50 / 250) * 500) : null;
  const aqiColor = aqi !== null ? getAqiTextColor(aqi) : '#34d399';
  const aqiCategory = aqi !== null ? getAqiCategory(aqi) : 'Good';

  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden bg-[#070a0e]">
      {/* Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating AQI Text Markers Layer */}
      {map && <AQIMarkers map={map} />}

      {/* Top-Right Search & Navigation Controls */}
      <MapControls map={map} />

      {/* Bottom-Left Selected Cell Inspector Overlay */}
      {selectedCellData && aqi !== null && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-[#080d12]/92 border border-white/15 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-fade-in text-slate-100">
          <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5 mb-3">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: aqiColor }} />
                <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
                  {locationName}
                </span>
              </div>
              <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                Cell: {selectedCellData.code} · {selectedCellData.lat.toFixed(3)}°N, {selectedCellData.lon.toFixed(3)}°E
              </div>
            </div>
            <button
              onClick={() => selectCell(-1)}
              className="text-slate-400 hover:text-slate-200 text-xs p-1"
              title="Close card"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
                Air Quality Index
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-3xl font-mono font-bold" style={{ color: aqiColor }}>
                  {aqi}
                </span>
                <span className="text-xs font-mono font-semibold" style={{ color: aqiColor }}>
                  {aqiCategory}
                </span>
              </div>
            </div>
            <SourceBadge source={selectedCellData.source ?? 'CACHED'} />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[11px] font-mono">
            <div className="bg-white/[0.04] p-2 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase">PM2.5 Estimate</span>
              <span className="font-bold text-slate-100">{Math.round(selectedCellData.pm25Q50)} µg/m³</span>
            </div>
            <div className="bg-white/[0.04] p-2 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase">90% Uncertainty</span>
              <span className="text-slate-300">
                {Math.round(selectedCellData.pm25Q10)}–{Math.round(selectedCellData.pm25Q90)}
              </span>
            </div>
            <div className="bg-white/[0.04] p-2 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase">Coverage</span>
              <span className="text-slate-300">{Math.round(selectedCellData.coverageFraction * 100)}%</span>
            </div>
            <div className="bg-white/[0.04] p-2 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase">Model Version</span>
              <span className="text-slate-300 truncate">{selectedCellData.modelVersion}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullScreenMap;

