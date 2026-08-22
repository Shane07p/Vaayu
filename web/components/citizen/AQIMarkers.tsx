// web/components/citizen/AQIMarkers.tsx
//
// Lazy, viewport-only, tier-cascading AQI markers.
// Creates DOM elements ONLY for what is currently visible.
// If ANY two markers at the current tier collide → entire tier is
// hidden and the next tier up (state → country → continent) is shown.
//
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import {
  loadGeoReferenceData,
  GeoReferenceData,
  CountryLocation,
  StateLocation,
  CityLocation,
  ContinentLocation,
} from '@/lib/coordinates';

/* ───── colour helpers (unchanged) ───── */
export const getAqiTextColor = (aqi: number): string => {
  if (aqi <= 50)  return '#34d399';
  if (aqi <= 100) return '#fbbf24';
  if (aqi <= 150) return '#fb923c';
  if (aqi <= 200) return '#f472b6';
  if (aqi <= 300) return '#c084fc';
  return '#f87171';
};

export const getAqiCategory = (aqi: number): string => {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

/* ───── Normalised data-point (no DOM yet) ───── */
interface DataPoint {
  id: string | number;
  name: string;
  lat: number;
  lon: number;
  aqi: number;
  pm25: number;
  category: string;
  tier: number; // 0-continent  1-country  2-state  3-city
}

/* ───── Build the four flat arrays from fetched reference data ───── */
// Previously a module-level constant built from static JSON imports, which
// pulled roughly a megabyte of data into the client bundle. The data now
// arrives over the network, so the tiers are derived once it lands.
function buildTiers(data: GeoReferenceData): DataPoint[][] {
  return [
    // tier 0 — continents
    data.continents.map((c: ContinentLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon,
      aqi: c.aqi, pm25: c.pm25, category: c.category, tier: 0,
    })),
    // tier 1 — countries
    data.countries.map((c: CountryLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon,
      aqi: c.aqi, pm25: c.pm25, category: c.category, tier: 1,
    })),
    // tier 2 — states
    data.states.map((c: StateLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon,
      aqi: c.aqi, pm25: c.pm25, category: c.category, tier: 2,
    })),
    // tier 3 — cities
    data.cities.map((c: CityLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon,
      aqi: c.aqi, pm25: c.pm25,
      category: c.category || getAqiCategory(c.aqi), tier: 3,
    })),
  ];
}

const NO_TIERS: DataPoint[][] = [[], [], [], []];

/* ───── Props ───── */
interface Props { map: Map | null; }

/* ───── Collision threshold in pixels ───── */
const COLLISION_PX = 40;

/* ───── Component ───── */
const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { selectCell, loadLocationData } = useAQIStore();
  const [geoData, setGeoData] = useState<GeoReferenceData | null>(null);

  // Fetched rather than bundled; see lib/coordinates.ts.
  useEffect(() => {
    let cancelled = false;
    loadGeoReferenceData().then((data) => {
      if (!cancelled) setGeoData(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const allData = useMemo(
    () => (geoData ? buildTiers(geoData) : NO_TIERS),
    [geoData],
  );
  // Store live markers so we can remove them on the next cycle
  const liveMarkers = useRef<maplibregl.Marker[]>([]);
  const rafId = useRef<number>(0);

  /* Build a single DOM marker element – called only for items we actually show */
  const buildElement = useCallback(
    (pt: DataPoint) => {
      const textColor = getAqiTextColor(pt.aqi);
      const fontSize = pt.tier === 0 ? 16 : pt.tier === 1 ? 14 : pt.tier === 2 ? 12 : 11;
      const labelSize = pt.tier === 0 ? 10 : pt.tier === 1 ? 9 : 8;

      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      el.title = `${pt.name}\nAQI: ${pt.aqi} · ${pt.category}\nPM2.5: ${pt.pm25} µg/m³`;

      // AQI number
      const num = document.createElement('span');
      num.textContent = `${pt.aqi}`;
      num.style.color = textColor;
      num.style.fontSize = `${fontSize}px`;
      num.style.fontWeight = '800';
      num.style.fontFamily = 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace';
      num.style.lineHeight = '1';
      num.style.userSelect = 'none';
      num.style.textShadow =
        '-1px -1px 0 #0a0a0a, 1px -1px 0 #0a0a0a, -1px 1px 0 #0a0a0a, 1px 1px 0 #0a0a0a, 0 0 4px #000';
      num.style.transition = 'transform .12s ease';

      // Name label (only show for continent/country/state, hide for cities to reduce noise)
      const label = document.createElement('span');
      label.textContent = pt.name;
      label.style.color = '#cbd5e1';
      label.style.fontSize = `${labelSize}px`;
      label.style.fontWeight = '600';
      label.style.fontFamily = 'ui-sans-serif,system-ui,-apple-system,sans-serif';
      label.style.lineHeight = '1.1';
      label.style.marginTop = '1px';
      label.style.userSelect = 'none';
      label.style.textShadow =
        '-1px -1px 0 #0a0a0a, 1px -1px 0 #0a0a0a, -1px 1px 0 #0a0a0a, 1px 1px 0 #0a0a0a';

      el.appendChild(num);
      if (pt.tier <= 2) el.appendChild(label);

      // Hover
      el.onmouseenter = () => {
        num.style.transform = 'scale(1.25)';
        el.style.zIndex = '50';
      };
      el.onmouseleave = () => {
        num.style.transform = 'scale(1)';
        el.style.zIndex = '1';
      };

      // Click
      el.onclick = (e) => {
        e.stopPropagation();
        selectCell(pt.id as number);
        loadLocationData(pt.lat, pt.lon, pt.name, map, {
          aqi: pt.aqi,
          pm25: pt.pm25,
          category: pt.category,
          tier: pt.tier,
        });
        if (pt.tier === 0)      map?.flyTo({ center: [pt.lon, pt.lat], zoom: 3.5 });
        else if (pt.tier === 1) map?.flyTo({ center: [pt.lon, pt.lat], zoom: 5.5 });
        else if (pt.tier === 2) map?.flyTo({ center: [pt.lon, pt.lat], zoom: 7.5 });
      };

      return el;
    },
    [map, selectCell, loadLocationData],
  );

  useEffect(() => {
    if (!map) return;

    /* ───── Core render cycle ───── */
    const render = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);

      rafId.current = requestAnimationFrame(() => {
        const zoom = map.getZoom();
        const bounds = map.getBounds();

        // Choose starting tier from zoom
        let startTier = 3;
        if (zoom < 3)        startTier = 0;
        else if (zoom < 4.5) startTier = 1;
        else if (zoom < 6.5) startTier = 2;

        // Find the best tier that has no collisions
        let chosenPoints: DataPoint[] = [];

        for (let tier = startTier; tier >= 0; tier--) {
          // Filter to viewport only
          const inView = allData[tier].filter(
            (p) =>
              p.lat >= bounds.getSouth() &&
              p.lat <= bounds.getNorth() &&
              p.lon >= bounds.getWest() &&
              p.lon <= bounds.getEast(),
          );

          if (inView.length === 0) {
            // Nothing in viewport at this tier, try the next one up
            continue;
          }

          // Project each to screen pixels
          const projected = inView.map((p) => ({
            ...p,
            pt: map.project([p.lon, p.lat]),
          }));

          // Check if ANY two collide
          let hasCollision = false;
          outer: for (let i = 0; i < projected.length; i++) {
            for (let j = i + 1; j < projected.length; j++) {
              const dx = projected[i].pt.x - projected[j].pt.x;
              const dy = projected[i].pt.y - projected[j].pt.y;
              if (dx * dx + dy * dy < COLLISION_PX * COLLISION_PX) {
                hasCollision = true;
                break outer;
              }
            }
          }

          if (!hasCollision) {
            chosenPoints = inView;
            break; // this tier fits
          }
          // else: collision → loop continues, tier-- (promote to parent)
        }

        // If even continents collide (unlikely), just show continents anyway
        if (chosenPoints.length === 0 && startTier >= 0) {
          const inView = allData[0].filter(
            (p) =>
              p.lat >= bounds.getSouth() &&
              p.lat <= bounds.getNorth() &&
              p.lon >= bounds.getWest() &&
              p.lon <= bounds.getEast(),
          );
          chosenPoints = inView;
        }

        // ─── Diff: remove old markers, add new ones ───
        // Remove all existing markers
        liveMarkers.current.forEach((m) => m.remove());
        liveMarkers.current = [];

        // Create new ones ONLY for chosen points
        chosenPoints.forEach((pt) => {
          const el = buildElement(pt);
          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([pt.lon, pt.lat])
            .addTo(map);
          liveMarkers.current.push(marker);
        });
      });
    };

    // Debounce-ish: use 'moveend' instead of 'move' to avoid running every frame
    map.on('moveend', render);
    map.on('zoomend', render);
    // Also run once on initial load
    render();

    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      map.off('moveend', render);
      map.off('zoomend', render);
      liveMarkers.current.forEach((m) => m.remove());
      liveMarkers.current = [];
    };
    // allData is a dependency because the reference data now arrives over the
    // network rather than being bundled. Without it this effect would run once
    // against empty tiers and never draw a marker.
  }, [map, buildElement, allData]);

  return null;
};

export default AQIMarkers;
