// web/components/citizen/FullScreenMap.tsx
"use client";

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import AQIMarkers from '@/components/citizen/AQIMarkers';
import MapControls from '@/components/citizen/MapControls';
import { useAQIStore } from '@/store/aqiStore';

/**
 * Full‑screen MapLibre map that occupies the entire viewport.
 * It renders AQI markers and a floating control bar.
 * The map instance is stored in a ref; on mount we initialise it with a dark style.
 */
const FullScreenMap: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const { loadGrid } = useAQIStore();

  useEffect(() => {
    if (!mapContainer.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: '/map-style.json', // existing dark style in public folder
      center: [77.2, 28.6], // centre of Delhi NCR
      zoom: 9,
      pitch: 0,
      bearing: 0,
    });
    // Desaturate / low‑contrast visual tweaks
    map.getCanvas().style.filter = 'grayscale(0.4) contrast(0.85)';
    mapRef.current = map;

    // Load grid data (mocked/fetched elsewhere) – for now we just fetch from API once.
    // The store's loadGrid will be called by the page via useEffect.

    return () => {
      map.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen">
      <div ref={mapContainer} className="w-full h-full" />
      {/* Floating UI components on top of the map */}
      <AQIMarkers map={mapRef.current} />
      <MapControls />
    </div>
  );
};

export default FullScreenMap;
