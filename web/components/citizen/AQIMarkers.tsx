// web/components/citizen/AQIMarkers.tsx
import React, { useEffect } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import { GEO_COORDINATES, GeoLocationPoint } from '@/lib/coordinates';

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

const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { selectedCellId, selectCell, loadLocationData } = useAQIStore();

  useEffect(() => {
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    GEO_COORDINATES.forEach((loc: GeoLocationPoint) => {
      const aqi = loc.aqi;
      const isSelected = selectedCellId === loc.id;
      const textColor = getAqiTextColor(aqi);
      const category = loc.category || getAqiCategory(aqi);

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
      el.title = `${loc.name}, ${loc.city} (${loc.state})\nAQI: ${aqi} · ${category}\nPM2.5: ${loc.pm25} µg/m³\nClick to inspect`;

      // Inner text-only AQI number element (no box, no background)
      const innerNum = document.createElement('span');
      innerNum.className = `aqi-text-num ${isSelected ? 'selected' : ''}`;
      innerNum.textContent = `${aqi}`;
      innerNum.style.color = textColor;
      innerNum.style.fontSize = '12px';
      innerNum.style.fontWeight = '700';
      innerNum.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      innerNum.style.display = 'inline-block';
      innerNum.style.lineHeight = '1';
      innerNum.style.userSelect = 'none';
      innerNum.style.whiteSpace = 'nowrap';
      innerNum.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s ease, text-shadow 0.15s ease';
      innerNum.style.textShadow = isSelected
        ? `0 0 10px ${textColor}, 0 0 16px ${textColor}99, 0 1px 3px rgba(0,0,0,0.95)`
        : '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)';
      innerNum.style.filter = isSelected ? 'brightness(1.4)' : 'brightness(1)';
      if (isSelected) {
        innerNum.style.transform = 'scale(1.25)';
      }

      // City / Place Name label underneath the number
      const innerLabel = document.createElement('span');
      innerLabel.className = 'aqi-place-label';
      innerLabel.textContent = loc.name;
      innerLabel.style.color = isSelected ? '#ffffff' : '#94a3b8';
      innerLabel.style.fontSize = '9px';
      innerLabel.style.fontWeight = '500';
      innerLabel.style.fontFamily = 'ui-sans-serif, system-ui, -apple-system, sans-serif';
      innerLabel.style.lineHeight = '1.2';
      innerLabel.style.marginTop = '2px';
      innerLabel.style.textShadow = '0 1px 2px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,0.9)';
      innerLabel.style.userSelect = 'none';
      innerLabel.style.whiteSpace = 'nowrap';
      innerLabel.style.pointerEvents = 'none';
      innerLabel.style.transition = 'color 0.15s ease';

      el.appendChild(innerNum);
      el.appendChild(innerLabel);

      // Hover effects on inner elements — leaves MapLibre translate transform intact
      el.onmouseenter = () => {
        innerNum.style.transform = 'scale(1.3)';
        innerNum.style.filter = 'brightness(1.5)';
        innerNum.style.textShadow = `0 0 10px ${textColor}, 0 0 18px ${textColor}bb, 0 1px 3px #000`;
        innerLabel.style.color = '#f1f5f9';
        el.style.zIndex = '50';
      };

      el.onmouseleave = () => {
        innerNum.style.transform = isSelected ? 'scale(1.25)' : 'scale(1)';
        innerNum.style.filter = isSelected ? 'brightness(1.4)' : 'brightness(1)';
        innerNum.style.textShadow = isSelected
          ? `0 0 10px ${textColor}, 0 0 16px ${textColor}99, 0 1px 3px rgba(0,0,0,0.95)`
          : '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)';
        innerLabel.style.color = isSelected ? '#ffffff' : '#94a3b8';
        el.style.zIndex = isSelected ? '10' : '1';
      };

      el.onclick = (e) => {
        e.stopPropagation();
        selectCell(loc.id);
        const displayName = `${loc.name}, ${loc.city}, ${loc.state}`;
        loadLocationData(loc.lat, loc.lon, displayName, map);
      };

      if (
        Number.isFinite(loc.lon) &&
        Number.isFinite(loc.lat) &&
        loc.lat >= -90 &&
        loc.lat <= 90 &&
        loc.lon >= -180 &&
        loc.lon <= 180
      ) {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([loc.lon, loc.lat])
          .addTo(map);
        markers.push(marker);
      }
    });

    // Cleanup markers when unmounting
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, selectedCellId, selectCell, loadLocationData]);

  return null;
};

export default AQIMarkers;

