"use client";


import FullScreenMap from '@/components/citizen/FullScreenMap';
import { fetchGrid } from '@/lib/api';
import { useAQIStore } from '@/store/aqiStore';
import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function AqiView() {
  const { loadGrid, setLoading, loadLocationData, selectOpeningStation } = useAQIStore();
  const params = useSearchParams();
  const lat = params.get('lat');
  const lon = params.get('lon');
  const name = params.get('name');

  useEffect(() => {
    const loadData = async () => {
      // Arriving from a ranking, with a place already chosen. Load that rather
      // than the NCR grid: loadLocationData fetches the cells around the point
      // and falls back to the nearest station where the 1 km surface does not
      // reach, which is everywhere outside Delhi-NCR.
      if (lat && lon) {
        const latitude = Number(lat);
        const longitude = Number(lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          await loadLocationData(latitude, longitude, name ?? 'Selected location');
          return;
        }
      }

      setLoading(true);
      try {
        loadGrid(await fetchGrid('76.80,28.20,77.60,28.90'));
        // Open on a real measurement near the map's initial centre rather than
        // on a cell of the seeded surface. DELHI_CENTRE matches FullScreenMap.
        await selectOpeningStation(28.6139, 77.209);
      } catch (error) {
        // The map renders without cells and says so; a thrown error here would
        // blank the page over a failure the map already reports.
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [lat, lon, name, loadGrid, setLoading, loadLocationData, selectOpeningStation]);

  return <FullScreenMap />;
}

export default function AqiPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={<FullScreenMap />}>
      <AqiView />
    </Suspense>
  );
}
