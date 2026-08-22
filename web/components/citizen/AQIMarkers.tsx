// web/components/citizen/AQIMarkers.tsx
import React, { useEffect } from 'react';
import maplibregl, { Map } from 'maplibre-gl';
import { useAQIStore } from '@/store/aqiStore';
import { GridPrediction } from '@/lib/schemas';

// Helper to map AQI value to a muted semantic color
const getAqiColor = (aqi: number): string => {
  if (aqi <= 50) return '#6A9A8F'; // GOOD (muted green)
  if (aqi <= 100) return '#C5A36F'; // MODERATE (muted amber)
  if (aqi <= 150) return '#D68C55'; // POOR (muted orange)
  if (aqi <= 200) return '#C3544B'; // SEVERE (muted red)
  return '#7B2D3E'; // HAZARDOUS (deep burgundy)
};

interface Props {
  map: Map | null;
}

const AQIMarkers: React.FC<Props> = ({ map }) => {
  const { gridData, selectCell } = useAQIStore();

  useEffect(() => {
    if (!map) return;
    const markers: maplibregl.Marker[] = [];
    gridData.forEach((cell: GridPrediction) => {
      // Assume each GridPrediction has a `center` property with lat/lng and an `aqi` field.
      // The mock fixtures include `pm25Q50`; we compute an approximate AQI via that.
      const aqi = Math.round((cell.pm25Q50 / 250) * 500); // simple scaling for demo


       // Create custom marker element
       const el = document.createElement('div');
       el.className = 'aqi-marker';
       el.textContent = `${aqi}`;
       el.title = `AQI ${aqi}`;
       el.style.background = getAqiColor(aqi);
       el.style.width = '36px';
       el.style.height = '36px';
       el.style.borderRadius = '50%';
       el.style.display = 'flex';
       el.style.alignItems = 'center';
       el.style.justifyContent = 'center';
       el.style.color = '#F4F6F7';
       el.style.fontSize = '12px';
       el.style.fontWeight = '600';
       el.style.cursor = 'pointer';

       if (
         Number.isFinite(cell.lon) &&
         Number.isFinite(cell.lat) &&
         cell.lat >= -90 && cell.lat <= 90 &&
         cell.lon >= -180 && cell.lon <= 180
       ) {
         const marker = new maplibregl.Marker({ element: el })
           .setLngLat([cell.lon, cell.lat])
           .addTo(map);
         markers.push(marker);
       } else {
         console.warn('Skipping invalid AQI cell coordinates', cell);
       }

    });
    // Cleanup on unmount or when gridData changes
    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [map, gridData, selectCell]);

  return null; // This component only manages map markers
};

export default AQIMarkers;
