// web/components/citizen/AQIMarkers.tsx
import React, { useEffect } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import { GridPrediction } from '@/lib/schemas';

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
  const { gridData, selectedCellId, selectCell } = useAQIStore();

  useEffect(() => {
    if (!map) return;
    const markers: maplibregl.Marker[] = [];

    gridData.forEach((cell: GridPrediction) => {
      // Calculate AQI from PM2.5 quantile (approx standard scaling)
      const aqi = Math.round((cell.pm25Q50 / 250) * 500);
      const isSelected = selectedCellId === cell.gridCellId;
      const textColor = getAqiTextColor(aqi);
      const category = getAqiCategory(aqi);

      // Outer wrapper element positioned strictly by MapLibre
      const el = document.createElement('div');
      el.className = 'aqi-text-marker-wrap';
      el.style.background = 'transparent';
      el.style.border = 'none';
      el.style.padding = '0';
      el.style.margin = '0';
      el.style.cursor = 'pointer';
      el.title = `AQI ${aqi} · ${category}\nPM2.5: ${Math.round(cell.pm25Q50)} µg/m³\nCell: ${cell.code}\nClick to inspect`;

      // Inner text-only element (no box, no background)
      const inner = document.createElement('span');
      inner.className = `aqi-text-num ${isSelected ? 'selected' : ''}`;
      inner.textContent = `${aqi}`;
      inner.style.color = textColor;
      inner.style.fontSize = '12px';
      inner.style.fontWeight = '700';
      inner.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
      inner.style.display = 'inline-block';
      inner.style.lineHeight = '1';
      inner.style.userSelect = 'none';
      inner.style.whiteSpace = 'nowrap';
      inner.style.transition = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s ease, text-shadow 0.15s ease';
      inner.style.textShadow = isSelected
        ? `0 0 10px ${textColor}, 0 0 16px ${textColor}99, 0 1px 3px rgba(0,0,0,0.9)`
        : '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)';
      inner.style.filter = isSelected ? 'brightness(1.35)' : 'brightness(1)';
      if (isSelected) {
        inner.style.transform = 'scale(1.2)';
      }

      el.appendChild(inner);

      // Hover effects on inner span only — does not touch parent transform
      el.onmouseenter = () => {
        inner.style.transform = 'scale(1.3)';
        inner.style.filter = 'brightness(1.5)';
        inner.style.textShadow = `0 0 10px ${textColor}, 0 0 18px ${textColor}bb, 0 1px 3px #000`;
        el.style.zIndex = '50';
      };

      el.onmouseleave = () => {
        inner.style.transform = isSelected ? 'scale(1.2)' : 'scale(1)';
        inner.style.filter = isSelected ? 'brightness(1.35)' : 'brightness(1)';
        inner.style.textShadow = isSelected
          ? `0 0 10px ${textColor}, 0 0 16px ${textColor}99, 0 1px 3px rgba(0,0,0,0.9)`
          : '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 2px rgba(0, 0, 0, 0.9)';
        el.style.zIndex = isSelected ? '10' : '1';
      };

      el.onclick = (e) => {
        e.stopPropagation();
        selectCell(cell.gridCellId);
      };

      if (
        Number.isFinite(cell.lon) &&
        Number.isFinite(cell.lat) &&
        cell.lat >= -90 &&
        cell.lat <= 90 &&
        cell.lon >= -180 &&
        cell.lon <= 180
      ) {
        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([cell.lon, cell.lat])
          .addTo(map);
        markers.push(marker);
      } else {
        console.warn('Skipping invalid AQI cell coordinates', cell);
      }
    });

    // Cleanup markers when gridData or map changes or unmounts
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, gridData, selectedCellId, selectCell]);

  return null;
};

export default AQIMarkers;
