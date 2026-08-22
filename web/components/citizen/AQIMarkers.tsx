// web/components/citizen/AQIMarkers.tsx
import React, { useEffect, useRef } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import { GEO_COORDINATES, COUNTRIES, STATES, CONTINENTS, CountryLocation, StateLocation, CityLocation, ContinentLocation } from '@/lib/coordinates';

// Map AQI value to severity text color (clean, muted, professional)
export const getAqiTextColor = (aqi: number): string => {
  if (aqi <= 50) return '#34d399'; // GOOD (emerald-400)
  if (aqi <= 100) return '#fbbf24'; // MODERATE (amber-400)
  if (aqi <= 150) return '#fb923c'; // POOR (orange-400)
  if (aqi <= 200) return '#f472b6'; // UNHEALTHY (pink-400)
  if (aqi <= 300) return '#c084fc'; // SEVERE (purple-400)
  return '#f87171'; // HAZARDOUS (red-400)
};

export const getAqiCategory = (aqi: number): string => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

interface Props {
  map: Map | null;
}

type MarkerTier = 0 | 1 | 2 | 3; // 0: Continent, 1: Country, 2: State, 3: City

interface MarkerData {
  id: string | number;
  marker: maplibregl.Marker;
  el: HTMLElement;
  tier: MarkerTier;
  name: string;
  parentName: string | null;
  lon: number;
  lat: number;
}

const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { selectedCellId, selectCell, loadLocationData } = useAQIStore();
  const markersRef = useRef<MarkerData[]>([]);

  useEffect(() => {
    if (!map) return;
    const markersData: MarkerData[] = [];

    const createMarker = (
      id: string | number,
      name: string,
      parentName: string | null,
      lat: number,
      lon: number,
      aqi: number,
      category: string,
      pm25: number,
      tier: MarkerTier
    ) => {
      const isSelected = selectedCellId === id;
      const textColor = getAqiTextColor(aqi);

      // Outer wrapper element positioned strictly by MapLibre
      const el = document.createElement('div');
      el.className = 'aqi-place-marker-wrap';
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.padding = '0';
      el.style.margin = '0';
      el.style.cursor = 'pointer';
      el.style.display = 'flex';
      el.style.flexDirection = 'column';
      el.style.alignItems = 'center';
      // Ultra fast transition for visibility
      el.style.transition = 'opacity 0.2s ease';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      el.style.position = 'absolute'; // For fast DOM updates
      
      el.title = `${name}\nAQI: ${aqi} · ${category}\nPM2.5: ${pm25} µg/m³\nClick to inspect`;

      // Ultra-minimalist UI: Just the number with a tight, heavy text-shadow
      const innerNum = document.createElement('span');
      innerNum.className = `aqi-text-num ${isSelected ? 'selected' : ''}`;
      innerNum.textContent = `${aqi}`;
      innerNum.style.color = textColor;
      innerNum.style.fontSize = tier === 0 ? '16px' : tier === 1 ? '15px' : tier === 2 ? '13px' : '12px';
      innerNum.style.fontWeight = '900';
      innerNum.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      innerNum.style.lineHeight = '1';
      innerNum.style.userSelect = 'none';
      innerNum.style.whiteSpace = 'nowrap';
      // Minimalist outline shadow so it doesn't conflict with map text
      innerNum.style.textShadow = `
        -1px -1px 0 #000,  
         1px -1px 0 #000,
        -1px  1px 0 #000,
         1px  1px 0 #000,
         0px  0px 6px #000,
         0px  0px 10px ${textColor}88
      `;
      
      // Place Name label underneath the number (very subtle)
      const innerLabel = document.createElement('span');
      innerLabel.className = 'aqi-place-label';
      innerLabel.textContent = name;
      innerLabel.style.color = isSelected ? '#ffffff' : '#cbd5e1';
      innerLabel.style.fontSize = tier === 0 ? '11px' : tier === 1 ? '10px' : '9px';
      innerLabel.style.fontWeight = '600';
      innerLabel.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
      innerLabel.style.lineHeight = '1.2';
      innerLabel.style.marginTop = '2px';
      innerLabel.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
      innerLabel.style.userSelect = 'none';
      innerLabel.style.whiteSpace = 'nowrap';

      el.appendChild(innerNum);
      if (tier <= 2) {
          el.appendChild(innerLabel); // Only show text for State and above to reduce clutter
      }

      // Hover effects
      el.onmouseenter = () => {
        innerNum.style.transform = 'scale(1.2)';
        innerNum.style.textShadow = `-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 15px ${textColor}`;
        el.style.zIndex = '50';
      };

      el.onmouseleave = () => {
        innerNum.style.transform = 'scale(1)';
        innerNum.style.textShadow = `
          -1px -1px 0 #000,  
           1px -1px 0 #000,
          -1px  1px 0 #000,
           1px  1px 0 #000,
           0px  0px 6px #000,
           0px  0px 10px ${textColor}88
        `;
        el.style.zIndex = isSelected ? '10' : '1';
      };

      el.onclick = (e) => {
        e.stopPropagation();
        selectCell(id as number);
        loadLocationData(lat, lon, name, map);
        
        // Zoom in when clicking a higher-level region
        if (tier === 0) map.flyTo({ center: [lon, lat], zoom: 3.5 });
        else if (tier === 1) map.flyTo({ center: [lon, lat], zoom: 5.5 });
        else if (tier === 2) map.flyTo({ center: [lon, lat], zoom: 7.5 });
      };

      if (Number.isFinite(lon) && Number.isFinite(lat) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);
        markersData.push({ id, marker, el, tier, name, parentName, lon, lat });
      }
    };

    // 1. Continents (Tier 0)
    CONTINENTS.forEach((loc: ContinentLocation) => {
        createMarker(loc.id, loc.name, null, loc.lat, loc.lon, loc.aqi, loc.category, loc.pm25, 0);
    });

    // 2. Countries (Tier 1)
    COUNTRIES.forEach((loc: CountryLocation) => {
        // We don't have continent mapping in countries.json right now, so parentName is null
        createMarker(loc.id, loc.name, null, loc.lat, loc.lon, loc.aqi, loc.category, loc.pm25, 1);
    });

    // 3. States (Tier 2)
    STATES.forEach((loc: StateLocation) => {
        createMarker(loc.id, loc.name, loc.country, loc.lat, loc.lon, loc.aqi, loc.category, loc.pm25, 2);
    });

    // 4. Cities (Tier 3)
    GEO_COORDINATES.forEach((loc: CityLocation) => {
        createMarker(loc.id, loc.name, loc.state, loc.lat, loc.lon, loc.aqi, loc.category || getAqiCategory(loc.aqi), loc.pm25, 3);
    });

    markersRef.current = markersData;

    let rafId: number;
    
    // The core smart collision and rendering logic
    const updateVisibility = () => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        const zoom = map.getZoom();
        const bounds = map.getBounds();
        
        // Determine the ideal target tier for this zoom level
        let targetTier: MarkerTier = 3;
        if (zoom < 3) targetTier = 0;
        else if (zoom < 4.5) targetTier = 1;
        else if (zoom < 6.5) targetTier = 2;

        // 1. Reset all to hidden
        markersData.forEach(m => {
            m.el.style.opacity = '0';
            m.el.style.pointerEvents = 'none';
        });

        // 2. Get candidates that are within the current map viewport bounds
        const candidates = markersData.filter(m => 
            bounds.contains([m.lon, m.lat])
        );

        // We will project candidates to screen coordinates to check for pixel collisions
        const projected = candidates.map(c => ({
            ...c,
            pt: map.project([c.lon, c.lat])
        }));

        const visibleIds = new Set<string | number>();
        const COLLISION_RADIUS = 35; // Pixels distance before they are considered "colliding"

        // We process from highest priority (targetTier) up to Continents (0)
        // If two markers at current level collide, we try to show their parent instead.
        const processLevel = (level: number) => {
            const levelMarkers = projected.filter(m => m.tier === level);
            
            for (let i = 0; i < levelMarkers.length; i++) {
                const m1 = levelMarkers[i];
                let collided = false;
                
                // Check collision against already visible markers
                for (const vid of Array.from(visibleIds)) {
                    const vMarker = projected.find(p => p.id === vid);
                    if (vMarker && Math.hypot(vMarker.pt.x - m1.pt.x, vMarker.pt.y - m1.pt.y) < COLLISION_RADIUS) {
                        collided = true;
                        break;
                    }
                }

                // Check collision against other markers in the SAME level
                if (!collided) {
                    for (let j = i + 1; j < levelMarkers.length; j++) {
                        const m2 = levelMarkers[j];
                        if (Math.hypot(m1.pt.x - m2.pt.x, m1.pt.y - m2.pt.y) < COLLISION_RADIUS) {
                            collided = true;
                            // Since m1 collides with m2, we should ideally promote them to their parent.
                            // To keep it simple: if collision happens, neither is shown, and we rely on the NEXT level up loop to fill the gap.
                            break;
                        }
                    }
                }

                if (!collided) {
                    visibleIds.add(m1.id);
                }
            }
        };

        // Try to place the target tier first, then fill gaps with higher tiers (state, country, continent)
        for (let t = targetTier; t >= 0; t--) {
            processLevel(t);
        }

        // Apply visibility
        markersData.forEach(m => {
            if (visibleIds.has(m.id)) {
                m.el.style.opacity = '1';
                m.el.style.pointerEvents = 'auto';
            }
        });
      });
    };

    map.on('zoom', updateVisibility);
    map.on('move', updateVisibility);
    updateVisibility(); // initial state

    // Cleanup markers when unmounting
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      map.off('zoom', updateVisibility);
      map.off('move', updateVisibility);
      markersData.forEach((m) => m.marker.remove());
    };
  }, [map, selectedCellId, selectCell, loadLocationData]);

  return null;
};

export default AQIMarkers;
