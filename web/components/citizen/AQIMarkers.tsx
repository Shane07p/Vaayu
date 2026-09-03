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
import { fetchStationReadings } from '@/lib/api';
import type { StationReading } from '@/lib/schemas';
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
  tier: number; // 0-continent  1-country  2-state  3-city  4-station
  /**
   * Present only on tier 4. Tiers 0-3 are geographic reference points and
   * carry no measurement, which is why they render as a dot rather than a
   * number: the values they used to show were invented.
   */
  aqi?: number;
  pm25?: number;
  stale?: boolean;
  /** Who measured it, or SEED for demonstration rows. */
  operator?: string;
  /** The reading itself, on tier 4, so a click needs no further request. */
  reading?: StationReading;
}

/* ───── Build the four flat arrays from fetched reference data ───── */
// Previously a module-level constant built from static JSON imports, which
// pulled roughly a megabyte of data into the client bundle. The data now
// arrives over the network, so the tiers are derived once it lands.
function buildTiers(data: GeoReferenceData): DataPoint[][] {
  return [
    // tier 0 — continents
    data.continents.map((c: ContinentLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon, tier: 0,
    })),
    // tier 1 — countries
    data.countries.map((c: CountryLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon, tier: 1,
    })),
    // tier 2 — states
    data.states.map((c: StateLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon, tier: 2,
    })),
    // tier 3 — cities
    data.cities.map((c: CityLocation) => ({
      id: c.id, name: c.name, lat: c.lat, lon: c.lon, tier: 3,
    })),
  ];
}

/* ───── Props ───── */
interface Props { map: Map | null; }

/* ───── Collision threshold in pixels ───── */
const COLLISION_PX = 40;

/** The measured layer. Thinned on collision rather than dropped. */
const STATION_TIER = 4;

/** A point with its current screen position. */
type ProjectedPoint = DataPoint & { pt: { x: number; y: number } };

/* ───── Component ───── */
const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { loadLocationData, selectStation } = useAQIStore();
  const [geoData, setGeoData] = useState<GeoReferenceData | null>(null);
  // The measured layer. Separate from the reference tiers because it is the
  // only one with values, and it comes from the API rather than a static file.
  const [stations, setStations] = useState<StationReading[]>([]);

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

  useEffect(() => {
    let cancelled = false;
    fetchStationReadings()
      .then((readings) => {
        if (!cancelled) setStations(readings);
      })
      // An empty station layer is the truth when nothing has been ingested.
      // The reference tiers still render, so the map stays navigable.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const allData = useMemo(() => {
    const tiers = geoData ? buildTiers(geoData) : [[], [], [], []];
    return [
      ...tiers,
      stations.map((station) => ({
        id: station.stationId,
        name: station.city ?? station.name,
        lat: station.lat,
        lon: station.lon,
        tier: 4,
        aqi: station.aqi,
        pm25: station.pm25,
        stale: station.stale,
        operator: station.operator,
        reading: station,
      })),
    ] as DataPoint[][];
  }, [geoData, stations]);
  // Store live markers so we can remove them on the next cycle
  const liveMarkers = useRef<maplibregl.Marker[]>([]);
  const rafId = useRef<number>(0);

  /* Build a single DOM marker element – called only for items we actually show */
  const buildElement = useCallback(
    (pt: DataPoint) => {
      // Only a measured point is coloured by severity. Tiers 0-3 are geographic
      // reference points with no reading, and colouring them would restate the
      // values this component used to fabricate.
      const measured = pt.aqi !== undefined;
      const fontSize = measured
        ? 13
        : pt.tier === 0 ? 13 : pt.tier === 1 ? 12 : pt.tier === 2 ? 11 : 10;

      const el = document.createElement('div');
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      el.style.cursor = 'pointer';
      el.style.pointerEvents = 'auto';
      // A seed row is demonstration data sitting in the same table as real
      // measurements. It is dimmed like any stale reading, but dimming alone
      // does not say which it is, so the tooltip names the operator.
      const seeded = pt.operator === 'SEED';
      el.title = measured
        ? `${pt.name}: AQI ${pt.aqi}, PM2.5 ${pt.pm25} ug/m3`
          + (seeded ? ' - demonstration data, not a measurement' : '')
          + (pt.stale && !seeded ? ' - not reported recently' : '')
        : `${pt.name} - select to read measured air quality here`;

      const num = document.createElement('span');
      // The measured value, or a dot where there is nothing to show.
      num.textContent = measured ? `${pt.aqi}` : '○';
      num.style.color = measured ? getAqiTextColor(pt.aqi as number) : '#94a3b8';
      // A station that has stopped reporting is dimmed rather than hidden or
      // shown as current. Its age is in the tooltip.
      if (pt.stale) num.style.opacity = '0.45';
      if (seeded) {
        num.style.textDecoration = 'underline dotted';
        num.style.textUnderlineOffset = '3px';
      }
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
      label.style.fontSize = `${fontSize - 1}px`;
      label.style.fontWeight = '600';
      label.style.fontFamily = 'ui-sans-serif,system-ui,-apple-system,sans-serif';
      label.style.lineHeight = '1.1';
      label.style.marginTop = '1px';
      label.style.userSelect = 'none';
      label.style.textShadow =
        '-1px -1px 0 #0a0a0a, 1px -1px 0 #0a0a0a, -1px 1px 0 #0a0a0a, 1px 1px 0 #0a0a0a';

      el.appendChild(num);
      if (!measured) el.appendChild(label);

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

        // A station answers for itself. Routing it through loadLocationData
        // fetched the 1 km grid around the point and selected the middle cell,
        // so the card showed a modelled estimate rather than the measurement
        // that is already in hand -- and every station near NCR landed on
        // roughly the same cell, which is why the card looked static.
        if (pt.reading) {
          selectStation(pt.reading, map);
          return;
        }

        // A reference point has no reading of its own, so this asks what is
        // measured near it.
        loadLocationData(pt.lat, pt.lon, pt.name, map);
        if (pt.tier === 0)      map?.flyTo({ center: [pt.lon, pt.lat], zoom: 3.5 });
        else if (pt.tier === 1) map?.flyTo({ center: [pt.lon, pt.lat], zoom: 5.5 });
        else if (pt.tier === 2) map?.flyTo({ center: [pt.lon, pt.lat], zoom: 7.5 });
      };

      return el;
    },
    [map, loadLocationData, selectStation],
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
        // Tier 4 is the measured layer and is preferred wherever the zoom is
        // close enough to separate stations. Below that the reference tiers
        // carry navigation, since a few hundred stations at country zoom would
        // collide into nothing legible.
        // Thresholds are lower than they were because tier 4 now thins rather
        // than standing down: at zoom 5 a few hundred stations reduce to the
        // dozen or so worst that fit, which is more useful than a state label
        // with no number on it. The reference tiers still carry the wide zooms,
        // where thinning would leave too few points to navigate by.
        let startTier = 4;
        if (zoom < 3)        startTier = 0;
        else if (zoom < 4)   startTier = 1;
        else if (zoom < 5)   startTier = 2;

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
          const projected: ProjectedPoint[] = inView.map((p) => ({
            ...p,
            pt: map.project([p.lon, p.lat]),
          }));

          // The measured tier thins instead of standing down.
          //
          // Promoting to the parent tier is right for reference labels: two
          // overlapping region names are worse than one. It is wrong for
          // stations, which cluster in cities by their nature -- Delhi has two
          // dozen within a few kilometres, so at any city zoom some pair is
          // always within COLLISION_PX and the whole tier was being rejected.
          // That is why the map showed a single grey "Delhi" dot while two
          // hundred live readings sat in the database.
          //
          // Points arrive sorted worst-first from the API, so keeping the first
          // of any colliding pair keeps the most polluted station in view --
          // the one a reader most needs.
          if (tier === STATION_TIER) {
            const kept: ProjectedPoint[] = [];
            for (const candidate of projected) {
              const collides = kept.some((existing) => {
                const dx = existing.pt.x - candidate.pt.x;
                const dy = existing.pt.y - candidate.pt.y;
                return dx * dx + dy * dy < COLLISION_PX * COLLISION_PX;
              });
              if (!collides) kept.push(candidate);
            }
            if (kept.length > 0) {
              chosenPoints = kept;
              break;
            }
            continue;
          }

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
