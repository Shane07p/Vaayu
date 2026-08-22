// web/components/citizen/FullScreenMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AQIMarkers, { getAqiTextColor, getAqiCategory } from '@/components/citizen/AQIMarkers';
import MapControls from '@/components/citizen/MapControls';
import { useAQIStore } from '@/store/aqiStore';
import { SourceBadge } from '@/components/source-badge';
import Image from 'next/image';

/** Get the correct AQI severity image path based on AQI value */
function getAqiImage(aqi: number): string {
  if (aqi <= 50) return '/aqi-images/Green.png';
  if (aqi <= 100) return '/aqi-images/Yellow.png';
  if (aqi <= 150) return '/aqi-images/Orange.png';
  if (aqi <= 200) return '/aqi-images/Pink.png';
  if (aqi <= 300) return '/aqi-images/Purple.png';
  return '/aqi-images/Red.png';
}

/** Tier label */
function getTierLabel(tier: number): string {
  if (tier === 0) return 'Continent';
  if (tier === 1) return 'Country';
  if (tier === 2) return 'State';
  return 'City';
}

/**
 * Full‑screen MapLibre map that occupies the viewport.
 * Renders compact text AQI markers, top-right location search, and floating cell inspection card.
 */
const FullScreenMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const { selectedCellData, locationName, markerInfo, dataSource, lastUpdated, loading, clearSelection } = useAQIStore();

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

  // Determine the AQI to display — prefer marker data, fall back to grid cell
  const displayAqi = markerInfo
    ? markerInfo.aqi
    : selectedCellData
      ? Math.round((selectedCellData.pm25Q50 / 250) * 500)
      : null;

  const displayPm25 = markerInfo
    ? markerInfo.pm25
    : selectedCellData
      ? Math.round(selectedCellData.pm25Q50)
      : null;

  const displayCategory = markerInfo
    ? markerInfo.category
    : displayAqi !== null
      ? getAqiCategory(displayAqi)
      : 'Good';

  const aqiColor = displayAqi !== null ? getAqiTextColor(displayAqi) : '#34d399';
  const aqiImage = displayAqi !== null ? getAqiImage(displayAqi) : '/aqi-images/Green.png';

  const showCard = markerInfo !== null || selectedCellData !== null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-0 overflow-hidden bg-[#070a0e]">
      {/* Map Canvas */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* Floating AQI Text Markers Layer */}
      {map && <AQIMarkers map={map} />}

      {/* Top-Right Search & Navigation Controls */}
      <MapControls map={map} />

      {/* Bottom-Left Selected Location Inspector Overlay */}
      {showCard && displayAqi !== null && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-[#080d12]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl animate-fade-in text-slate-100 overflow-hidden">
          
          {/* AQI Severity Image Banner */}
          <div className="relative w-full h-28 overflow-hidden">
            <Image
              src={aqiImage}
              alt={`AQI ${displayCategory}`}
              fill
              className="object-cover opacity-70"
              sizes="320px"
              priority
            />
            {/* Gradient overlay so text reads cleanly */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#080d12] via-[#080d12]/60 to-transparent" />
            
            {/* AQI value overlay on the image */}
            <div className="absolute bottom-3 left-4 flex items-baseline gap-2">
              <span className="text-4xl font-mono font-black tracking-tight" style={{ color: aqiColor }}>
                {displayAqi}
              </span>
              <span className="text-sm font-semibold" style={{ color: aqiColor }}>
                {displayCategory}
              </span>
            </div>

            {/* Close button */}
            <button
              onClick={clearSelection}
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-slate-300 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors"
              title="Close card"
            >
              ✕
            </button>
          </div>

          {/* Location Info */}
          <div className="p-4 pt-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: aqiColor }} />
              <span className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 truncate">
                {locationName}
              </span>
            </div>

            {markerInfo && (
              <div className="text-[10px] font-mono text-slate-400 mb-3">
                {getTierLabel(markerInfo.tier)} Level · {lastUpdated}
              </div>
            )}

            {/* Data Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">PM2.5</span>
                <span className="font-bold text-slate-100 text-sm">{displayPm25} µg/m³</span>
              </div>
              <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                <span className="text-slate-400 block text-[9px] uppercase tracking-wider">AQI Level</span>
                <span className="font-bold text-sm" style={{ color: aqiColor }}>{displayAqi}</span>
              </div>

              {/* Show grid cell info if we have real API data */}
              {dataSource === 'API' && selectedCellData && (
                <>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">90% Range</span>
                    <span className="text-slate-300">
                      {Math.round(selectedCellData.pm25Q10)}–{Math.round(selectedCellData.pm25Q90)}
                    </span>
                  </div>
                  <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
                    <span className="text-slate-400 block text-[9px] uppercase tracking-wider">Coverage</span>
                    <span className="text-slate-300">{Math.round(selectedCellData.coverageFraction * 100)}%</span>
                  </div>
                </>
              )}
            </div>

            {/* Data source badge */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {dataSource === 'API' ? 'Live Data' : dataSource === 'MARKER' ? 'Reference Data' : 'Estimated'}
              </span>
              {selectedCellData && <SourceBadge source={dataSource === 'API' ? selectedCellData.source : 'CACHED'} />}
            </div>
          </div>
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#080d12]/90 border border-white/10 rounded-full px-4 py-2 text-xs font-mono text-slate-300 backdrop-blur-xl">
          Loading…
        </div>
      )}
    </div>
  );
};

export default FullScreenMap;
