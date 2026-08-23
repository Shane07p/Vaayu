"use client";


import FullScreenMap from '@/components/citizen/FullScreenMap';
import { fetchGrid, fetchStations, fetchForecast } from '@/lib/api';
import { useAQIStore } from '@/store/aqiStore';
import { useEffect } from 'react';
import type { GridPrediction, Forecast } from '@/lib/schemas';

export default function AqiPage() {
  const { loadGrid, setLoading } = useAQIStore();

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [gridList, stations] = await Promise.all([
          fetchGrid('76.80,28.20,77.60,28.90'),
          fetchStations(),
        ]);
        loadGrid(gridList);
        if (stations && stations[0]) {
          const fc = await fetchForecast(stations[0].id);
          // TODO: store forecasts if needed
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [loadGrid, setLoading]);

  return <FullScreenMap />;
}
