// web/components/citizen/FullScreenMap.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AQIMarkers, { getAqiTextColor, getAqiCategory } from '@/components/citizen/AQIMarkers';
import MapControls from '@/components/citizen/MapControls';
import { useAQIStore } from '@/store/aqiStore';
import { useCitizenI18n } from '@/lib/i18n';
import { SourceBadge } from '@/components/source-badge';
import { StationAdvisory } from '@/components/citizen/station-advisory';
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
/**
 * Flat fallback used when the basemap style cannot load.
 *
 * The AQI markers are the point of this map; the basemap is context. A style
 * that fails to resolve never fires MapLibre's `load` event, and every layer
 * and the setMap call below depend on it, so without a fallback the map stays
 * permanently blank with no markers and no error.
 *
 * Note for deployment: /map-style.json points at tile.openstreetmap.org. The
 * OSM Foundation tile usage policy does not permit a deployed application to
 * use those servers, so a keyed provider is needed before this ships publicly.
 * https://operations.osmfoundation.org/policies/tiles/
 */
const FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#111111' },
    },
  ],
};

const FullScreenMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const { selectedCellData, locationName, markerInfo, dataSource, lastUpdated, loading, clearSelection, nearestStation, locationError, hasQueried, selectedStation } = useAQIStore();
  const { t } = useCitizenI18n();
  const styleFailed = useRef(false);
  const [basemapDegraded, setBasemapDegraded] = useState(false);

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

    // Without this, a map failure is indistinguishable from a map with no data:
    // an empty canvas and a silent console. MapLibre reports style and tile
    // problems here and nowhere else.
    mapInstance.on('error', (event) => {
      const message = event.error?.message ?? 'Map failed to render';
      console.error('Map error:', message);

      // The basemap is decoration; the AQI markers are the point. If the style
      // cannot load, fall back to a flat background so the map still functions
      // rather than staying blank forever. This matters because setMap below is
      // only reached from the load handler, and load never fires on a style that
      // fails to resolve, so the marker layer would never receive a map at all.
      if (!styleFailed.current && /style|glyphs|sprite/i.test(message)) {
        styleFailed.current = true;
        setBasemapDegraded(true);
        mapInstance.setStyle(FALLBACK_STYLE);
      }
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
      // Server-computed CPCB AQI. This was pm25 / 250 * 500, an invented
      // linear scaling that reported a whole band low at 120 ug/m3.
      ? selectedCellData.aqi
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

  // A clicked station takes precedence over everything else on screen. It is a
  // measurement; the grid cell is a modelled estimate, and while the model is
  // still seeded the two disagree sharply -- seed cells average 168 ug/m3 where
  // Delhi's DPCC stations currently read 29 to 65.
  const showStationCard = selectedStation !== null;
  const showCard = !showStationCard && (markerInfo !== null || selectedCellData !== null);

  // A location was chosen, the fetch finished, and nothing was measured there.
  // Without this the click simply did nothing, which reads as a broken map
  // rather than as an absence of data. The grid covers Delhi-NCR only.
  const showNoData =
    !showStationCard && hasQueried && !showCard && !loading && dataSource === 'NONE';

  // Outside the 1 km surface there is no cell, but there is usually a real
  // station somewhere. Shown with its distance so a reading from 23 km away is
  // never mistaken for a reading here.
  const showNearest = !showStationCard && hasQueried && !showCard && !loading && nearestStation !== null;

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
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-black/65 border border-white/10 rounded-2xl backdrop-blur-md animate-fade-in text-slate-100 overflow-hidden">
          
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

            {basemapDegraded && (

              <p className="mb-2 rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[10px] font-mono text-amber-300">

                Basemap unavailable — geography is not shown. AQI markers are unaffected.

              </p>

            )}

            {/* Data source badge */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
                {dataSource === 'API' ? 'Measured' : 'Reference Data'}
              </span>
              {selectedCellData && <SourceBadge source={dataSource === 'API' ? selectedCellData.source : 'CACHED'} />}
            </div>
          </div>
        </div>
      )}

      {showStationCard && selectedStation && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-[#080d12]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-slate-100 animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 truncate">
              {selectedStation.city ?? selectedStation.name}
            </div>
            <button
              onClick={clearSelection}
              className="bg-black/50 hover:bg-black/70 text-slate-300 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors flex-shrink-0"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Named, so the reader can see whose measurement this is. */}
          <div className="text-[10px] font-mono text-slate-500 mb-3 truncate">
            {selectedStation.name}
          </div>

          <div className="flex items-baseline gap-2 mb-3">
            <span
              className="text-4xl font-mono font-black tracking-tight"
              style={{ color: getAqiTextColor(selectedStation.aqi) }}
            >
              {selectedStation.aqi}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: getAqiTextColor(selectedStation.aqi) }}
            >
              {getAqiCategory(selectedStation.aqi)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase tracking-wider">PM2.5</span>
              <span className="font-bold text-slate-100 text-sm">{selectedStation.pm25} µg/m³</span>
            </div>
            <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase tracking-wider">{t.measuredLabel}</span>
              <span className="text-slate-300">
                {new Date(selectedStation.measuredAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {selectedStation.stale && (
            <p className="mt-2 rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[10px] font-mono text-amber-300">
              {t.notReported}
            </p>
          )}

          {/* No quantile range or coverage figure here: those belong to the
              modelled surface, not to a measurement. Presenting an instrument
              reading with a model's uncertainty band would misattribute both. */}
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">
              {t.measuredAtStation}
            </span>
            <SourceBadge source={selectedStation.operator} />
          </div>

          {/* Explains the measurement above, in the reader's language, from
              those same figures and no others. */}
          <StationAdvisory lat={selectedStation.lat} lon={selectedStation.lon} />
        </div>
      )}

      {showNearest && nearestStation && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-[#080d12]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-slate-100 animate-fade-in">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200 truncate">
              {locationName}
            </div>
            <button
              onClick={clearSelection}
              className="bg-black/50 hover:bg-black/70 text-slate-300 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors flex-shrink-0"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* The distance leads. It is the honest subject of this card: the
              nearest measurement, not a measurement of this spot. */}
          <p className="text-[11px] text-slate-400 mb-3">
            {t.nearestIs}{" "}
            <span className="text-slate-200 font-semibold">{nearestStation.distanceKm} km</span>{" "}
            {t.away}
          </p>

          <div className="flex items-baseline gap-2 mb-3">
            <span
              className="text-4xl font-mono font-black tracking-tight"
              style={{ color: getAqiTextColor(nearestStation.aqi) }}
            >
              {nearestStation.aqi}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: getAqiTextColor(nearestStation.aqi) }}
            >
              {getAqiCategory(nearestStation.aqi)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mb-3">
            <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase tracking-wider">PM2.5</span>
              <span className="font-bold text-slate-100 text-sm">
                {nearestStation.pm25} µg/m³
              </span>
            </div>
            <div className="bg-white/[0.04] p-2.5 rounded-xl border border-white/5">
              <span className="text-slate-400 block text-[9px] uppercase tracking-wider">{t.measuredLabel}</span>
              <span className="text-slate-300">
                {new Date(nearestStation.measuredAt).toLocaleString("en-IN", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {nearestStation.stale && (
            <p className="mb-2 rounded border border-amber-800/60 bg-amber-950/30 px-2 py-1 text-[10px] font-mono text-amber-300">
              {t.notReported}
              rather than as a current reading.
            </p>
          )}

          {/* Attributed, so the figure is the operator's rather than "VAAYU's". */}
          <div className="text-[10px] font-mono text-slate-500 border-t border-white/5 pt-2">
            {nearestStation.name}
          </div>
        </div>
      )}

      {showNoData && (
        <div className="absolute bottom-6 left-4 sm:left-6 z-20 max-w-sm w-[calc(100vw-2rem)] sm:w-80 bg-[#080d12]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-slate-100">
          <div className="flex items-start justify-between gap-2">
            <div className="text-xs font-mono font-bold tracking-wider uppercase text-slate-200">
              {locationName}
            </div>
            <button
              onClick={clearSelection}
              className="bg-black/50 hover:bg-black/70 text-slate-300 hover:text-white rounded-full w-6 h-6 flex items-center justify-center text-xs transition-colors flex-shrink-0"
              title="Close"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {t.noMeasurement}
          </p>
          <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-slate-600">
            {t.noData}
          </p>
        </div>
      )}

      {/* A denied or failed location request. Shown, because only the user can
          resolve it and a button that does nothing reads as broken. */}
      {locationError && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 max-w-sm w-[calc(100vw-2rem)] rounded-2xl border border-amber-800/60 bg-amber-950/90 px-4 py-2.5 text-[11px] font-mono text-amber-200 backdrop-blur-xl">
          {locationError}
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
