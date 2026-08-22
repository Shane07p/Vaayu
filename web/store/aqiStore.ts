// web/store/aqiStore.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { GridPrediction, Forecast } from '@/lib/schemas';

export type AQITab = 'aqi' | 'weather';

interface AQIState {
  selectedCellId: number | null;
  selectedCellData: GridPrediction | null;
  gridData: GridPrediction[];
  forecast: Forecast[];
  currentTab: AQITab;
  loading: boolean;
  locationCoords: { lat: number; lng: number } | null;
  // actions
  loadGrid: (data: GridPrediction[]) => void;
  selectCell: (id: number) => void; // also loads cell data
  setSelectedCellData: (data: GridPrediction | null) => void;
  setForecast: (fc: Forecast[]) => void;
  setTab: (tab: AQITab) => void;
  setLoading: (loading: boolean) => void;
  locateMe: () => Promise<void>;
}

export const useAQIStore = create<AQIState>()(
  devtools((set, get) => ({
    selectedCellId: null,
    selectedCellData: null,
    gridData: [],
    forecast: [],
    currentTab: 'aqi',
    loading: false,
    locationCoords: null,
    loadGrid: (data) => set({ gridData: data }),
    selectCell: (id) => {
      const cell = get().gridData.find((c) => c.gridCellId === id) || null;
      set({ selectedCellId: id, selectedCellData: cell });
    },
    setSelectedCellData: (data) => set({ selectedCellData: data }),
    setForecast: (fc) => set({ forecast: fc }),
    setTab: (tab) => set({ currentTab: tab }),
    setLoading: (loading) => set({ loading }),
    locateMe: async () => {
      if (!navigator.geolocation) return;
      set({ loading: true });
      return new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            set({ locationCoords: { lat: latitude, lng: longitude }, loading: false });
            resolve();
          },
          () => {
            set({ loading: false });
            resolve();
          },
        );
      });
    },
  }))
);
