// web/components/citizen/AQIMarkers.tsx
import React, { useEffect } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import { GEO_COORDINATES, COUNTRIES, STATES, CountryLocation, StateLocation, CityLocation } from '@/lib/coordinates';

// Map AQI value to severity text color (clean, muted, professional)
export const getAqiTextColor = (aqi: number): string => {
  if (aqi <= 50) return '#34d399'; // GOOD (emerald-400 / muted green)
  if (aqi <= 100) return '#fbbf24'; // MODERATE (amber-400 / yellow)
  if (aqi <= 150) return '#fb923c'; // POOR (orange-400)
  if (aqi <= 200) return '#f472b6'; // UNHEALTHY (pink-400 / red-pink)
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

type MarkerType = 'country' | 'state' | 'city';

interface MarkerData {
  marker: maplibregl.Marker;
  el: HTMLElement;
  type: MarkerType;
}

const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { selectedCellId, selectCell, loadLocationData } = useAQIStore();

  useEffect(() => {
    if (!map) return;
    const markersData: MarkerData[] = [];

    const createMarker = (
      id: string | number,
      name: string,
      subtitle: string,
      lat: number,
      lon: number,
      aqi: number,
      category: string,
      pm25: number,
      type: MarkerType,
      sizeMultiplier: number = 1
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
      el.style.transition = 'opacity 0.4s ease, visibility 0.4s ease'; // Smooth fade transition
      el.style.opacity = '0'; // Start hidden, will be updated by zoom listener
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none'; // Only interactive when visible
      
      // UI Improvement: add a subtle backdrop/container for better visibility
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.padding = '4px 6px';
      container.style.borderRadius = '8px';
      container.style.background = isSelected ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.6)';
      container.style.backdropFilter = 'blur(4px)';
      container.style.border = `1px solid ${isSelected ? textColor : 'rgba(255,255,255,0.1)'}`;
      container.style.transition = 'all 0.2s ease';
      container.style.boxShadow = isSelected ? `0 0 12px ${textColor}66` : '0 4px 6px -1px rgba(0, 0, 0, 0.5)';
      
      el.title = `${name}${subtitle ? ', ' + subtitle : ''}\nAQI: ${aqi} · ${category}\nPM2.5: ${pm25} µg/m³\nClick to inspect`;

      // Inner text-only AQI number element
      const innerNum = document.createElement('span');
      innerNum.className = `aqi-text-num ${isSelected ? 'selected' : ''}`;
      innerNum.textContent = `${aqi}`;
      innerNum.style.color = textColor;
      innerNum.style.fontSize = `${13 * sizeMultiplier}px`;
      innerNum.style.fontWeight = '800';
      innerNum.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      innerNum.style.lineHeight = '1';
      innerNum.style.userSelect = 'none';
      innerNum.style.whiteSpace = 'nowrap';
      innerNum.style.textShadow = `0 1px 2px rgba(0,0,0,0.8), 0 0 8px ${textColor}88`; // Stronger glow
      
      // Place Name label underneath the number
      const innerLabel = document.createElement('span');
      innerLabel.className = 'aqi-place-label';
      innerLabel.textContent = name;
      innerLabel.style.color = isSelected ? '#ffffff' : '#e2e8f0';
      innerLabel.style.fontSize = `${10 * sizeMultiplier}px`;
      innerLabel.style.fontWeight = '600';
      innerLabel.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
      innerLabel.style.lineHeight = '1.2';
      innerLabel.style.marginTop = '2px';
      innerLabel.style.textShadow = '0 1px 3px rgba(0,0,0,0.9)';
      innerLabel.style.userSelect = 'none';
      innerLabel.style.whiteSpace = 'nowrap';

      container.appendChild(innerNum);
      container.appendChild(innerLabel);
      el.appendChild(container);

      // Hover effects
      el.onmouseenter = () => {
        container.style.transform = 'scale(1.15)';
        container.style.background = 'rgba(15, 23, 42, 0.9)';
        container.style.borderColor = textColor;
        container.style.boxShadow = `0 0 15px ${textColor}88`;
        innerNum.style.filter = 'brightness(1.2)';
        el.style.zIndex = '50';
      };

      el.onmouseleave = () => {
        container.style.transform = 'scale(1)';
        container.style.background = isSelected ? 'rgba(15, 23, 42, 0.85)' : 'rgba(15, 23, 42, 0.6)';
        container.style.borderColor = isSelected ? textColor : 'rgba(255,255,255,0.1)';
        container.style.boxShadow = isSelected ? `0 0 12px ${textColor}66` : '0 4px 6px -1px rgba(0, 0, 0, 0.5)';
        innerNum.style.filter = 'brightness(1)';
        el.style.zIndex = isSelected ? '10' : '1';
      };

      el.onclick = (e) => {
        e.stopPropagation();
        selectCell(id as number);
        const displayName = `${name}${subtitle ? ', ' + subtitle : ''}`;
        loadLocationData(lat, lon, displayName, map);
        
        // Optionally zoom in if it's a country or state
        if (type === 'country') {
            map.flyTo({ center: [lon, lat], zoom: 5 });
        } else if (type === 'state') {
            map.flyTo({ center: [lon, lat], zoom: 6.5 });
        }
      };

      if (
        Number.isFinite(lon) &&
        Number.isFinite(lat) &&
        lat >= -90 &&
        lat <= 90 &&
        lon >= -180 &&
        lon <= 180
      ) {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([lon, lat])
          .addTo(map);
        markersData.push({ marker, el, type });
      }
    };

    // 1. Create Country Markers
    COUNTRIES.forEach((loc: CountryLocation) => {
        createMarker(loc.id, loc.name, '', loc.lat, loc.lon, loc.aqi, loc.category, loc.pm25, 'country', 1.2);
    });

    // 2. Create State Markers
    STATES.forEach((loc: StateLocation) => {
        createMarker(loc.id, loc.name, loc.country, loc.lat, loc.lon, loc.aqi, loc.category, loc.pm25, 'state', 1.1);
    });

    // 3. Create City Markers
    GEO_COORDINATES.forEach((loc: CityLocation) => {
        createMarker(loc.id, loc.name, loc.state, loc.lat, loc.lon, loc.aqi, loc.category || getAqiCategory(loc.aqi), loc.pm25, 'city', 1.0);
    });

    const updateVisibility = () => {
      const zoom = map.getZoom();
      // Define thresholds
      // Zoom < 4.5: Countries only
      // Zoom 4.5 to 6.5: States only
      // Zoom > 6.5: Cities only
      
      markersData.forEach(({ el, type }) => {
        let isVisible = false;

        if (zoom < 4.5) {
            isVisible = type === 'country';
        } else if (zoom >= 4.5 && zoom < 6.5) {
            isVisible = type === 'state';
        } else {
            isVisible = type === 'city';
        }

        if (isVisible) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
            el.style.pointerEvents = 'auto';
        } else {
            el.style.opacity = '0';
            el.style.visibility = 'hidden';
            el.style.pointerEvents = 'none';
        }
      });
    };

    map.on('zoom', updateVisibility);
    updateVisibility(); // initial state

    // Cleanup markers when unmounting
    return () => {
      map.off('zoom', updateVisibility);
      markersData.forEach((m) => m.marker.remove());
    };
  }, [map, selectedCellId, selectCell, loadLocationData]);

  return null;
};

export default AQIMarkers;
